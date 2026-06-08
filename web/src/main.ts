import "./style.css";

import { fetchBalance, fetchEvidence, fetchOperatorBrief, fetchOverview, fetchSession } from "./api";
import { collectRoles, initIdentity, loginWithPassword, logoutIdentity, onAuthChange, type IdentityUser } from "./identity";
import { ProofScene } from "./proofScene";
import { createSessionAgentBridge } from "./sessionAgent";
import type { OverviewPayload } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <div class="shell">
    <div class="scene-shell">
      <div class="scene-overlay">
        <p class="eyebrow">Genesis Conductor</p>
        <h1>Operator Deck</h1>
        <p class="subtitle">
          Netlify-hosted mirror for read-only proof-first telemetry, cached evidence lookups, operator summaries,
          and optional identity-gated controls.
        </p>
        <div class="hero-line">
          <span id="statusBadge" class="badge">Syncing</span>
          <span id="cacheBadge" class="microcopy">Awaiting overview</span>
        </div>
      </div>
      <div id="sceneHost" class="scene-host" aria-hidden="true"></div>
    </div>

    <main class="layout">
      <section class="panel">
        <div class="panel-head">
          <h2>Proof State</h2>
          <button id="refreshButton" class="action">Refresh</button>
        </div>
        <div class="metric-grid">
          <div class="metric-card">
            <span class="metric-label">Health</span>
            <strong id="healthMetric">--</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">Expected Delta</span>
            <strong id="deltaMetric">--</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">Herodotus</span>
            <strong id="herodotusMetric">--</strong>
          </div>
          <div class="metric-card">
            <span class="metric-label">Proof</span>
            <strong id="proofMetric">--</strong>
          </div>
        </div>
        <div class="json-shell">
          <h3>Overview</h3>
          <pre id="overviewOutput">Loading overview...</pre>
        </div>
      </section>

      <section class="panel stack">
        <div class="panel-head">
          <h2>Operator Session</h2>
          <div class="inline-actions">
            <button id="loginButton" class="action ghost">Sign In</button>
            <button id="logoutButton" class="action ghost" disabled>Logout</button>
          </div>
        </div>
        <div class="status-row">
          <span class="microcopy" id="identityStatus">Identity unavailable until initialized.</span>
        </div>
        <label class="field">
          <span>Operator email</span>
          <input id="identityEmailInput" type="email" placeholder="operator@example.com" />
        </label>
        <label class="field">
          <span>Password</span>
          <input id="identityPasswordInput" type="password" placeholder="Netlify Identity password" />
        </label>
        <div class="json-shell">
          <h3>Session</h3>
          <pre id="sessionOutput">No operator session.</pre>
        </div>
        <div class="json-shell">
          <h3>Operator Brief</h3>
          <button id="briefButton" class="action secondary" disabled>Generate Brief</button>
          <pre id="briefOutput">Operator login required for AI Gateway summaries.</pre>
        </div>
        <div class="json-shell">
          <h3>Cloudflare Session Agent</h3>
          <pre id="agentOutput">Cloudflare session agent not configured.</pre>
        </div>
      </section>

      <section class="panel stack">
        <div class="panel-head">
          <h2>Evidence Lookup</h2>
        </div>
        <label class="field">
          <span>Cycle ID</span>
          <input id="cycleInput" placeholder="cycle-..." />
        </label>
        <div class="inline-actions">
          <button id="evidenceButton" class="action secondary">Load Evidence</button>
        </div>
        <pre id="evidenceOutput">Enter a cycle ID to load cached evidence.</pre>
      </section>

      <section class="panel stack">
        <div class="panel-head">
          <h2>Balance Proxy</h2>
        </div>
        <label class="field">
          <span>Read-only token</span>
          <input id="balanceTokenInput" type="password" placeholder="READONLY_API_TOKEN" />
        </label>
        <div class="inline-actions">
          <button id="balanceButton" class="action secondary">Fetch Balance</button>
        </div>
        <pre id="balanceOutput">Protected mirror of GET /api/balance.</pre>
      </section>
    </main>
  </div>
`;

function requireElement<T extends Element>(value: T | null, label: string): T {
  if (!value) {
    throw new Error(`Operator deck bootstrap failed: missing ${label}`);
  }
  return value;
}

const sceneHost = requireElement(document.querySelector<HTMLElement>("#sceneHost"), "sceneHost");
const statusBadge = requireElement(document.querySelector<HTMLElement>("#statusBadge"), "statusBadge");
const cacheBadge = requireElement(document.querySelector<HTMLElement>("#cacheBadge"), "cacheBadge");
const overviewOutput = requireElement(document.querySelector<HTMLElement>("#overviewOutput"), "overviewOutput");
const evidenceOutput = requireElement(document.querySelector<HTMLElement>("#evidenceOutput"), "evidenceOutput");
const balanceOutput = requireElement(document.querySelector<HTMLElement>("#balanceOutput"), "balanceOutput");
const briefOutput = requireElement(document.querySelector<HTMLElement>("#briefOutput"), "briefOutput");
const agentOutput = requireElement(document.querySelector<HTMLElement>("#agentOutput"), "agentOutput");
const sessionOutput = requireElement(document.querySelector<HTMLElement>("#sessionOutput"), "sessionOutput");
const identityStatus = requireElement(document.querySelector<HTMLElement>("#identityStatus"), "identityStatus");
const refreshButton = requireElement(document.querySelector<HTMLButtonElement>("#refreshButton"), "refreshButton");
const evidenceButton = requireElement(document.querySelector<HTMLButtonElement>("#evidenceButton"), "evidenceButton");
const balanceButton = requireElement(document.querySelector<HTMLButtonElement>("#balanceButton"), "balanceButton");
const briefButton = requireElement(document.querySelector<HTMLButtonElement>("#briefButton"), "briefButton");
const loginButton = requireElement(document.querySelector<HTMLButtonElement>("#loginButton"), "loginButton");
const logoutButton = requireElement(document.querySelector<HTMLButtonElement>("#logoutButton"), "logoutButton");
const cycleInput = requireElement(document.querySelector<HTMLInputElement>("#cycleInput"), "cycleInput");
const balanceTokenInput = requireElement(document.querySelector<HTMLInputElement>("#balanceTokenInput"), "balanceTokenInput");
const identityEmailInput = requireElement(
  document.querySelector<HTMLInputElement>("#identityEmailInput"),
  "identityEmailInput",
);
const identityPasswordInput = requireElement(
  document.querySelector<HTMLInputElement>("#identityPasswordInput"),
  "identityPasswordInput",
);
const healthMetric = requireElement(document.querySelector<HTMLElement>("#healthMetric"), "healthMetric");
const deltaMetric = requireElement(document.querySelector<HTMLElement>("#deltaMetric"), "deltaMetric");
const herodotusMetric = requireElement(document.querySelector<HTMLElement>("#herodotusMetric"), "herodotusMetric");
const proofMetric = requireElement(document.querySelector<HTMLElement>("#proofMetric"), "proofMetric");

const scene = new ProofScene(sceneHost);
const sessionAgent = createSessionAgentBridge();
let currentOverview: OverviewPayload | null = null;
let currentUser: IdentityUser | null = null;

function formatJson(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}

function setStatus(text: string, tone: "ok" | "warn" | "bad" = "ok"): void {
  statusBadge.textContent = text;
  statusBadge.dataset.tone = tone;
}

function updateOverviewUi(payload: OverviewPayload): void {
  currentOverview = payload;
  const status = payload.health?.status ?? "unknown";
  const expectedDelta = payload.latest_quote?.expected_delta_eth;
  const cache = payload.edge_cache;
  const issues = payload.health?.issues ?? [];

  healthMetric.textContent = status;
  deltaMetric.textContent = typeof expectedDelta === "number" ? `${expectedDelta.toFixed(8)} ETH` : "--";
  herodotusMetric.textContent = payload.herodotus?.status ?? "--";
  proofMetric.textContent = String(payload.latest_proof?.verified ?? "--");
  overviewOutput.textContent = formatJson(payload);
  cacheBadge.textContent = cache
    ? `${cache.hit ? "Blob cache hit" : "Fresh upstream fetch"} · TTL ${cache.ttl_seconds}s`
    : "Direct response";
  setStatus(status === "ok" ? "Operational" : "Guarded", issues.length ? "warn" : "ok");

  const stress =
    status === "ok"
      ? 0.34
      : status === "guarded"
        ? 0.62
        : status === "degraded"
          ? 0.95
          : 0.75;
  scene.setStress(stress);
}

async function syncAgentOverview(payload: OverviewPayload): Promise<void> {
  if (!sessionAgent) {
    agentOutput.textContent = "Cloudflare session agent not configured. Set VITE_CF_AGENT_HOST to enable session memory.";
    return;
  }

  try {
    const summary = await sessionAgent.syncOverview(payload, currentUser?.email ?? null);
    agentOutput.textContent = formatJson(summary);
  } catch (error) {
    agentOutput.textContent = `Agent sync failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function loadOverview(): Promise<void> {
  refreshButton.disabled = true;
  setStatus("Syncing", "ok");
  try {
    const payload = await fetchOverview();
    updateOverviewUi(payload);
    void syncAgentOverview(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    overviewOutput.textContent = `Error: ${message}`;
    setStatus("Degraded", "bad");
    scene.setStress(1.05);
  } finally {
    refreshButton.disabled = false;
  }
}

async function loadEvidence(): Promise<void> {
  const cycleId = cycleInput.value.trim();
  if (!cycleId) {
    evidenceOutput.textContent = "Enter a cycle ID first.";
    return;
  }

  evidenceOutput.textContent = "Loading evidence...";
  try {
    const payload = await fetchEvidence(cycleId);
    evidenceOutput.textContent = formatJson(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    evidenceOutput.textContent = `Error: ${message}`;
  }
}

async function loadBalance(): Promise<void> {
  const token = balanceTokenInput.value.trim();
  if (!token) {
    balanceOutput.textContent = "Provide the same READONLY_API_TOKEN used by the upstream proof-first service.";
    return;
  }

  balanceOutput.textContent = "Loading balance...";
  try {
    const payload = await fetchBalance(token);
    balanceOutput.textContent = formatJson(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    balanceOutput.textContent = `Error: ${message}`;
  }
}

async function loadOperatorBrief(): Promise<void> {
  if (!currentUser) {
    briefOutput.textContent = "Operator login required.";
    return;
  }

  briefButton.disabled = true;
  briefOutput.textContent = "Generating AI brief...";

  try {
    const cycleId = cycleInput.value.trim() || currentOverview?.latest_cycle_id;
    const payload = await fetchOperatorBrief(cycleId);
    briefOutput.textContent = payload.summary;
    if (sessionAgent) {
      const summary = await sessionAgent.syncBrief(payload, currentUser?.email ?? null);
      agentOutput.textContent = formatJson(summary);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    briefOutput.textContent = `Error: ${message}`;
  } finally {
    briefButton.disabled = false;
  }
}

async function refreshSession(): Promise<void> {
  if (!currentUser) {
    identityStatus.textContent = "No authenticated operator session.";
    sessionOutput.textContent = "No operator session.";
    briefButton.disabled = true;
    logoutButton.disabled = true;
    return;
  }

  try {
    const payload = await fetchSession();
    sessionOutput.textContent = formatJson(payload);
    identityStatus.textContent = `${payload.user?.email ?? "Operator"} · roles: ${(payload.user?.roles ?? []).join(", ") || "none"}`;
    briefButton.disabled = !(payload.user?.roles ?? []).some((role) => role === "operator" || role === "admin");
    logoutButton.disabled = false;
  } catch (error) {
    const roles = collectRoles(currentUser);
    identityStatus.textContent = `Authenticated locally · roles: ${roles.join(", ") || "none"} · deploy to Netlify for server-side validation`;
    sessionOutput.textContent = formatJson({
      authenticated: true,
      fallback: true,
      user: {
        email: currentUser.email ?? null,
        roles,
      },
    });
    briefButton.disabled = false;
    logoutButton.disabled = false;
  }
}

async function bootIdentity(): Promise<void> {
  try {
    currentUser = await initIdentity();
    onAuthChange((_event, user) => {
      currentUser = user;
      void refreshSession();
    });
    if (!currentUser) {
      identityStatus.textContent = "No authenticated operator session.";
    }
    await refreshSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    identityStatus.textContent = `Identity bootstrap failed: ${message}`;
  }
}

refreshButton.addEventListener("click", () => {
  void loadOverview();
});
evidenceButton.addEventListener("click", () => {
  void loadEvidence();
});
balanceButton.addEventListener("click", () => {
  void loadBalance();
});
briefButton.addEventListener("click", () => {
  void loadOperatorBrief();
});
loginButton.addEventListener("click", () => {
  const email = identityEmailInput.value.trim();
  const password = identityPasswordInput.value;
  if (!email || !password) {
    identityStatus.textContent = "Provide operator email and password.";
    return;
  }

  identityStatus.textContent = "Signing in...";
  void loginWithPassword(email, password)
    .then((user) => {
      currentUser = user;
      identityPasswordInput.value = "";
      return refreshSession();
    })
    .catch((error) => {
      identityStatus.textContent = `Login failed: ${error instanceof Error ? error.message : String(error)}`;
    });
});
logoutButton.addEventListener("click", () => {
  if (!currentUser) {
    return;
  }
  void logoutIdentity();
});

void loadOverview();
void bootIdentity();

window.addEventListener("beforeunload", () => {
  scene.destroy();
});
