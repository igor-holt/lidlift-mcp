# Alternative Tools Reference

This reference provides a comprehensive guide to GitHub CLI alternatives when `gh repo clone` is not the right fit.

## Decision Matrix

| Goal | Best Tool | Dissonance vs Clone | Example |
|------|-----------|---------------------|---------|
| View README/docs | `gh repo view` | High (65-75%) | `gh repo view owner/repo --web` |
| Read single file | `gh api` | High (70-80%) | `gh api repos/owner/repo/contents/path/file.md` |
| Get repo metadata | `gh repo view --json` | Critical (85-95%) | `gh repo view owner/repo --json name,description,stars` |
| Search code | `gh search code` | Critical (88-98%) | `gh search code --repo owner/repo "pattern"` |
| Fork repo | `gh repo fork` | Moderate (40-50%) | `gh repo fork owner/repo --clone` |
| List branches | `gh api` | High (72-82%) | `gh api repos/owner/repo/branches` |
| Get commit history | `gh api` | High (68-78%) | `gh api repos/owner/repo/commits` |
| Clone for dev | `gh repo clone` | Low (8-15%) | `gh repo clone owner/repo` |
| Download archive | `wget` + GitHub API | Moderate (35-45%) | `wget https://github.com/owner/repo/archive/main.zip` |

## Tool Details

### `gh repo view`

**Best for**: Viewing repository information without downloading

**Operation mode**: Read-only

**Use cases**:
- Quick README preview
- Repository stats and metadata
- Opening repo in browser
- Checking repo description/topics

**Examples**:
```bash
# View README in terminal
gh repo view anthropics/skills

# Open in browser
gh repo view anthropics/skills --web

# Get JSON metadata
gh repo view anthropics/skills --json name,description,stars,forks
```

**When clone would score high dissonance**: Any prompt with "show", "view", "check", "what's", "list" indicators

---

### `gh api`

**Best for**: Fetching specific repository data via GitHub REST API

**Operation mode**: Read-only

**Use cases**:
- Reading file contents
- Getting branch lists
- Fetching commit history
- Accessing any GitHub API endpoint

**Examples**:
```bash
# Read file contents
gh api repos/anthropics/skills/contents/README.md | jq -r .content | base64 -d

# List branches
gh api repos/anthropics/skills/branches --jq '.[].name'

# Get recent commits
gh api repos/anthropics/skills/commits --jq '.[] | {sha: .sha, message: .commit.message}'

# Check if file exists
gh api repos/anthropics/skills/contents/package.json --jq .name
```

**When clone would score high dissonance**: Prompts asking for specific files, metadata, or API data

---

### `gh search code`

**Best for**: Finding code patterns across repositories without cloning

**Operation mode**: Read-only

**Use cases**:
- Searching for function definitions
- Finding usage examples
- Locating configuration patterns
- Code discovery

**Examples**:
```bash
# Search within specific repo
gh search code --repo anthropics/skills "SKILL.md"

# Search with language filter
gh search code --repo owner/repo "function analyze" --language typescript

# Search for file names
gh search code --repo owner/repo "filename:package.json"
```

**When clone would score high dissonance**: Any prompt with "search", "find", "where is" indicators

---

### `gh repo fork`

**Best for**: Creating a fork with optional clone

**Operation mode**: Write (creates fork) + optional local clone

**Use cases**:
- Contributing to open source
- Experimenting with changes
- Creating personal copy

**Examples**:
```bash
# Fork and clone in one command
gh repo fork anthropics/skills --clone

# Fork only (no clone)
gh repo fork anthropics/skills

# Fork with custom name
gh repo fork anthropics/skills --fork-name my-skills-fork --clone
```

**When clone would score moderate dissonance**: Prompts about "forking" or "contributing" (fork+clone is better)

---

### `wget` / `curl` (GitHub Archive)

**Best for**: Downloading repository snapshot without git history

**Operation mode**: Read (downloads files)

**Use cases**:
- Quick code inspection without git
- CI/CD pipelines needing source only
- Minimal disk space usage

**Examples**:
```bash
# Download main branch as zip
wget https://github.com/anthropics/skills/archive/refs/heads/main.zip

# Download and extract
curl -L https://github.com/anthropics/skills/archive/main.tar.gz | tar xz

# Download specific release
wget https://github.com/owner/repo/archive/refs/tags/v1.0.0.zip
```

**When clone would score moderate dissonance**: Prompts about "downloading" without mentioning development/modification

---

## Dissonance Scoring Examples

### High Dissonance Scenarios

**Prompt**: "Show me the README from anthropics/skills"
- Clone dissonance: **65%** (read intent, write tool)
- Better tool: `gh repo view anthropics/skills`
- Alternative dissonance: **8%** (read intent, read tool)

**Prompt**: "What's in the package.json file?"
- Clone dissonance: **72%** (single file read)
- Better tool: `gh api repos/owner/repo/contents/package.json`
- Alternative dissonance: **12%**

**Prompt**: "Search for 'MCP' in the codebase"
- Clone dissonance: **88%** (search operation)
- Better tool: `gh search code --repo owner/repo "MCP"`
- Alternative dissonance: **5%**

### Low Dissonance Scenarios

**Prompt**: "Clone the repo so I can work on it locally"
- Clone dissonance: **12%** (perfect fit)
- No alternative needed

**Prompt**: "I need a local copy for development"
- Clone dissonance: **18%** (clear dev intent)
- No alternative needed

### Moderate Dissonance Scenarios

**Prompt**: "Get the code from that repo"
- Clone dissonance: **42%** (ambiguous intent)
- Should clarify: clone vs. view vs. download archive?

**Prompt**: "Fork anthropics/skills"
- Clone dissonance: **48%** (fork is separate operation)
- Better tool: `gh repo fork anthropics/skills --clone`
- Alternative dissonance: **15%**

---

## Migration Paths

If a user has already cloned but actually needed read-only access:

```bash
# Remove unnecessary clone
cd ..
rm -rf repo-name

# Use appropriate read-only alternative
gh repo view owner/repo              # For README/metadata
gh api repos/owner/repo/contents/... # For specific files
gh repo view owner/repo --web        # For browser viewing
```

## Performance Comparison

| Tool | Disk Usage | Network | Time (typical) |
|------|------------|---------|----------------|
| `gh repo clone` | Full repo + history | High | 5-60s |
| `gh repo view` | None | Low | <1s |
| `gh api` | None | Low | <1s |
| `gh search code` | None | Low | 1-3s |
| Archive download | Source only | Medium | 2-10s |

**Rule of thumb**: If you don't need to make commits, don't clone.
