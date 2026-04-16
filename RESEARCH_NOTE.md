---
title: "LidLift: Pre-Execution Tool-Fit Guardrails for MCP Agents"
authors: "Igor Holt"
date: 2026-04-15
arxiv:
tags: [agents, mcp, tool-safety, ai-infrastructure]
layout: modern
---

# LidLift: Pre-Execution Tool-Fit Guardrails for MCP Agents

Igor Holt

2026-04-15

[Code](https://github.com/igor-holt/lidlift-mcp) · [Web](https://lidlift.optimizationinversion.com) · [MCP API](https://api.optimizationinversion.com/mcp)

---

## Abstract

LidLift is a production tool-routing safety layer for MCP-based agents. It scores prompt-to-tool fit before execution, converts that score into one of four operator-facing decisions (`allow`, `review`, `clarify`, or `block`), and exposes the same analyzer through both a web console and a remote MCP endpoint. This note summarizes the problem class, the decision model, the runtime split, and the operational lessons from shipping the system on public domains.

---

## 1. Introduction

Tool-enabled agents fail in a specific and expensive way: they often select a tool that is structurally compatible with the prompt even when the tool is semantically wrong for the user intent. In practice, that means a read intent can drift into a write tool, a documentation lookup can drift into repository mutation, or an exploratory task can drift into a destructive API call.

LidLift addresses that failure mode before execution rather than after tracing. The system does not try to replace the model. It adds a deterministic guardrail layer in front of tool invocation.

---

## 2. Problem Statement

The problem is not only whether a model can call tools. The harder problem is whether it should call a given tool at all.

Three patterns matter most:

1. Irrelevant tool selection when a model can still fill the arguments.
2. Overlapping tool catalogs where several tools look superficially valid.
3. Read versus write mismatches where the selected tool carries materially higher operational risk than the user intent requires.

The product goal is therefore simple: reject the wrong tool early, rank the safer alternatives, and make that decision legible to both humans and agents.

---

## 3. Decision Model

LidLift evaluates prompt-tool fit in a shared core package and emits:

- `alignmentScore`
- `dissonanceScore`
- `riskLevel`
- `guardrailDecision`
- `guardrailReason`
- `recommendation`

The decision model uses four gates:

1. `allow` when the tool is a strong fit and the operational mode matches the prompt.
2. `review` when the tool may work but carries meaningful mismatch or risk signals.
3. `clarify` when the prompt lacks enough specificity to justify execution.
4. `block` when the tool is operationally wrong, especially for read-versus-write conflicts.

This matters because a ranked list alone is not enough. Operators and external agents need an explicit pre-execution control surface, not just a softer recommendation.

---

## 4. System Architecture

LidLift ships as a split runtime:

- `packages/core`: shared heuristics, schemas, and ranking logic
- `apps/web`: Next.js operator console on Vercel
- `workers/mcp`: Cloudflare Worker exposing remote MCP tools on `/mcp`

The same analyzer is reused across:

- the browser console
- the web API (`/api/analyze`)
- the MCP tools (`analyze_tool_fit`, `rank_tools`)

That shared contract keeps human review and agent integration aligned.

---

## 5. Deployment Notes

The public deployment is live at:

- Web console: `https://lidlift.optimizationinversion.com`
- API health: `https://api.optimizationinversion.com/health`
- MCP endpoint: `https://api.optimizationinversion.com/mcp`

Two operational lessons were especially important:

1. Public launch assets must match the real domains. Stale preview or `workers.dev` URLs create avoidable trust and onboarding failures.
2. The MCP server lifecycle must match the runtime model. In a stateless Cloudflare Worker, the `McpServer` instance must be created per request; reusing a singleton across transports causes production failures.

---

## 6. Verification

The current production stack was validated with:

- `pnpm --filter web lint`
- `pnpm build`
- `pnpm --filter mcp test`
- `pnpm --filter mcp check`

The live checks that matter are:

- `GET /health` on the web app
- `GET /health` on the MCP Worker
- `GET /mcp` with `Accept: text/event-stream`

These checks verify both the operator surface and the external agent surface.

---

## 7. Limitations

LidLift is deliberately narrow.

- It is a pre-execution control layer, not a full trace/observability platform.
- It does not yet include a benchmark harness published with public scoreboards.
- The optional OpenAI narrative layer is disabled in production until a production `OPENAI_API_KEY` is configured.
- Hugging Face publication is not yet live because there is no paper page or Hub-authenticated publication flow configured in this repository.

---

## 8. Conclusion

LidLift shows that the highest-leverage safety improvement for tool-using agents is often not better post-hoc analysis, but a stricter decision before execution. By exposing that decision as a shared contract across web, API, and MCP surfaces, the product turns tool-choice quality into an explicit control plane instead of an implicit model behavior.

The next step is straightforward: publish a benchmark-backed evaluation layer around the guardrail decisions and connect the public research artifact to the live product surface.
