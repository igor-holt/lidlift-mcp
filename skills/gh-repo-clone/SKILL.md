---
name: gh-repo-clone
description: >
  Analyze whether 'gh repo clone' is the right tool before cloning GitHub repositories. 
  Use when the user wants to clone, download, or get a local copy of a GitHub repository, 
  even if they don't explicitly say "clone" (e.g., "get the code from anthropics/skills", 
  "I need a local copy of that repo", "download the repository to work on it"). This skill 
  scores tool-prompt alignment, detects mismatches (e.g., clone when user only wants to 
  read a file), and suggests safer alternatives like 'gh repo view' or 'gh api' when 
  appropriate. DO NOT trigger for: viewing repo metadata, reading individual files, 
  searching code, or fork/pull request operations.
license: Apache-2.0
metadata:
  author: LidLift
  version: "1.0.0"
  category: developer-tools
  tags: ["github", "git", "cli", "tool-dissonance", "mcp"]
  complexity: intermediate
compatibility: Requires gh CLI. LidLift MCP server optional for live analysis.
---

# gh-repo-clone

Prevent misuse of `gh repo clone` by analyzing tool-prompt fit before execution. This skill demonstrates LidLift's tool-dissonance analysis—a launch-ready product that scores alignment, detects destructive mismatches, and ranks safer alternatives.

## When to Use This Skill

Use this skill when a prompt involves:
- Cloning or downloading a GitHub repository to work locally
- Getting a local copy of repository code for development
- Setting up a repository on your machine
- User says "get the code", "download repo", or "need a local copy"

DO NOT use this skill for:
- Viewing repository information (use `gh repo view`)
- Reading individual files (use `gh api` or GitHub web interface)
- Searching repository code (use GitHub search or `gh search`)
- Creating pull requests, managing issues, or fork operations

## Gotchas

- **"Get the code" is ambiguous**: Users often say "get the code" when they mean "show me the README" or "view the source file". This is a READ operation, not a clone/WRITE operation. Always check intent first.
- **Clone creates local state**: `gh repo clone` creates a local directory and downloads all repository history. If the user only needs to inspect one file, recommend `gh api` or `gh repo view` instead.
- **Authentication requirements**: Private repositories require gh CLI authentication that may not be configured. Check auth status before proceeding with clone operations.
- **Disk space considerations**: Large repositories can consume significant disk space. For quick inspections, suggest read-only alternatives.

## Workflow

**Phase 1: Parse Intent**
1. Analyze the prompt for operation indicators:
   - CLONE triggers: "local copy", "work on", "develop", "modify", "download repo"
   - READ triggers: "show me", "view", "what's in", "read", "check"
2. Detect domain keywords: git, github, repository, code, source

**Phase 2: Score Tool-Prompt Fit**
1. Calculate lexical overlap between prompt and tool description
2. Measure domain alignment (git/github keywords)
3. Check operation alignment (read vs. write intent)
4. Compute dissonance score: `1 - (lexical×0.35 + domain×0.4 + operation×0.25)`

**Phase 3: Detect Destructive Mismatches**
1. If prompt shows READ intent AND tool is WRITE operation → **critical risk**
2. Apply penalties for domain drift and operation conflicts
3. Calculate final risk level: low/moderate/high/critical

**Phase 4: Recommend Action**
- **Dissonance < 30%** (low risk): Proceed with `gh repo clone`
- **Dissonance 30-60%** (moderate): Suggest review or ask for clarification
- **Dissonance 60-75%** (high): Recommend safer alternative (see table below)
- **Dissonance > 75%** or destructive mismatch (critical): Block and redirect

## Alternative Tool Recommendations

| User Intent | Wrong Tool | Right Tool | Reason |
|-------------|------------|------------|--------|
| View README | `gh repo clone` | `gh repo view owner/repo` | Read-only, no local state |
| Read one file | `gh repo clone` | `gh api repos/owner/repo/contents/path` | Fetches single file |
| Check repo info | `gh repo clone` | `gh repo view owner/repo --json` | Metadata only |
| Search code | `gh repo clone` | `gh search code --repo owner/repo` | No download needed |
| Fork for PR | `gh repo clone` | `gh repo fork owner/repo --clone` | Creates fork + clone |

## Example Analyses

### Example 1: High Dissonance (Should Block)

**Prompt**: "Show me the README from the anthropics/skills repo"

**Analysis**:
- Prompt operation: **read** (indicators: "show me")
- Tool operation: **write** (clone creates local copy)
- Lexical overlap: 42% (shared: "repo", "skills")
- Domain alignment: 75% (both GitHub/git domain)
- Operation alignment: 0% (read vs. write conflict)
- **Dissonance score: 65%** (high risk)
- **Risk level: moderate** (destructive mismatch detected)

**Recommendation**: "Gate this tool behind review and provide a better-matched option."

**Better Alternative**: 
```bash
gh repo view anthropics/skills --web
# Opens README in browser, read-only
```

---

### Example 2: Low Dissonance (Should Proceed)

**Prompt**: "Clone the anthropics/skills repo so I can try the examples locally"

**Analysis**:
- Prompt operation: **write** (indicators: "clone", "locally", "try examples")
- Tool operation: **write**
- Lexical overlap: 68% (shared: "clone", "repo", "skills")
- Domain alignment: 100% (perfect GitHub/git match)
- Operation alignment: 100% (write matches write)
- **Dissonance score: 12%** (low risk)
- **Risk level: low**

**Recommendation**: "This tool is a reasonable fit for the prompt."

**Action**: Proceed with clone
```bash
gh repo clone anthropics/skills
cd skills
# Ready to work with examples
```

---

### Example 3: Moderate Dissonance (Suggest Alternative)

**Prompt**: "Get me the code from the LidLift repo"

**Analysis**:
- Prompt operation: **ambiguous** ("get the code" could mean clone OR view)
- Tool operation: **write**
- Lexical overlap: 48%
- Domain alignment: 60%
- Operation alignment: 50% (ambiguous intent)
- **Dissonance score: 42%** (moderate risk)
- **Risk level: moderate**

**Recommendation**: "Gate this tool behind review and provide a better-matched option."

**Better Approach**: Ask for clarification
```
Do you want to:
1. Clone the repository to work on it locally? → gh repo clone
2. View the repository structure and files? → gh repo view --web
3. Read a specific file? → gh api repos/.../contents/...
```

## LidLift MCP Tools

This skill demonstrates two MCP tools from the full LidLift product:

### `analyze_tool_fit`
Score how well a single tool matches a prompt and identify mismatches before execution.

**Input**:
- `prompt` (string): The user's request
- `tool` (ToolCandidate): Tool metadata including name, description, category, operationMode, capabilities, tags

**Output**:
- `alignmentScore` (0-1): How well the tool matches the prompt
- `dissonanceScore` (0-1): Inverse of alignment (1 = complete mismatch)
- `riskLevel`: low | moderate | high | critical
- `recommendation`: Human-readable guidance
- `signals`: Detailed explanation of scoring factors
- `matchedDomains`, `mismatchedDomains`, `matchedOperations`, `conflictingOperations`

### `rank_tools`
Rank a catalog of tools by dissonance for a given prompt and return the safest candidate first.

**Input**:
- `prompt` (string): The user's request
- `tools` (ToolCandidate[]): Array of candidate tools (max 50)

**Output**:
- `best` (AnalysisResult | null): Lowest dissonance tool
- `ranked` (AnalysisResult[]): All tools sorted by dissonance (ascending)

## Integration Examples

### Example 1: Analyze Single Tool (TypeScript)

```typescript
import { analyzeToolFit } from "@tool-dissonance/core";

const result = analyzeToolFit({
  prompt: "Show me the README from anthropics/skills",
  tool: {
    name: "gh_repo_clone",
    description: "Clone a GitHub repository to local machine",
    category: "git",
    operationMode: "write",
    capabilities: ["clone repository", "create local copy"],
    tags: ["github", "git", "clone"],
  },
});

console.log(result);
// {
//   dissonanceScore: 0.65,
//   riskLevel: "moderate",
//   recommendation: "Gate this tool behind review...",
//   signals: [
//     { label: "Write-risk mismatch", impact: "negative", ... },
//     { label: "Domain match", impact: "positive", ... }
//   ],
//   ...
// }
```

### Example 2: Rank Multiple Tools (MCP Client)

```javascript
// Using LidLift MCP server (Cloudflare Worker)
const response = await fetch("https://your-worker.workers.dev/mcp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "rank_tools",
      arguments: {
        prompt: "Get me a local copy of the anthropics/skills repo",
        tools: [
          {
            name: "gh_repo_clone",
            description: "Clone repository to local machine",
            operationMode: "write",
            // ...
          },
          {
            name: "gh_repo_view",
            description: "View repository details without cloning",
            operationMode: "read",
            // ...
          },
          {
            name: "gh_api",
            description: "Fetch repository data via GitHub API",
            operationMode: "read",
            // ...
          }
        ]
      }
    },
    id: 1
  })
});

const { result } = await response.json();
console.log(result.best.tool.name); // "gh_repo_clone" (12% dissonance)
console.log(result.ranked.map(r => r.tool.name));
// ["gh_repo_clone", "gh_repo_view", "gh_api"]
```

### Example 3: Pre-execution Validation (Python)

```python
import requests

def should_execute_clone(prompt: str) -> dict:
    """Check if gh repo clone is safe for the given prompt."""
    
    response = requests.post(
        "https://your-worker.workers.dev/mcp",
        json={
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "analyze_tool_fit",
                "arguments": {
                    "prompt": prompt,
                    "tool": {
                        "name": "gh_repo_clone",
                        "description": "Clone a GitHub repository to local machine",
                        "category": "git",
                        "operationMode": "write",
                        "capabilities": ["clone repository", "create local copy"],
                        "tags": ["github", "git", "clone"]
                    }
                }
            },
            "id": 1
        }
    )
    
    result = response.json()["result"]["structuredContent"]
    
    return {
        "safe_to_execute": result["dissonanceScore"] < 0.3,
        "risk_level": result["riskLevel"],
        "recommendation": result["recommendation"],
        "alternative": suggest_alternative(result) if result["dissonanceScore"] > 0.3 else None
    }

# Usage
check = should_execute_clone("Show me the README from anthropics/skills")
print(check)
# {
#   "safe_to_execute": False,
#   "risk_level": "moderate",
#   "recommendation": "Gate this tool behind review...",
#   "alternative": "gh repo view anthropics/skills"
# }
```

## Quick Reference

### Common Prompts & Recommended Actions

| User Says | Dissonance | Action | Command |
|-----------|------------|--------|---------|
| "Clone the repo for local dev" | Low (12%) | ✅ Proceed | `gh repo clone owner/repo` |
| "Get me a local copy to work on" | Low (18%) | ✅ Proceed | `gh repo clone owner/repo` |
| "Download the repository" | Low (22%) | ✅ Proceed | `gh repo clone owner/repo` |
| "Show me the code" | Moderate (42%) | ⚠️ Clarify | Ask: clone or view? |
| "Get the code from that repo" | Moderate (45%) | ⚠️ Clarify | Ask: clone or view? |
| "Show me the README" | High (65%) | ❌ Block | `gh repo view --web` |
| "What's in the config file?" | High (72%) | ❌ Block | `gh api repos/.../contents/config` |
| "View the repo structure" | Critical (88%) | ❌ Block | `gh repo view` or GitHub web |

### Risk Level Decision Tree

```
Dissonance Score Ranges:
├─ 0-30%   → Low risk      → Proceed with clone
├─ 30-45%  → Moderate risk → Suggest review or ask clarification
├─ 45-75%  → High risk     → Recommend safer alternative
└─ 75-100% → Critical risk → Block execution, redirect to read-only tool

Destructive Mismatch Override:
└─ If READ intent + WRITE tool → Automatic "Critical" risk
```

### Scoring Formula

```
Alignment = (lexical_overlap × 0.35) + (domain_alignment × 0.4) + (operation_alignment × 0.25)
            - mismatch_penalty - destructive_penalty + domain_match_bonus

Where:
- lexical_overlap   = Jaccard similarity of prompt tokens vs. tool tokens
- domain_alignment  = Matched domains / total unique domains
- operation_alignment = Matched operations / total unique operations
- mismatch_penalty  = 0.12 if mismatched domains exist
- destructive_penalty = 0.25 if READ prompt + WRITE tool
- domain_match_bonus = 0.05 if any domain matches

Dissonance = 1 - Alignment
```

## About LidLift

**LidLift** is a launch-ready tool-dissonance product for MCP stacks. It prevents costly misexecutions by scoring prompt-to-tool fit before agents invoke tools.

### Full Product Stack

- **`packages/core`**: Shared heuristics, schemas, and analysis engine
- **`apps/web`**: Next.js operator console (Vercel) with live preview and ranked results
- **`workers/mcp`**: Cloudflare Worker exposing remote MCP tools on `/mcp`
- **OpenAI Responses API**: Optional narrative briefing layer for explainability

### Live Endpoints

- **Web Console**: Interactive UI with risk labels and alternative suggestions
- **`POST /api/analyze`**: Deterministic ranking + optional OpenAI narrative
- **`GET /api/health`**: Web readiness checks
- **`POST /mcp`**: Remote MCP transport (HTTP streaming)

### Try the Full Product

1. **Local Development**:
   ```bash
   git clone https://github.com/your-org/lidlift
   cd lidlift
   pnpm install
   pnpm dev:web    # Start Next.js console
   pnpm dev:mcp    # Start MCP server
   ```

2. **Deploy to Production**:
   - **Vercel (Web)**: Import `apps/web`, add `OPENAI_API_KEY` and `NEXT_PUBLIC_MCP_SERVER_URL`
   - **Cloudflare (MCP)**: `pnpm --filter mcp deploy`, use resulting URL

3. **Integrate via MCP**:
   ```bash
   # Add to your MCP client config
   {
     "mcpServers": {
       "lidlift": {
         "url": "https://your-worker.workers.dev/mcp",
         "transport": "http"
       }
     }
   }
   ```

### Links

- **Documentation**: See `/README.md` in the LidLift repository
- **Source Code**: Core analysis logic at `/packages/core/src/analyze.ts`
- **Sample Catalog**: Example tools at `/packages/core/src/catalog.ts`
- **API Reference**: Web routes at `/apps/web/app/api/`
- **MCP Server**: Worker implementation at `/workers/mcp/src/index.ts`

---

## License

Apache-2.0

## Contributing

This skill is a demonstration of LidLift's capabilities. To contribute to the full product or report issues, see the LidLift repository.
