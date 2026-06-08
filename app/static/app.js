const state = {
  source: "auto",
  refreshMs: 15000,
  baseUrlOverride: "",
  allowOverride: false,
  refreshController: null,
  refreshRequestId: 0,
};

const elements = {
  refreshButton: document.getElementById("refreshButton"),
  statusPill: document.getElementById("statusPill"),
  sourceLabel: document.getElementById("sourceLabel"),
  lastUpdate: document.getElementById("lastUpdate"),
  crystallizationLabel: document.getElementById("crystallizationLabel"),
  gpuModel: document.getElementById("gpuModel"),
  throughput: document.getElementById("throughput"),
  energy: document.getElementById("energy"),
  invariance: document.getElementById("invariance"),
  invarianceFill: document.getElementById("invarianceFill"),
  protocolLabel: document.getElementById("protocolLabel"),
  uptimeLabel: document.getElementById("uptimeLabel"),
  latencyP50: document.getElementById("latencyP50"),
  latencyP95: document.getElementById("latencyP95"),
  latencyP99: document.getElementById("latencyP99"),
  latencyP999: document.getElementById("latencyP999"),
  branches: document.getElementById("branches"),
  perturbations: document.getElementById("perturbations"),
  divergence: document.getElementById("divergence"),
  synthesis: document.getElementById("synthesis"),
  quantumStatus: document.getElementById("quantumStatus"),
  seismographyStatus: document.getElementById("seismographyStatus"),
  crystallizationStatus: document.getElementById("crystallizationStatus"),
  coldSnapStatus: document.getElementById("coldSnapStatus"),
  healthStatus: document.getElementById("healthStatus"),
  uptime: document.getElementById("uptime"),
  serviceList: document.getElementById("serviceList"),
  controlHint: document.getElementById("controlHint"),
  advancedToggle: document.getElementById("advancedToggle"),
  codeToggle: document.getElementById("codeToggle"),
  advancedPanel: document.getElementById("advancedPanel"),
  codePanel: document.getElementById("codePanel"),
  baseUrl: document.getElementById("baseUrl"),
  refreshRate: document.getElementById("refreshRate"),
  refreshLabel: document.getElementById("refreshLabel"),
  autoRefresh: document.getElementById("autoRefresh"),
  applyAdvanced: document.getElementById("applyAdvanced"),
  curlSnippet: document.getElementById("curlSnippet"),
  jsSnippet: document.getElementById("jsSnippet"),
  pySnippet: document.getElementById("pySnippet"),
  integrationStatus: document.getElementById("integrationStatus"),
  openaiStatus: document.getElementById("openaiStatus"),
  anthropicStatus: document.getElementById("anthropicStatus"),
  openaiPrompt: document.getElementById("openaiPrompt"),
  anthropicPrompt: document.getElementById("anthropicPrompt"),
  openaiSend: document.getElementById("openaiSend"),
  anthropicSend: document.getElementById("anthropicSend"),
  openaiOutput: document.getElementById("openaiOutput"),
  anthropicOutput: document.getElementById("anthropicOutput"),
  thrmlRun: document.getElementById("thrmlRun"),
  thrmlOutput: document.getElementById("thrmlOutput"),
};

const canvas = document.getElementById("seismicCanvas");
const ctx = canvas.getContext("2d");

let autoTimer = null;
let latestMetrics = null;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toSourceLabel(source) {
  if (source === "live") return "Live";
  if (source === "local") return "Local";
  return "Auto";
}

function setStatus(message, level = "ok") {
  elements.statusPill.textContent = message;
  elements.statusPill.classList.remove("ok", "warn", "bad");
  elements.statusPill.classList.add(level);
}

function setControlHint(message) {
  elements.controlHint.textContent = message;
}

function setTag(el, status) {
  const text = status || "--";
  el.textContent = text;
  el.classList.remove("good", "warn", "bad");
  const lower = text.toLowerCase();
  if (lower.includes("complete") || lower.includes("crystalline") || lower.includes("healthy")) {
    el.classList.add("good");
  } else if (lower.includes("warning") || lower.includes("degraded")) {
    el.classList.add("warn");
  } else if (lower.includes("error") || lower.includes("shattered")) {
    el.classList.add("bad");
  }
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) return "--";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function queryParams() {
  const params = new URLSearchParams();
  params.set("source", state.source);
  if (state.baseUrlOverride && state.allowOverride) {
    params.set("base_url", state.baseUrlOverride);
  }
  return params.toString();
}

function apiUrl(path, includeTelemetryParams = true) {
  if (!includeTelemetryParams) return path;
  const params = queryParams();
  return params ? `${path}?${params}` : path;
}

function updateSnippets() {
  const base = window.location.origin;
  const benchPath = apiUrl("/api/bench/live");
  const seismicPath = apiUrl("/api/seismic/status");
  const healthPath = apiUrl("/api/health");
  elements.curlSnippet.textContent = `curl "${base}${benchPath}" | jq`;
  elements.jsSnippet.textContent = `fetch("${base}${seismicPath}")\n  .then((res) => res.json())\n  .then((data) => console.log(data));`;
  elements.pySnippet.textContent = `import requests\n\nresp = requests.get("${base}${healthPath}")\nprint(resp.json())`;
}

function extractErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.error === "string") return payload.error;
  if (payload.error && typeof payload.error.message === "string") return payload.error.message;
  return fallback;
}

async function fetchJson(path, options = {}) {
  const {
    method = "GET",
    body = null,
    includeTelemetryParams = true,
    signal = null,
    timeoutMs = 10000,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(apiUrl(path, includeTelemetryParams), {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json() : await response.text();
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `Request failed (${response.status})`));
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function updateHealth(data) {
  elements.healthStatus.textContent = data.status || "--";
  elements.uptime.textContent = formatUptime(Number(data.uptime_seconds));
  elements.uptimeLabel.textContent = `Uptime: ${formatUptime(Number(data.uptime_seconds))}`;
  elements.serviceList.innerHTML = "";

  const services = data.services || {};
  Object.entries(services)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, status]) => {
      const badge = document.createElement("div");
      badge.className = "tag";
      setTag(badge, status);
      badge.textContent = `${name.replace(/_/g, " ")}: ${status}`;
      elements.serviceList.appendChild(badge);
    });
}

function updateBench(data) {
  const metrics = data.metrics || {};
  latestMetrics = metrics;

  elements.gpuModel.textContent = metrics.gpu_model || "--";

  const throughput = Number(metrics.hash_throughput_ops_sec);
  elements.throughput.textContent = Number.isFinite(throughput) ? `${Math.round(throughput).toLocaleString()} ops/s` : "--";

  const energy = Number(metrics.energy_per_op_joules);
  elements.energy.textContent = Number.isFinite(energy) ? `${energy.toFixed(4)} J/op` : "--";

  elements.crystallizationLabel.textContent = metrics.crystallization_status || "--";
  elements.latencyP50.textContent = isFiniteNumber(metrics.latency_p50_ms) ? `${metrics.latency_p50_ms} ms` : "--";
  elements.latencyP95.textContent = isFiniteNumber(metrics.latency_p95_ms) ? `${metrics.latency_p95_ms} ms` : "--";
  elements.latencyP99.textContent = isFiniteNumber(metrics.latency_p99_ms) ? `${metrics.latency_p99_ms} ms` : "--";
  elements.latencyP999.textContent = isFiniteNumber(metrics.latency_p999_ms) ? `${metrics.latency_p999_ms} ms` : "--";
}

function updateSeismic(data) {
  elements.protocolLabel.textContent = `Protocol: ${data.protocol || "--"}`;
  const phases = data.phases || {};
  elements.branches.textContent = phases.quantum_branching?.branches_generated ?? "--";
  elements.perturbations.textContent = phases.seismography?.perturbations_applied ?? "--";
  elements.divergence.textContent = phases.crystallization?.measured_divergence ?? "--";
  elements.synthesis.textContent = phases.cold_snap?.synthesis ?? "--";
  setTag(elements.quantumStatus, phases.quantum_branching?.status);
  setTag(elements.seismographyStatus, phases.seismography?.status);
  setTag(elements.crystallizationStatus, phases.crystallization?.status);
  setTag(elements.coldSnapStatus, phases.cold_snap?.status);

  const invariance = phases.crystallization?.invariance_score;
  if (isFiniteNumber(invariance)) {
    const percent = Math.max(0, Math.min(1, invariance)) * 100;
    elements.invariance.textContent = `${percent.toFixed(1)}%`;
    elements.invarianceFill.style.width = `${percent}%`;
  } else {
    elements.invariance.textContent = "--";
    elements.invarianceFill.style.width = "0%";
  }
}

function updateDashboard(data) {
  updateHealth(data.health || {});
  updateBench(data.bench || {});
  updateSeismic(data.seismic || {});

  const updatedAt = data.updated_at ? new Date(data.updated_at) : new Date();
  elements.lastUpdate.textContent = Number.isNaN(updatedAt.getTime()) ? "--" : updatedAt.toLocaleTimeString();

  const resolved = data.resolved_source || state.source;
  if (state.source === "auto" && resolved === "local") {
    setControlHint("Live endpoint unavailable. Showing local fallback telemetry.");
  } else if (resolved === "live") {
    setControlHint("Receiving live telemetry data.");
  } else if (resolved === "local") {
    setControlHint("Running with local telemetry simulation.");
  } else {
    setControlHint(`Using ${toSourceLabel(state.source)} source mode.`);
  }
}

async function refreshAll() {
  const requestId = state.refreshRequestId + 1;
  state.refreshRequestId = requestId;

  if (state.refreshController) {
    state.refreshController.abort();
  }
  const controller = new AbortController();
  state.refreshController = controller;

  elements.refreshButton.disabled = true;
  setStatus("Status: syncing", "ok");

  try {
    const dashboard = await fetchJson("/api/dashboard", {
      signal: controller.signal,
    });
    if (requestId !== state.refreshRequestId) return;
    updateDashboard(dashboard);
    setStatus("Status: operational", "ok");
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error(error);
    setStatus("Status: degraded", "bad");
    setControlHint(`Refresh failed: ${error.message}`);
  } finally {
    if (requestId === state.refreshRequestId) {
      elements.refreshButton.disabled = false;
    }
  }
}

function setSource(source, options = {}) {
  const { refresh = true } = options;
  if (!["auto", "live", "local"].includes(source)) return;
  state.source = source;
  elements.sourceLabel.textContent = toSourceLabel(source);
  document.querySelectorAll("[data-source]").forEach((button) => {
    button.classList.toggle("active", button.dataset.source === source);
  });

  if (source === "auto") {
    setControlHint("Auto mode enabled. Live data is preferred with local fallback.");
  } else if (source === "live") {
    setControlHint("Live mode enabled. Data will be fetched from the configured remote endpoint.");
  } else {
    setControlHint("Local mode enabled. Using embedded telemetry simulation.");
  }

  updateSnippets();
  if (refresh) {
    refreshAll();
  }
}

function togglePanel(panel, triggerButton) {
  const isActive = panel.classList.toggle("active");
  if (triggerButton) {
    triggerButton.setAttribute("aria-expanded", String(isActive));
  }
}

function setAutoRefresh(enabled) {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  if (enabled) {
    autoTimer = setInterval(refreshAll, state.refreshMs);
  }
}

function updateRefreshLabel() {
  elements.refreshLabel.textContent = `${state.refreshMs / 1000}s`;
}

async function loadConfig() {
  const config = await fetchJson("/api/config", { includeTelemetryParams: false });
  state.allowOverride = Boolean(config.allow_remote_override);
  if (config.default_source) {
    state.source = config.default_source;
  }
  elements.baseUrl.value = config.remote_base || "";
  state.baseUrlOverride = elements.baseUrl.value.trim();
  elements.baseUrl.disabled = !state.allowOverride;
  if (!state.allowOverride) {
    elements.baseUrl.title = "Remote override is disabled by server configuration.";
  }
  updateSnippets();
}

async function loadIntegrations() {
  try {
    const data = await fetchJson("/api/integrations/status", { includeTelemetryParams: false });
    elements.openaiStatus.textContent = data.openai.enabled ? "Enabled" : "Missing Key";
    elements.openaiStatus.className = `badge ${data.openai.enabled ? "on" : "off"}`;
    elements.anthropicStatus.textContent = data.anthropic.enabled ? "Enabled" : "Missing Key";
    elements.anthropicStatus.className = `badge ${data.anthropic.enabled ? "on" : "off"}`;
    elements.integrationStatus.textContent = "Integrations ready";
  } catch (error) {
    elements.integrationStatus.textContent = "Integrations unavailable";
  }
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button) return;
  if (isLoading) {
    button.dataset.idleText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }
  button.textContent = button.dataset.idleText || button.textContent;
  button.disabled = false;
}

async function sendAssistant(kind) {
  const isOpenAI = kind === "openai";
  const prompt = (isOpenAI ? elements.openaiPrompt.value : elements.anthropicPrompt.value).trim();
  const output = isOpenAI ? elements.openaiOutput : elements.anthropicOutput;
  const button = isOpenAI ? elements.openaiSend : elements.anthropicSend;

  if (!prompt) {
    output.textContent = "Enter a prompt first.";
    return;
  }

  output.textContent = "Sending...";
  setButtonLoading(button, true, "Sending...");
  try {
    const data = await fetchJson(`/api/chat/${kind}`, {
      method: "POST",
      body: { prompt },
      includeTelemetryParams: false,
      timeoutMs: 45000,
    });
    output.textContent = data.text || JSON.stringify(data.raw || data, null, 2);
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  } finally {
    setButtonLoading(button, false, "");
  }
}

async function runThrmlDemo() {
  elements.thrmlOutput.textContent = "Running THRML demo...";
  setButtonLoading(elements.thrmlRun, true, "Running...");
  try {
    const data = await fetchJson("/api/thrml/demo", { includeTelemetryParams: false, timeoutMs: 20000 });
    elements.thrmlOutput.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    elements.thrmlOutput.textContent = `Error: ${error.message}`;
  } finally {
    setButtonLoading(elements.thrmlRun, false, "");
  }
}

function setupCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetId = button.getAttribute("data-copy");
      const target = document.getElementById(targetId);
      if (!target) return;
      const text = target.textContent || "";
      try {
        await navigator.clipboard.writeText(text);
        const idle = button.textContent;
        button.textContent = "Copied";
        setTimeout(() => {
          button.textContent = idle;
        }, 1400);
      } catch (error) {
        console.error(error);
      }
    });
  });
}

function bindPromptShortcut(textarea, kind) {
  textarea.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      sendAssistant(kind);
    }
  });
}

class SeismicField {
  constructor(canvasEl, context) {
    this.canvas = canvasEl;
    this.ctx = context;
    this.time = 0;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const scale = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * scale;
    this.canvas.height = window.innerHeight * scale;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  noise(x, t, speed, offset) {
    return Math.sin(x * 0.005 + t * speed + offset) + Math.cos(x * 0.008 - t * speed * 0.6 + offset * 2);
  }

  draw(metrics) {
    if (document.hidden) {
      requestAnimationFrame(() => this.draw(latestMetrics));
      return;
    }

    const { innerWidth: w, innerHeight: h } = window;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = "rgba(250, 246, 239, 0.1)";
    this.ctx.fillRect(0, 0, w, h);

    const throughput = metrics?.hash_throughput_ops_sec || 15000;
    const energy = metrics?.energy_per_op_joules || 0.042;
    const amplitude = Math.min(120, 30 + throughput / 200);
    const hueShift = Math.min(180, Math.max(20, energy * 2000));

    const layers = [
      { color: "rgba(27, 143, 139, 0.28)", speed: 0.6, offset: 0 },
      { color: "rgba(240, 100, 73, 0.22)", speed: 0.4, offset: 2 },
      { color: "rgba(17, 94, 89, 0.18)", speed: 0.3, offset: 4 },
    ];

    layers.forEach((layer, idx) => {
      this.ctx.beginPath();
      this.ctx.moveTo(0, h * (0.45 + idx * 0.08));
      for (let x = 0; x <= w; x += 18) {
        const y = h * (0.45 + idx * 0.08) + this.noise(x, this.time, layer.speed, layer.offset) * amplitude;
        this.ctx.lineTo(x, y);
      }
      this.ctx.lineTo(w, h);
      this.ctx.lineTo(0, h);
      this.ctx.closePath();
      this.ctx.fillStyle = layer.color;
      this.ctx.fill();
    });

    for (let i = 0; i < 6; i += 1) {
      const radius = 180 + i * 20;
      const x = w * (0.2 + 0.12 * i) + Math.sin(this.time * 0.2 + i) * 40;
      const y = h * (0.2 + 0.08 * i) + Math.cos(this.time * 0.24 + i) * 30;
      const gradient = this.ctx.createRadialGradient(x, y, 20, x, y, radius);
      gradient.addColorStop(0, `hsla(${hueShift + i * 12}, 70%, 65%, 0.2)`);
      gradient.addColorStop(1, "hsla(0, 0%, 100%, 0)");
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.time += 0.01;
    requestAnimationFrame(() => this.draw(latestMetrics));
  }
}

async function init() {
  const field = new SeismicField(canvas, ctx);
  field.draw(latestMetrics);

  document.querySelectorAll("[data-source]").forEach((button) => {
    button.addEventListener("click", () => setSource(button.dataset.source));
  });

  elements.refreshButton.addEventListener("click", refreshAll);
  elements.advancedToggle.addEventListener("click", () => togglePanel(elements.advancedPanel, elements.advancedToggle));
  elements.codeToggle.addEventListener("click", () => togglePanel(elements.codePanel, elements.codeToggle));

  elements.refreshRate.addEventListener("input", (event) => {
    state.refreshMs = Number(event.target.value) * 1000;
    updateRefreshLabel();
    if (elements.autoRefresh.checked) {
      setAutoRefresh(true);
    }
  });

  elements.autoRefresh.addEventListener("change", (event) => {
    setAutoRefresh(event.target.checked);
  });

  elements.applyAdvanced.addEventListener("click", () => {
    state.baseUrlOverride = elements.baseUrl.value.trim();
    updateSnippets();
    refreshAll();
  });

  elements.openaiSend.addEventListener("click", () => sendAssistant("openai"));
  elements.anthropicSend.addEventListener("click", () => sendAssistant("anthropic"));
  elements.thrmlRun.addEventListener("click", runThrmlDemo);

  bindPromptShortcut(elements.openaiPrompt, "openai");
  bindPromptShortcut(elements.anthropicPrompt, "anthropic");

  setupCopyButtons();
  updateRefreshLabel();

  try {
    await loadConfig();
  } catch (error) {
    setControlHint("Using default configuration. Config endpoint is unavailable.");
  }

  setSource(state.source, { refresh: false });
  setAutoRefresh(elements.autoRefresh.checked);

  await Promise.allSettled([refreshAll(), loadIntegrations()]);
}

init();
