# MCP Tool Dissonance v1.0.0 — Podman Edition
## Test Infrastructure Documentation

**Source Artifact:** `mcp-tool-dissonance-v1.0.0-podman.zip`  
**DOI:** 10.5281/zenodo.17784838  
**Author:** Igor Holt (ORCID: 0009-0008-8389-1297)  
**Suite:** LID-LIFT Technical Suite Part 3 (DOI: 10.5281/zenodo.17784144)  
**Generated:** 2026-04-14  
**Orchestration File:** `mcp-tool-dissonance-v1.0.0-test_orchestration.jsonl`

---

## Overview

15 propositions extracted from the package specification. 7 tests designed across 5 parallel subagents. All tests are falsifiable against concrete measurable claims in the artifact.

| Metric | Value |
|--------|-------|
| Total Propositions | 15 |
| P0 Tests (Critical) | 4 |
| P1 Tests (Standard) | 3 |
| Total Tests | 7 |
| Subagents | 5 |
| Estimated Duration | ~4 hours |
| Platform | Podman (rootless, daemonless) |

---

## Proposition Registry

| ID | Type | Claim | Priority |
|----|------|-------|----------|
| PROP_001 | empirical | Archive contains exactly 15 files | P0 |
| PROP_002 | empirical | Archive is exactly 21,826 bytes | P0 |
| PROP_003 | empirical | Go source = exactly 749 lines | P0 |
| PROP_004 | empirical | Container UID = 65532 (non-root) | P0 |
| PROP_005 | mechanistic | Distroless: no shell, no package manager | P0 |
| PROP_006 | mechanistic | NoNewPrivileges enforced at OCI level | P0 |
| PROP_007 | mechanistic | DropAllCapabilities — empty effective cap set | P0 |
| PROP_008 | empirical | podman auto-update label present | P1 |
| PROP_009 | empirical | All 4 deployment methods functional | P0 |
| PROP_010 | mechanistic | Quadlet integrates with systemd --user | P1 |
| PROP_011 | governance | DOI + ORCID embedded in all 15 files | P1 |
| PROP_012 | governance | Parent suite DOI 10.5281/zenodo.17784144 resolvable | P1 |
| PROP_013 | empirical | arXiv:2604.11322 and arXiv:2604.11288 resolve with aligned content | P1 |
| PROP_014 | mechanistic | Daemonless — no podman socket required | P1 |
| PROP_015 | empirical | Containerfile builds successfully from scratch | P0 |

---

## Test Execution Plan

### Phase 1 — Parallel (network-only, no Podman required)
| Test | Agents | Tests Covered |
|------|--------|---------------|
| Archive Integrity & Line Count | AGENT_001 | TEST_001 → PROP_001, 002, 003 |
| Attribution & Reference Verification | AGENT_004 | TEST_005, TEST_006 → PROP_011, 012, 013 |

### Phase 2 — Parallel (Podman host required)
| Agent | Tests Covered |
|-------|---------------|
| AGENT_002 | TEST_002 → PROP_004, 005, 006, 007 |
| AGENT_003 | TEST_003 → PROP_009, 015 |

### Phase 3 — Sequential (clean VM required)
| Agent | Tests Covered |
|-------|---------------|
| AGENT_005 | TEST_004 → PROP_008, 010, 014 |
| AGENT_005 | TEST_007 → End-to-End adversarial replication |

---

## Test Specifications

### TEST_001 — Archive Integrity & Line Count Verification (P0)
**Propositions:** PROP_001, PROP_002, PROP_003  
**Agent:** AGENT_001  
**Acceptance Criteria:**
- File count = 15 (exact)
- Archive size = 21,826 bytes (exact)
- Go line count = 749 (exact)

**Key Commands:**
```bash
stat --format='%s' mcp-tool-dissonance-v1.0.0-podman.zip
unzip -l mcp-tool-dissonance-v1.0.0-podman.zip | tail -1
find /tmp/mcp-dissonance -name '*.go' | xargs wc -l | tail -1
```

---

### TEST_002 — Container Security Posture Verification (P0)
**Propositions:** PROP_004, PROP_005, PROP_006, PROP_007  
**Agent:** AGENT_002  
**Acceptance Criteria:**
- UID = 65532
- Shell (sh/bash) inaccessible
- NoNewPrivs = 1 in /proc/self/status
- CapDrop includes ALL, CapAdd is empty

**Key Commands:**
```bash
podman exec mcp-sec-test id
podman exec mcp-sec-test sh   # must fail
podman inspect mcp-sec-test --format '{{.HostConfig.SecurityOpt}}'
podman exec mcp-sec-test cat /proc/self/status | grep NoNewPrivs
```

---

### TEST_003 — All Deployment Methods Functional (P0)
**Propositions:** PROP_009, PROP_015  
**Agent:** AGENT_003  
**Acceptance Criteria:** All 4 methods produce running container

| Method | Command |
|--------|---------|
| Manual | `podman build -f Containerfile -t mcp-tool-dissonance:1.0.0 .` |
| Script | `./deploy-podman.sh` |
| Compose | `podman-compose up -d` |
| Systemd | `systemctl --user start mcp-dissonance` |

---

### TEST_004 — Podman-Native Feature Verification (P1)
**Propositions:** PROP_008, PROP_010, PROP_014  
**Agent:** AGENT_005  
**Acceptance Criteria:**
- Container runs with podman.socket stopped
- `io.containers.autoupdate=registry` label present
- Quadlet unit registered in systemctl --user

---

### TEST_005 — Attribution & DOI Embedding Verification (P1)
**Propositions:** PROP_011, PROP_012  
**Agent:** AGENT_004  
**Acceptance Criteria:**
- attribution_coverage = 1.0 (all 15 files)
- DOI 10.5281/zenodo.17784838 → HTTP 302/200
- DOI 10.5281/zenodo.17784144 → HTTP 302/200

---

### TEST_006 — Research Reference Resolvability (P1)
**Propositions:** PROP_013  
**Agent:** AGENT_004  
**Acceptance Criteria:**
- arXiv:2604.11322 resolves, title contains alignment terms
- arXiv:2604.11288 resolves, title contains attention terms

---

### TEST_007 — End-to-End Adversarial Replication (P0)
**Propositions:** PROP_001–007, PROP_009, PROP_015  
**Agent:** AGENT_005  
**Acceptance Criteria:**
- Build succeeds from README-PODMAN.md alone
- Security posture passes (all TEST_002 criteria)
- time_to_verified < 30 minutes
- README ambiguities ≤ 2

---

## Governance Artifacts

| Artifact ID | Type | Filename | EU AI Act Mapping |
|-------------|------|----------|-------------------|
| GOV_001 | Telemetry Trace | telemetry/test_run_telemetry.parquet | Annex XI Art. 53 |
| GOV_002 | Decision Log | logs/decision_log.csv | Annex XI Art. 55 |
| GOV_003 | Constraint Violations | logs/constraint_violations.json | Annex XI Art. 9 |

**Retention Policy:** 7 years  
**Access Control:** authenticated_researchers

### Constraint Violation Severity Taxonomy

| Violation Type | Severity | Trigger |
|----------------|----------|---------|
| Security claim failure (PROP_004-007) | critical | Any security prop fails |
| DOI not resolvable (PROP_012) | critical | HTTP != 200/302 |
| Attribution missing (PROP_011) | error | coverage < 1.0 |
| Reference not resolvable (PROP_013) | error | arXiv 404 |
| Count mismatch (PROP_001-003) | error | Exact value differs |
| Deployment partial failure (PROP_009) | warning | 1-3 methods fail |
| README ambiguities > 2 | warning | Documentation defect |

---

## Reproducibility

### Minimum Requirements
- Ubuntu 22.04 LTS
- Podman ≥ 4.0 (4.4+ recommended for Quadlet)
- systemd user session (for TEST_004)
- Outbound HTTPS (for DOI/arXiv resolution)
- 20GB free disk, 4GB RAM

### Recommended (Diamond Vault Edge)
- GTX 1650, Ubuntu 22.04, Podman 4.6
- Matches production target per system context

### Recommended (Swarm Dispatch Cloud)
- GitHub Actions runner + NVIDIA T4
- `podman` available via `sudo apt install podman`

### Exact Replication Steps
```bash
# 1. Download artifact
curl -L https://doi.org/10.5281/zenodo.17784838 -o mcp-tool-dissonance-v1.0.0-podman.zip

# 2. Parse orchestration file
while IFS= read -r line; do
    echo "$line" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r['type'])"
done < mcp-tool-dissonance-v1.0.0-test_orchestration.jsonl

# 3. Launch agents per build_instructions execution_order
# Phase 1: AGENT_001 + AGENT_004 in parallel
# Phase 2: AGENT_002 + AGENT_003 in parallel
# Phase 3: AGENT_005 sequential on clean VM

# 4. Collect artifacts
ls results/ logs/ telemetry/ environment/

# 5. Validate manifest
python3 -c "import json; m=json.load(open('ARTIFACT_MANIFEST.json')); print(m['compliance_attestation'])"
```

---

## Dashboard

Live results at: `https://www.genesisconductor.io/tests/mcp-tool-dissonance-v1.0.0`

**Components:**
- Overview summary card (pass/fail/in-progress counts)
- Proposition status table (15 rows, validation status per prop)
- Security posture badge grid (UID, no-shell, no-new-privs, cap-drop)
- Deployment method matrix (4×3 boolean grid)
- Attribution coverage progress bar (target: 100%)
- Reference resolver link table

**Data Bindings:** Cloudflare D1 (results), R2 (artifacts), KV (metadata)

---

## EU AI Act Compliance Checklist

- [ ] All telemetry traces include device-level attribution
- [ ] Decision logs capture all automated subagent decisions
- [ ] Constraint violations documented with root causes and severity
- [ ] Environment snapshot enables exact replication
- [ ] README_TESTS.md contains all required sections
- [ ] ARTIFACT_MANIFEST.json checksums match actual files
- [ ] 7-year retention policy configured on R2 bucket
- [ ] Dashboard deployed and accessible
- [ ] EU AI Act compliance mapping complete for all 3 governance artifacts
