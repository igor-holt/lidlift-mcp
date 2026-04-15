# gh-repo-clone Skill

A demonstration skill for the LidLift tool-dissonance product. Shows how to analyze `gh repo clone` tool-prompt fit before execution.

## Directory Structure

```
gh-repo-clone/
├── SKILL.md                      # Main skill instructions (SEO-optimized)
├── README.md                     # This file
├── eval-queries.json             # Evaluation test cases (20 queries)
└── references/
    ├── alternatives.md           # Detailed alternative tool guide
    └── analysis-examples.md      # Step-by-step scoring breakdowns
```

## Quick Start

Load this skill in your agent platform:

```bash
# Example: Claude Desktop MCP config
{
  "skills": [
    {
      "path": "/path/to/skills/gh-repo-clone/SKILL.md"
    }
  ]
}
```

## Evaluation

Test trigger accuracy:

```bash
# Run 3x per query in eval-queries.json
# Measure: should_trigger true positives + false negatives
# Target: >90% accuracy

# Expected results:
# - 12 queries should trigger (clone/download/local copy intents)
# - 8 queries should NOT trigger (view/read/metadata intents)
```

## SEO Optimizations Applied

1. **Description field** (580 chars):
   - ✅ Describes WHAT and WHEN to use
   - ✅ Includes implicit triggers ("get the code", "local copy")
   - ✅ Addresses exclusions (prevents false triggers)
   - ✅ Uses imperative phrasing

2. **Structure**:
   - ✅ "When to Use" section (increases precision)
   - ✅ "Gotchas" section (reduces false positives)
   - ✅ Progressive disclosure (core + references)
   - ✅ Quick reference tables

3. **Metadata**:
   - ✅ License, author, version, category, tags
   - ✅ Compatibility requirements

4. **Examples**:
   - ✅ 3 detailed analysis examples
   - ✅ Multi-language integration samples
   - ✅ Decision trees and scoring formulas

## Skill Registry Visibility

**Discovery mechanism**: Progressive disclosure via description matching
- No centralized SEO ranking
- Runtime matching against user prompts
- Optimized for high precision (low false positives) and recall (high true positives)

**Trigger diversity tested**:
- Direct: "clone", "gh repo clone"
- Implicit: "get the code", "download repo", "local copy"
- Task-based: "work on locally", "set up dev environment"
- Exclusions: "show", "view", "read", "search" (prevents misfires)

## License

Apache-2.0

## Related

- **Full Product**: `/Users/igorholt/LidLift MCP`
- **Core Analysis**: `/Users/igorholt/LidLift MCP/packages/core/src/analyze.ts`
- **MCP Server**: `/Users/igorholt/LidLift MCP/workers/mcp/src/index.ts`
