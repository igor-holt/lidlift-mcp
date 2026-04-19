import type { ToolCandidate } from "./types";

export const sampleToolCatalog: ToolCandidate[] = [
  {
    name: "weather_lookup",
    description: "Read-only weather lookup for current conditions and short forecasts.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City or place name to inspect." },
      },
      required: ["location"],
      additionalProperties: false,
    },
    category: "weather",
    operationMode: "read",
    capabilities: ["get current conditions", "fetch forecast", "lookup humidity"],
    tags: ["forecast", "climate", "temperature"],
  },
  {
    name: "github_publish",
    description: "Create branches, commit changes, push code, and open pull requests on GitHub.",
    parameters: {
      type: "object",
      properties: {
        repository: { type: "string", description: "Target owner/name repository." },
        changes: { type: "array", description: "Planned code or content updates." },
      },
      required: ["repository", "changes"],
      additionalProperties: false,
    },
    category: "git",
    operationMode: "write",
    capabilities: ["commit code", "push branch", "open draft PR"],
    tags: ["git", "github", "publish"],
  },
  {
    name: "docs_search",
    description: "Search developer documentation and return page content snippets.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Documentation search query." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    category: "communication",
    operationMode: "read",
    capabilities: ["search docs", "read docs", "retrieve page snippets"],
    tags: ["documentation", "reference", "search"],
  },
  {
    name: "variant_lookup",
    description: "Resolve archived genomic variants and species metadata from EVA.",
    parameters: {
      type: "object",
      properties: {
        variant: { type: "string", description: "Variant or allele identifier." },
      },
      required: ["variant"],
      additionalProperties: false,
    },
    category: "life_science",
    operationMode: "read",
    capabilities: ["variant lookup", "species metadata", "assembly metadata"],
    tags: ["genomics", "eva", "variant"],
  },
  {
    name: "tool_fit_analyzer",
    description: "Analyze prompt-to-tool fit, detect mismatches, and rank candidate tools by dissonance.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt to analyze." },
        tools: { type: "array", description: "Candidate tools to score." },
      },
      required: ["prompt", "tools"],
      additionalProperties: false,
    },
    category: "analytics",
    operationMode: "transform",
    capabilities: ["score prompt fit", "rank tools", "explain dissonance"],
    tags: ["tooling", "alignment", "mcp"],
  },
];
