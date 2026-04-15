# LidLift Skills - Installation & Integration Guide

Quick guide for loading and using LidLift demonstration skills in agent platforms.

## Prerequisites

- Agent platform that supports skill loading (Claude Desktop, OpenCode, etc.)
- `gh` CLI installed (for `gh-repo-clone` skill)
- Optional: LidLift MCP server running for live analysis

## Installation Methods

### Method 1: Direct File Reference

**Claude Desktop / MCP-compatible platforms:**

1. Add to your platform's skill configuration:

```json
{
  "skills": [
    {
      "name": "gh-repo-clone",
      "path": "/path/to/LidLift MCP/skills/gh-repo-clone/SKILL.md"
    }
  ]
}
```

2. Restart your agent platform to load the skill

### Method 2: Clone Repository

```bash
# Clone the LidLift repository
git clone https://github.com/your-org/lidlift
cd lidlift

# Skills are in ./skills/ directory
ls skills/
# Output: catalog.json  gh-repo-clone/

# Reference the skill path in your platform config
```

### Method 3: Catalog-based Loading

If your platform supports skill catalogs:

```json
{
  "skillCatalogs": [
    {
      "path": "/path/to/LidLift MCP/skills/catalog.json"
    }
  ]
}
```

The catalog will auto-discover all skills in the directory.

## Verification

### Test Skill Loading

Open your agent platform and try these prompts:

**Should trigger gh-repo-clone skill:**
- "Clone the anthropics/skills repo to my machine"
- "Get me a local copy of the code from github.com/user/repo"
- "I need to work with the source code from that repository"

**Should NOT trigger (and should suggest alternatives):**
- "Show me the README from anthropics/skills"
- "What files are in that repo?"
- "Search for 'mcp' in the codebase"

### Check Skill Activation

Most platforms show which skills were activated. Look for:
- Skill name: `gh-repo-clone`
- Trigger confirmation in logs/UI
- Alternative tool recommendations for mismatched prompts

## Integration with LidLift MCP Server

For live tool-dissonance analysis (optional):

### 1. Start MCP Server

```bash
cd /path/to/LidLift MCP
pnpm dev:mcp
# Server runs on http://localhost:8787/mcp
```

### 2. Configure Agent Platform

Add LidLift MCP server to your platform's MCP client config:

```json
{
  "mcpServers": {
    "lidlift": {
      "url": "http://localhost:8787/mcp",
      "transport": "http"
    }
  }
}
```

### 3. Use MCP Tools

The skill will now have access to:
- `analyze_tool_fit`: Score single tool-prompt alignment
- `rank_tools`: Rank catalog of tools by dissonance

Example agent usage:
```
User: "Clone the anthropics/skills repo"

Agent (with MCP): 
1. Skill triggers (gh-repo-clone)
2. Calls analyze_tool_fit via MCP
3. Gets dissonance score: 12% (low risk)
4. Proceeds with clone operation
```

## Production Deployment

### Deploy MCP Server to Cloudflare

```bash
cd workers/mcp
pnpm deploy
# Note the resulting URL: https://your-worker.workers.dev/mcp
```

### Update Skill Configuration

```json
{
  "mcpServers": {
    "lidlift": {
      "url": "https://your-worker.workers.dev/mcp",
      "transport": "http"
    }
  }
}
```

## Testing & Evaluation

### Run Evaluation Suite

```bash
cd /path/to/LidLift MCP/skills/gh-repo-clone

# View test cases
cat eval-queries.json | jq '.[] | {query, should_trigger}'

# Manual testing:
# 1. Try each query 3 times
# 2. Record trigger rate (did skill activate?)
# 3. Target: >90% accuracy
```

### Expected Results

| Category | Should Trigger | Count |
|----------|----------------|-------|
| Clone/download intents | Yes | 12 |
| View/read intents | No | 8 |
| **Total** | — | **20** |

**Success criteria:**
- True positives: ≥11/12 (92%)
- True negatives: ≥7/8 (88%)
- Overall accuracy: ≥18/20 (90%)

## Troubleshooting

### Skill Not Triggering

**Symptom**: Prompts like "clone the repo" don't activate the skill

**Solutions**:
1. Check skill path in config is correct
2. Verify SKILL.md has valid YAML frontmatter (run `head -20 SKILL.md`)
3. Restart agent platform after config changes
4. Check platform logs for skill loading errors

### False Positives

**Symptom**: Skill triggers for "show me the README" (should NOT trigger)

**Solutions**:
1. Review `description` field in SKILL.md frontmatter
2. Ensure exclusions are clear: "DO NOT trigger for: viewing repo metadata, reading individual files..."
3. Test with eval-queries.json to measure accuracy
4. Iterate on description wording if <90% accuracy

### MCP Connection Failed

**Symptom**: Skill works but MCP tools unavailable

**Solutions**:
1. Verify MCP server is running: `curl http://localhost:8787/health`
2. Check MCP server URL in agent config
3. Ensure firewall allows connections to MCP server
4. Review MCP server logs for errors

## Advanced Configuration

### Custom Skill Variants

Create your own tool-dissonance skills:

```bash
# Copy template
cp -r skills/gh-repo-clone skills/my-new-skill

# Edit SKILL.md
vim skills/my-new-skill/SKILL.md
# 1. Update frontmatter (name, description, tags)
# 2. Modify workflow for your tool
# 3. Add examples specific to your use case

# Add to catalog.json
vim skills/catalog.json
# Add new skill entry to "skills" array
```

### Combine Multiple Skills

Load all LidLift skills at once:

```json
{
  "skills": [
    {"path": "/path/to/lidlift/skills/gh-repo-clone/SKILL.md"},
    {"path": "/path/to/lidlift/skills/gh-search-code/SKILL.md"},
    {"path": "/path/to/lidlift/skills/npm-install/SKILL.md"}
  ]
}
```

Skills will co-exist and trigger based on their respective descriptions.

## Support

- **Documentation**: See `/README.md` and skill-specific `/skills/*/README.md`
- **Issues**: Report bugs or request features in the LidLift repository
- **Examples**: Check `/skills/*/references/` for detailed scoring examples

## License

All LidLift skills are licensed under Apache-2.0.
