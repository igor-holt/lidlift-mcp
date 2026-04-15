# Analysis Examples

Detailed scoring breakdowns for the LidLift tool-dissonance analysis engine applied to `gh repo clone` scenarios.

## Scoring Components

All examples use this formula:

```
Alignment = (lexical × 0.35) + (domain × 0.4) + (operation × 0.25) - penalties + bonuses

Where:
- lexical   = Jaccard similarity of tokenized prompt vs. tool description
- domain    = matched_domains / unique_domains
- operation = matched_operations / unique_operations
- penalties = mismatch_penalty (0.12) + destructive_penalty (0.25)
- bonuses   = domain_match_bonus (0.05)

Dissonance = 1 - Alignment
Risk Level = low (<30%) | moderate (30-60%) | high (60-75%) | critical (>75% or destructive)
```

---

## Example 1: Perfect Fit (Low Dissonance)

### Prompt
"Clone the anthropics/skills repository to my local machine"

### Tool Definition
```json
{
  "name": "gh_repo_clone",
  "description": "Clone a GitHub repository to local machine for development",
  "category": "git",
  "operationMode": "write",
  "capabilities": ["clone repository", "create local copy", "download repo"],
  "tags": ["github", "git", "clone", "local"]
}
```

### Tokenization
**Prompt tokens**: `["clone", "anthropics", "skills", "repository", "local", "machine"]`
**Tool tokens**: `["clone", "github", "repository", "local", "machine", "development", "create", "copy", "download", "repo", "git"]`

### Domain Detection
**Prompt domains**: `["git"]` (keywords: "clone", "repository")
**Tool domains**: `["git"]` (keywords: "clone", "repository", "github")
**Matched domains**: `["git"]`
**Mismatched domains**: `[]`

### Operation Detection
**Prompt operations**: `["write"]` (keywords: "clone")
**Tool operations**: `["write"]` (explicit operationMode)
**Matched operations**: `["write"]`
**Conflicting operations**: `[]`

### Scoring Calculation
1. **Lexical overlap** (Jaccard):
   - Intersection: `["clone", "repository", "local", "machine"]` = 4 tokens
   - Union: 13 unique tokens
   - Jaccard = 4/13 = **0.308**

2. **Domain alignment**:
   - Matched: 1, Total unique: 1
   - Domain = 1/1 = **1.0**

3. **Operation alignment**:
   - Matched: 1, Total unique: 1
   - Operation = 1/1 = **1.0**

4. **Penalties**:
   - Mismatch penalty: 0 (no mismatched domains)
   - Destructive penalty: 0 (no read/write conflict)

5. **Bonuses**:
   - Domain match bonus: 0.05 (git domain matched)

6. **Final alignment**:
   ```
   Alignment = (0.308 × 0.35) + (1.0 × 0.4) + (1.0 × 0.25) + 0.05
             = 0.108 + 0.4 + 0.25 + 0.05
             = 0.808
   ```

7. **Dissonance**: `1 - 0.808 = 0.192` (**19.2%**)

### Result
- **Risk level**: Low
- **Recommendation**: "This tool is a reasonable fit for the prompt."
- **Signals**:
  - ✅ Shared vocabulary (31% lexical similarity) - positive
  - ✅ Domain match (git) - positive
  - ✅ Operation fit (write) - positive

---

## Example 2: Destructive Mismatch (Critical Dissonance)

### Prompt
"Show me the README from the anthropics/skills repository"

### Tool Definition
(Same as Example 1)

### Tokenization
**Prompt tokens**: `["show", "readme", "anthropics", "skills", "repository"]`
**Tool tokens**: (same as Example 1)

### Domain Detection
**Prompt domains**: `["git"]` (keyword: "repository")
**Tool domains**: `["git"]`
**Matched domains**: `["git"]`
**Mismatched domains**: `[]`

### Operation Detection
**Prompt operations**: `["read"]` (keyword: "show")
**Tool operations**: `["write"]`
**Matched operations**: `[]`
**Conflicting operations**: `["read"]` ← destructive mismatch!

### Scoring Calculation
1. **Lexical overlap**:
   - Intersection: `["repository"]` = 1 token
   - Union: 15 unique tokens
   - Jaccard = 1/15 = **0.067**

2. **Domain alignment**:
   - Matched: 1, Total: 1
   - Domain = **1.0**

3. **Operation alignment**:
   - Matched: 0, Total: 2
   - Operation = 0/2 = **0.0**

4. **Penalties**:
   - Mismatch penalty: 0
   - **Destructive penalty: 0.25** (read prompt + write tool)

5. **Bonuses**:
   - Domain match bonus: 0.05

6. **Final alignment**:
   ```
   Alignment = (0.067 × 0.35) + (1.0 × 0.4) + (0.0 × 0.25) - 0.25 + 0.05
             = 0.023 + 0.4 + 0 - 0.25 + 0.05
             = 0.223
   ```

7. **Dissonance**: `1 - 0.223 = 0.777` (**77.7%**)

### Result
- **Risk level**: **Critical** (destructive mismatch detected)
- **Recommendation**: "Require explicit approval or choose a read-only tool before execution."
- **Signals**:
  - ⚠️ Shared vocabulary (7% lexical similarity) - neutral
  - ✅ Domain match (git) - positive
  - ❌ **Write-risk mismatch** - negative
  - ❌ Operation conflict (read vs. write) - negative

---

## Example 3: Moderate Ambiguity

### Prompt
"Get me the code from the anthropics/skills repo"

### Tool Definition
(Same as Example 1)

### Tokenization
**Prompt tokens**: `["get", "code", "anthropics", "skills", "repo"]`
**Tool tokens**: (same as Example 1)

### Domain Detection
**Prompt domains**: `["git"]` (keyword: "repo")
**Tool domains**: `["git"]`
**Matched domains**: `["git"]`
**Mismatched domains**: `[]`

### Operation Detection
**Prompt operations**: `["read", "write"]` (ambiguous: "get" could mean view or download)
**Tool operations**: `["write"]`
**Matched operations**: `["write"]`
**Conflicting operations**: `[]` (write is present in both)

### Scoring Calculation
1. **Lexical overlap**:
   - Intersection: `["repo"]` = 1 token
   - Union: 14 unique tokens
   - Jaccard = 1/14 = **0.071**

2. **Domain alignment**:
   - Matched: 1, Total: 1
   - Domain = **1.0**

3. **Operation alignment**:
   - Matched: 1, Total: 2
   - Operation = 1/2 = **0.5**

4. **Penalties**:
   - Mismatch penalty: 0
   - Destructive penalty: 0 (write is in matched operations)

5. **Bonuses**:
   - Domain match bonus: 0.05

6. **Final alignment**:
   ```
   Alignment = (0.071 × 0.35) + (1.0 × 0.4) + (0.5 × 0.25) + 0.05
             = 0.025 + 0.4 + 0.125 + 0.05
             = 0.6
   ```

7. **Dissonance**: `1 - 0.6 = 0.4` (**40%**)

### Result
- **Risk level**: Moderate
- **Recommendation**: "Gate this tool behind review and provide a better-matched option."
- **Signals**:
  - ⚠️ Shared vocabulary (7% lexical similarity) - neutral
  - ✅ Domain match (git) - positive
  - ⚠️ Partial operation fit (write) - neutral

---

## Example 4: Domain Drift

### Prompt
"Clone the weather data from the NOAA API"

### Tool Definition
(Same as Example 1)

### Tokenization
**Prompt tokens**: `["clone", "weather", "data", "noaa", "api"]`
**Tool tokens**: (same as Example 1)

### Domain Detection
**Prompt domains**: `["weather", "api"]` (keywords: "weather", "NOAA", "API")
**Tool domains**: `["git"]`
**Matched domains**: `[]`
**Mismatched domains**: `["weather", "api"]`

### Operation Detection
**Prompt operations**: `["read"]` ("clone" is used colloquially here, but context suggests data retrieval)
**Tool operations**: `["write"]`
**Matched operations**: `[]`
**Conflicting operations**: `["read"]`

### Scoring Calculation
1. **Lexical overlap**:
   - Intersection: `["clone"]` = 1 token
   - Union: 14 unique tokens
   - Jaccard = **0.071**

2. **Domain alignment**:
   - Matched: 0, Total: 3
   - Domain = 0/3 = **0.0**

3. **Operation alignment**:
   - Matched: 0, Total: 2
   - Operation = **0.0**

4. **Penalties**:
   - **Mismatch penalty: 0.12** (2 mismatched domains)
   - **Destructive penalty: 0.25** (read vs. write conflict)

5. **Bonuses**:
   - Domain match bonus: 0 (no matches)

6. **Final alignment**:
   ```
   Alignment = (0.071 × 0.35) + (0.0 × 0.4) + (0.0 × 0.25) - 0.12 - 0.25
             = 0.025 + 0 + 0 - 0.12 - 0.25
             = -0.345 → clamped to 0
   ```

7. **Dissonance**: `1 - 0 = 1.0` (**100%**)

### Result
- **Risk level**: **Critical** (destructive mismatch + domain drift)
- **Recommendation**: "Require explicit approval or choose a read-only tool before execution."
- **Signals**:
  - ⚠️ Shared vocabulary (7% lexical similarity) - neutral
  - ❌ **Domain drift** (weather, api not in tool domains) - negative
  - ❌ **Write-risk mismatch** - negative
  - ❌ No domain matches - negative

---

## Example 5: Fork Scenario (Better Alternative Exists)

### Prompt
"Fork the anthropics/skills repository"

### Tool Definition
(Same as Example 1)

### Tokenization
**Prompt tokens**: `["fork", "anthropics", "skills", "repository"]`
**Tool tokens**: (same as Example 1)

### Domain Detection
**Prompt domains**: `["git"]`
**Tool domains**: `["git"]`
**Matched domains**: `["git"]`
**Mismatched domains**: `[]`

### Operation Detection
**Prompt operations**: `["write"]` (fork creates new repo)
**Tool operations**: `["write"]`
**Matched operations**: `["write"]`
**Conflicting operations**: `[]`

### Scoring Calculation
1. **Lexical overlap**:
   - Intersection: `["repository"]` = 1 token
   - Union: 13 unique tokens
   - Jaccard = **0.077**

2. **Domain alignment**: **1.0**

3. **Operation alignment**: **1.0**

4. **Penalties**: 0

5. **Bonuses**: 0.05

6. **Final alignment**:
   ```
   Alignment = (0.077 × 0.35) + (1.0 × 0.4) + (1.0 × 0.25) + 0.05
             = 0.027 + 0.4 + 0.25 + 0.05
             = 0.727
   ```

7. **Dissonance**: `1 - 0.727 = 0.273` (**27.3%**)

### Result
- **Risk level**: Low (just under moderate threshold)
- **Recommendation**: "This tool is a reasonable fit for the prompt."
- **Better alternative exists**: `gh repo fork --clone` (dissonance: 8%)
- **Signals**:
  - ⚠️ Shared vocabulary (8% lexical similarity) - neutral
  - ✅ Domain match (git) - positive
  - ✅ Operation fit (write) - positive

### Note
While dissonance is low, `gh repo fork` is semantically superior for fork operations. This demonstrates that **low dissonance doesn't always mean optimal choice**—context-specific tools can score even better.

---

## Summary Table

| Prompt | Dissonance | Risk | Lexical | Domain | Operation | Destructive? |
|--------|------------|------|---------|--------|-----------|--------------|
| "Clone repo to local machine" | 19.2% | Low | 30.8% | 100% | 100% | No |
| "Show me the README" | 77.7% | **Critical** | 6.7% | 100% | 0% | **Yes** |
| "Get me the code" | 40% | Moderate | 7.1% | 100% | 50% | No |
| "Clone weather data from API" | 100% | **Critical** | 7.1% | 0% | 0% | **Yes** |
| "Fork the repository" | 27.3% | Low | 7.7% | 100% | 100% | No |

## Key Insights

1. **Domain alignment is weighted highest** (40%) because it's the strongest predictor of tool fitness
2. **Destructive mismatches override everything** (auto-critical regardless of other scores)
3. **Low lexical overlap doesn't doom a score** if domain + operation are strong
4. **Ambiguous prompts** ("get", "grab") score moderate due to partial operation matches
5. **Domain drift** (wrong category) + destructive mismatch = guaranteed 100% dissonance
