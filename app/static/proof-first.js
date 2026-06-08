const elements = {
  refreshButton: document.getElementById("proofRefreshButton"),
  statusPill: document.getElementById("proofStatusPill"),
  healthStatusValue: document.getElementById("healthStatusValue"),
  proofRequiredValue: document.getElementById("proofRequiredValue"),
  emergencyPauseValue: document.getElementById("emergencyPauseValue"),
  healthIssues: document.getElementById("healthIssues"),
  capsuleVersion: document.getElementById("capsuleVersion"),
  capsuleHash: document.getElementById("capsuleHash"),
  chainName: document.getElementById("chainName"),
  blockNumber: document.getElementById("blockNumber"),
  gasPrice: document.getElementById("gasPrice"),
  herodotusStatus: document.getElementById("herodotusStatus"),
  herodotusIndexerChain: document.getElementById("herodotusIndexerChain"),
  satelliteAddress: document.getElementById("satelliteAddress"),
  satelliteSafeReads: document.getElementById("satelliteSafeReads"),
  herodotusOutput: document.getElementById("herodotusOutput"),
  walletTableBody: document.getElementById("walletTableBody"),
  latestCycleId: document.getElementById("latestCycleId"),
  latestRoute: document.getElementById("latestRoute"),
  latestDelta: document.getElementById("latestDelta"),
  latestEvidenceCreatedAt: document.getElementById("latestEvidenceCreatedAt"),
  latestQuoteOutput: document.getElementById("latestQuoteOutput"),
  proofVerified: document.getElementById("proofVerified"),
  proofEngine: document.getElementById("proofEngine"),
  reconciliationStatus: document.getElementById("reconciliationStatus"),
  reconciliationSource: document.getElementById("reconciliationSource"),
  proofOutput: document.getElementById("proofOutput"),
  qflopStatus: document.getElementById("qflopStatus"),
  qflopLatestProof: document.getElementById("qflopLatestProof"),
  qflopWraps: document.getElementById("qflopWraps"),
  qflopRevenueProof: document.getElementById("qflopRevenueProof"),
  qflopGithubRepo: document.getElementById("qflopGithubRepo"),
  qflopRuntimeRoot: document.getElementById("qflopRuntimeRoot"),
  qflopOutput: document.getElementById("qflopOutput"),
  cycleIdInput: document.getElementById("cycleIdInput"),
  loadEvidenceButton: document.getElementById("loadEvidenceButton"),
  evidenceOutput: document.getElementById("evidenceOutput"),
  balanceTokenInput: document.getElementById("balanceTokenInput"),
  loadBalanceButton: document.getElementById("loadBalanceButton"),
  balanceOutput: document.getElementById("balanceOutput"),
};

let refreshTimer = null;

function setStatus(text, level = "ok") {
  elements.statusPill.textContent = text;
  elements.statusPill.classList.remove("ok", "warn", "bad");
  elements.statusPill.classList.add(level);
}

async function fetchJson(path, options = {}) {
  const response = await fetch(path, options);
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = payload?.detail || payload?.error || `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return payload;
}

function formatJson(payload) {
  return JSON.stringify(payload, null, 2);
}

function renderIssues(issues) {
  elements.healthIssues.innerHTML = "";
  if (!issues?.length) {
    const item = document.createElement("li");
    item.textContent = "No active proof-first issues.";
    elements.healthIssues.appendChild(item);
    return;
  }
  issues.forEach((issue) => {
    const item = document.createElement("li");
    item.textContent = issue;
    elements.healthIssues.appendChild(item);
  });
}

function renderWallets(wallets) {
  elements.walletTableBody.innerHTML = "";
  const entries = Object.entries(wallets || {});
  if (!entries.length) {
    elements.walletTableBody.innerHTML = '<tr><td colspan="4">No wallet data loaded.</td></tr>';
    return;
  }

  entries.forEach(([name, wallet]) => {
    const row = document.createElement("tr");
    const tokenSummary = Object.entries(wallet.tokens || {})
      .map(([symbol, token]) => `${symbol}: ${token.balance_decimal}`)
      .join("\n");
    row.innerHTML = `
      <td>${name}</td>
      <td class="hash-metric">${wallet.address || "--"}</td>
      <td>${wallet.native_eth || "--"}</td>
      <td><pre class="table-pre">${tokenSummary || "--"}</pre></td>
    `;
    elements.walletTableBody.appendChild(row);
  });
}

function renderOverview(payload) {
  const health = payload.health || {};
  const chain = payload.chain || {};
  const herodotus = payload.herodotus || {};
  const indexer = herodotus.indexer || {};
  const satellite = herodotus.satellite || {};
  const latestQuote = payload.latest_quote || {};
  const latestProof = payload.latest_proof || {};
  const latestReconciliation = payload.latest_reconciliation || {};
  const qflop = payload.qflop_backfill || {};
  const qflopProof = qflop.latest_vdf_proof || {};
  const qflopState = qflop.backfill_state || {};
  const qflopVerification = qflop.verification || {};
  const qflopGithub = qflop.github || {};

  elements.healthStatusValue.textContent = health.status || "--";
  elements.proofRequiredValue.textContent = String(health.proof_required ?? "--");
  elements.emergencyPauseValue.textContent = String(health.emergency_pause ?? "--");
  renderIssues(health.issues || []);

  elements.capsuleVersion.textContent = payload.capsule?.version || "--";
  elements.capsuleHash.textContent = payload.capsule?.hash || "--";
  elements.chainName.textContent = chain.chain_name ? `${chain.chain_name} (${chain.chain_id})` : "--";
  elements.blockNumber.textContent = chain.block_number ?? "--";
  elements.gasPrice.textContent = chain.gas_price_wei ? `${chain.gas_price_wei} wei` : "--";
  elements.herodotusStatus.textContent = herodotus.status || "--";
  elements.herodotusIndexerChain.textContent = indexer.chain_id || "--";
  elements.satelliteAddress.textContent = satellite.contract_address || "--";
  elements.satelliteSafeReads.textContent = String(satellite.safe_reads_required ?? "--");
  elements.herodotusOutput.textContent = formatJson(herodotus);

  renderWallets(payload.wallet_balances);

  elements.latestCycleId.textContent = payload.latest_cycle_id || "--";
  elements.latestRoute.textContent = latestQuote.route_name || "--";
  elements.latestDelta.textContent =
    typeof latestQuote.expected_delta_eth === "number" ? `${latestQuote.expected_delta_eth.toFixed(8)} ETH` : "--";
  elements.latestEvidenceCreatedAt.textContent = payload.latest_evidence_created_at || "--";
  elements.latestQuoteOutput.textContent = formatJson(latestQuote);

  elements.proofVerified.textContent = String(latestProof.verified ?? "--");
  elements.proofEngine.textContent = latestProof.proof_engine || "--";
  elements.reconciliationStatus.textContent = latestReconciliation.status || "--";
  elements.reconciliationSource.textContent = latestReconciliation.delta_source || "--";
  elements.proofOutput.textContent = formatJson({
    proof: latestProof,
    reconciliation: latestReconciliation,
  });

  elements.qflopStatus.textContent = qflop.status || "--";
  elements.qflopLatestProof.textContent = qflopProof.proof_id || "--";
  elements.qflopWraps.textContent = qflopState.total_wraps ?? "--";
  elements.qflopRevenueProof.textContent = String(qflopVerification.counts_as_revenue ?? "--");
  elements.qflopGithubRepo.textContent = qflopGithub.repository || "--";
  elements.qflopRuntimeRoot.textContent = qflop.source?.root || "--";
  elements.qflopOutput.textContent = formatJson(qflop);
}

async function loadOverview() {
  elements.refreshButton.disabled = true;
  setStatus("Status: syncing", "ok");
  try {
    const payload = await fetchJson("/api/proof-first/overview");
    renderOverview(payload);
    setStatus("Status: operational", payload.health?.status === "ok" ? "ok" : "warn");
  } catch (error) {
    setStatus("Status: degraded", "bad");
    elements.healthIssues.innerHTML = `<li>${error.message}</li>`;
  } finally {
    elements.refreshButton.disabled = false;
  }
}

async function loadEvidence() {
  const cycleId = elements.cycleIdInput.value.trim();
  if (!cycleId) {
    elements.evidenceOutput.textContent = "Enter a cycle ID first.";
    return;
  }
  elements.evidenceOutput.textContent = "Loading evidence...";
  try {
    const payload = await fetchJson(`/api/proof-first/evidence/${encodeURIComponent(cycleId)}`);
    elements.evidenceOutput.textContent = formatJson(payload);
  } catch (error) {
    elements.evidenceOutput.textContent = `Error: ${error.message}`;
  }
}

async function loadBalance() {
  const token = elements.balanceTokenInput.value.trim();
  if (!token) {
    elements.balanceOutput.textContent = "Enter a bearer token first.";
    return;
  }

  elements.balanceOutput.textContent = "Loading balance...";
  try {
    const payload = await fetchJson("/api/balance", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    elements.balanceOutput.textContent = formatJson(payload);
  } catch (error) {
    elements.balanceOutput.textContent = `Error: ${error.message}`;
  }
}

function boot() {
  elements.refreshButton.addEventListener("click", loadOverview);
  elements.loadEvidenceButton.addEventListener("click", loadEvidence);
  elements.loadBalanceButton.addEventListener("click", loadBalance);
  loadOverview();
  refreshTimer = window.setInterval(loadOverview, 20000);
}

window.addEventListener("beforeunload", () => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
  }
});

boot();
