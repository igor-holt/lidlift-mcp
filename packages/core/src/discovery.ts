import type {
  DiscoveryCacheAdapter,
  DiscoveryCacheEntry,
  DiscoverVendorToolsOptions,
  DiscoveryError,
  DiscoveryResponse,
  DiscoverySuccessResponse,
  DiscoveryMetadata,
  OperationMode,
  Tool,
  ToolParameterSchema,
  Vendor,
} from "./types";

export const DEFAULT_DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000;
export const SUPPORTED_VENDORS = [
  "openai",
  "anthropic",
  "xai",
  "gemini",
] as const satisfies Vendor[];

const DEFAULT_MODELS: Record<Vendor, string> = {
  openai: "gpt-5",
  anthropic: "claude-sonnet-4-5",
  xai: "grok-4.20-reasoning",
  gemini: "gemini-2.5-flash",
};

export const VENDOR_ENV_NAMES: Record<Vendor, string[]> = {
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  xai: ["XAI_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
};

const discoveryCache = new Map<string, DiscoveryCacheEntry>();

type ToolTemplate = Omit<Tool, "name"> & { name?: string };

interface VendorToolManifestEntry extends ToolTemplate {
  aliases?: string[];
}

export interface DiscoveryContext {
  apiKey?: string;
  model: string;
  options: DiscoverVendorToolsOptions;
}

export interface VendorAdapter {
  vendor: Vendor;
  discover(context: DiscoveryContext): Promise<Tool[]>;
}

function buildParameters(
  properties: Record<string, unknown>,
  required: string[] = [],
): ToolParameterSchema {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

const OPENAI_TOOL_MANIFEST: VendorToolManifestEntry[] = [
  {
    name: "function_calling",
    description: "Call application-defined functions with JSON Schema parameters.",
    parameters: buildParameters(
      {
        name: { type: "string", description: "Tool name exposed to the model." },
        description: { type: "string", description: "Purpose and usage guidance." },
        parameters: { type: "object", description: "JSON Schema for tool arguments." },
      },
      ["name", "parameters"],
    ),
    category: "automation",
    operationMode: "mixed",
    capabilities: ["call user-defined functions", "structured arguments"],
    tags: ["openai", "function", "schema"],
    aliases: ["function calling", "function"],
  },
  {
    name: "web_search",
    description: "Search the public web for fresh information inside the Responses API.",
    parameters: buildParameters({}),
    category: "browser",
    operationMode: "read",
    capabilities: ["web search", "fresh citations"],
    tags: ["openai", "search", "web"],
  },
  {
    name: "file_search",
    description: "Search uploaded files and vector stores for grounded answers.",
    parameters: buildParameters({
      vector_store_ids: {
        type: "array",
        description: "Vector stores to search.",
      },
    }),
    category: "files",
    operationMode: "read",
    capabilities: ["semantic file retrieval", "grounded document lookup"],
    tags: ["openai", "files", "retrieval"],
  },
  {
    name: "retrieval",
    description: "Retrieve document context from attached or indexed files.",
    parameters: buildParameters({}),
    category: "files",
    operationMode: "read",
    capabilities: ["document retrieval", "grounded answers"],
    tags: ["openai", "retrieval"],
  },
  {
    name: "remote_mcp",
    description: "Connect the model to a remote MCP server and allow approved tools.",
    parameters: buildParameters(
      {
        server_url: {
          type: "string",
          description: "Remote MCP endpoint URL.",
        },
        headers: {
          type: "object",
          description: "Optional authentication headers.",
        },
        allowed_tools: {
          type: "array",
          description: "Allow-list of remote tools.",
        },
      },
      ["server_url"],
    ),
    category: "automation",
    operationMode: "mixed",
    capabilities: ["remote MCP access", "tool federation"],
    tags: ["openai", "mcp", "connectors"],
    aliases: ["mcp and connectors", "mcp"],
  },
  {
    name: "tool_search",
    description: "Search installed tools and MCP capabilities before a call.",
    parameters: buildParameters({
      query: { type: "string", description: "Search string for available tools." },
    }),
    category: "analytics",
    operationMode: "read",
    capabilities: ["tool discovery", "capability search"],
    tags: ["openai", "tooling", "search"],
  },
  {
    name: "code_interpreter",
    description: "Run code in a managed sandbox for analysis, charts, and file transforms.",
    parameters: buildParameters({
      container: {
        type: "object",
        description: "Sandbox/container configuration for execution.",
      },
    }),
    category: "code",
    operationMode: "transform",
    capabilities: ["python execution", "data analysis", "file generation"],
    tags: ["openai", "code", "sandbox"],
  },
  {
    name: "shell",
    description: "Execute shell commands in a managed coding environment.",
    parameters: buildParameters({
      cmd: { type: "string", description: "Shell command to execute." },
    }),
    category: "code",
    operationMode: "write",
    capabilities: ["shell execution", "repository changes"],
    tags: ["openai", "shell", "agentic"],
  },
  {
    name: "local_shell",
    description: "Execute local shell commands against a connected environment.",
    parameters: buildParameters({
      cmd: { type: "string", description: "Shell command to execute." },
    }),
    category: "code",
    operationMode: "write",
    capabilities: ["local shell access", "environment automation"],
    tags: ["openai", "shell", "local"],
  },
  {
    name: "apply_patch",
    description: "Apply structured file patches inside a coding environment.",
    parameters: buildParameters({
      patch: {
        type: "string",
        description: "Structured patch document to apply.",
      },
    }, ["patch"]),
    category: "code",
    operationMode: "write",
    capabilities: ["code patching", "file edits"],
    tags: ["openai", "patch", "code"],
  },
  {
    name: "computer_use",
    description: "Control a browser or computer environment to complete UI tasks.",
    parameters: buildParameters({
      environment: {
        type: "string",
        description: "Target execution environment.",
      },
    }),
    category: "browser",
    operationMode: "write",
    capabilities: ["browser interaction", "computer control", "screenshots"],
    tags: ["openai", "computer", "browser"],
  },
  {
    name: "image_generation",
    description: "Generate or edit images from prompts or inputs.",
    parameters: buildParameters({
      prompt: { type: "string", description: "Image generation prompt." },
    }),
    category: "files",
    operationMode: "transform",
    capabilities: ["image generation", "image editing"],
    tags: ["openai", "image", "generation"],
  },
];

const ANTHROPIC_TOOL_MANIFEST: VendorToolManifestEntry[] = [
  {
    name: "web_search",
    description: "Search the web on Anthropic infrastructure and cite sources.",
    parameters: buildParameters({}),
    category: "browser",
    operationMode: "read",
    capabilities: ["web search", "cited results"],
    tags: ["anthropic", "web", "server-tool"],
  },
  {
    name: "web_fetch",
    description: "Fetch and read web pages directly on Anthropic infrastructure.",
    parameters: buildParameters({
      url: { type: "string", description: "URL to retrieve." },
    }, ["url"]),
    category: "browser",
    operationMode: "read",
    capabilities: ["page fetch", "web retrieval"],
    tags: ["anthropic", "web", "server-tool"],
  },
  {
    name: "code_execution",
    description: "Execute code and commands in Anthropic-managed sandboxes.",
    parameters: buildParameters({}),
    category: "code",
    operationMode: "transform",
    capabilities: ["code execution", "file manipulation"],
    tags: ["anthropic", "code", "server-tool"],
  },
  {
    name: "tool_search",
    description: "Search available tools from connected Anthropic tool infrastructure.",
    parameters: buildParameters({
      query: { type: "string", description: "Tool search query." },
    }),
    category: "analytics",
    operationMode: "read",
    capabilities: ["tool search", "capability lookup"],
    tags: ["anthropic", "search", "server-tool"],
  },
  {
    name: "advisor",
    description: "Use Anthropic's advisor tool for guided recommendations.",
    parameters: buildParameters({}),
    category: "analytics",
    operationMode: "transform",
    capabilities: ["advice generation", "guided reasoning"],
    tags: ["anthropic", "advisor"],
  },
  {
    name: "memory",
    description: "Persist and recall working memory for agent runs.",
    parameters: buildParameters({
      operation: { type: "string", description: "Memory operation to perform." },
    }),
    category: "analytics",
    operationMode: "mixed",
    capabilities: ["memory recall", "memory updates"],
    tags: ["anthropic", "memory"],
  },
  {
    name: "bash",
    description: "Run bash commands through Anthropic-defined client tooling.",
    parameters: buildParameters({
      command: { type: "string", description: "Shell command to execute." },
    }, ["command"]),
    category: "code",
    operationMode: "write",
    capabilities: ["shell execution", "system inspection"],
    tags: ["anthropic", "bash"],
  },
  {
    name: "computer_use",
    description: "Interact with remote computer environments using screenshots and input events.",
    parameters: buildParameters({
      action: { type: "string", description: "Requested UI action." },
    }),
    category: "browser",
    operationMode: "write",
    capabilities: ["computer interaction", "screenshots", "mouse and keyboard control"],
    tags: ["anthropic", "computer"],
  },
  {
    name: "text_editor",
    description: "Inspect and edit files through Anthropic-defined editor operations.",
    parameters: buildParameters({
      path: { type: "string", description: "File path to edit." },
      operation: { type: "string", description: "Edit operation." },
    }),
    category: "code",
    operationMode: "write",
    capabilities: ["file inspection", "file editing"],
    tags: ["anthropic", "editor"],
  },
];

const XAI_TOOL_MANIFEST: VendorToolManifestEntry[] = [
  {
    name: "function",
    description: "Call application-defined functions with JSON Schema parameters.",
    parameters: buildParameters(
      {
        name: { type: "string", description: "Function name." },
        description: { type: "string", description: "Function purpose." },
        parameters: { type: "object", description: "JSON Schema for arguments." },
      },
      ["name", "parameters"],
    ),
    category: "automation",
    operationMode: "mixed",
    capabilities: ["custom function calling", "structured arguments"],
    tags: ["xai", "function"],
  },
  {
    name: "web_search",
    description: "Run live web search on xAI infrastructure.",
    parameters: buildParameters({}),
    category: "browser",
    operationMode: "read",
    capabilities: ["web search", "fresh search results"],
    tags: ["xai", "search"],
  },
  {
    name: "web_search_with_snippets",
    description: "Run web search and expose response snippets.",
    parameters: buildParameters({}),
    category: "browser",
    operationMode: "read",
    capabilities: ["web search", "search snippets"],
    tags: ["xai", "search"],
  },
  {
    name: "browse_page",
    description: "Fetch and inspect the contents of a specific page.",
    parameters: buildParameters({
      url: { type: "string", description: "Page URL to browse." },
    }, ["url"]),
    category: "browser",
    operationMode: "read",
    capabilities: ["page fetch", "page inspection"],
    tags: ["xai", "browse"],
  },
  {
    name: "x_search",
    description: "Search X content through xAI-built search tools.",
    parameters: buildParameters({}),
    category: "communication",
    operationMode: "read",
    capabilities: ["X search", "social retrieval"],
    tags: ["xai", "x"],
  },
  {
    name: "x_user_search",
    description: "Search for X users.",
    parameters: buildParameters({}),
    category: "communication",
    operationMode: "read",
    capabilities: ["X user search"],
    tags: ["xai", "x"],
  },
  {
    name: "x_keyword_search",
    description: "Search X posts by keyword.",
    parameters: buildParameters({}),
    category: "communication",
    operationMode: "read",
    capabilities: ["X keyword search"],
    tags: ["xai", "x"],
  },
  {
    name: "x_semantic_search",
    description: "Search X posts semantically.",
    parameters: buildParameters({}),
    category: "communication",
    operationMode: "read",
    capabilities: ["X semantic search"],
    tags: ["xai", "x"],
  },
  {
    name: "x_thread_fetch",
    description: "Fetch a full X thread for analysis.",
    parameters: buildParameters({}),
    category: "communication",
    operationMode: "read",
    capabilities: ["X thread retrieval"],
    tags: ["xai", "x"],
  },
  {
    name: "code_interpreter",
    description: "Run code inside xAI-managed execution sandboxes.",
    parameters: buildParameters({}),
    category: "code",
    operationMode: "transform",
    capabilities: ["code execution", "computation"],
    tags: ["xai", "code"],
    aliases: ["code_execution"],
  },
  {
    name: "view_x_video",
    description: "Inspect X video content.",
    parameters: buildParameters({}),
    category: "communication",
    operationMode: "read",
    capabilities: ["video inspection"],
    tags: ["xai", "video"],
  },
  {
    name: "view_image",
    description: "Inspect an image inside xAI tool flows.",
    parameters: buildParameters({}),
    category: "files",
    operationMode: "read",
    capabilities: ["image inspection"],
    tags: ["xai", "image"],
  },
  {
    name: "collections_search",
    description: "Search xAI collections attached to the account.",
    parameters: buildParameters({}),
    category: "files",
    operationMode: "read",
    capabilities: ["collections search", "knowledge retrieval"],
    tags: ["xai", "collections"],
  },
  {
    name: "mcp",
    description: "Invoke approved tools from a connected MCP server.",
    parameters: buildParameters({
      server_label: { type: "string", description: "Connected MCP server label." },
      tool_name: { type: "string", description: "Allowed MCP tool name." },
    }),
    category: "automation",
    operationMode: "mixed",
    capabilities: ["MCP invocation", "remote tools"],
    tags: ["xai", "mcp"],
  },
];

const GEMINI_TOOL_MANIFEST: VendorToolManifestEntry[] = [
  {
    name: "function",
    description: "Call application-defined functions with JSON Schema parameters.",
    parameters: buildParameters(
      {
        name: { type: "string", description: "Function name." },
        description: { type: "string", description: "Function purpose." },
        parameters: { type: "object", description: "JSON Schema for arguments." },
      },
      ["name", "parameters"],
    ),
    category: "automation",
    operationMode: "mixed",
    capabilities: ["custom function calling", "structured arguments"],
    tags: ["gemini", "function"],
  },
  {
    name: "code_execution",
    description: "Execute code inside the Gemini API toolchain.",
    parameters: buildParameters({}),
    category: "code",
    operationMode: "transform",
    capabilities: ["code execution", "computation"],
    tags: ["gemini", "code"],
  },
  {
    name: "url_context",
    description: "Fetch URL context for the model.",
    parameters: buildParameters({}),
    category: "browser",
    operationMode: "read",
    capabilities: ["URL retrieval", "context grounding"],
    tags: ["gemini", "url"],
  },
  {
    name: "computer_use",
    description: "Interact with browser environments through Gemini computer use.",
    parameters: buildParameters({
      environment: { type: "string", description: "Execution environment." },
    }),
    category: "browser",
    operationMode: "write",
    capabilities: ["computer control", "browser interaction"],
    tags: ["gemini", "computer"],
  },
  {
    name: "mcp_server",
    description: "Connect Gemini to a remote MCP server with an allow-list.",
    parameters: buildParameters({
      name: { type: "string", description: "MCP server name." },
      url: { type: "string", description: "MCP server URL." },
      headers: { type: "object", description: "Optional authentication headers." },
      allowed_tools: { type: "array", description: "Allowed remote tools." },
    }),
    category: "automation",
    operationMode: "mixed",
    capabilities: ["remote MCP access", "tool federation"],
    tags: ["gemini", "mcp"],
  },
  {
    name: "google_search",
    description: "Ground responses with Google Search.",
    parameters: buildParameters({
      search_types: {
        type: "array",
        description: "Search grounding modes to enable.",
      },
    }),
    category: "browser",
    operationMode: "read",
    capabilities: ["google web search", "grounded answers"],
    tags: ["gemini", "search"],
  },
  {
    name: "file_search",
    description: "Search named file stores from Gemini tools.",
    parameters: buildParameters({
      file_search_store_names: {
        type: "array",
        description: "Stores to search.",
      },
    }),
    category: "files",
    operationMode: "read",
    capabilities: ["file search", "semantic retrieval"],
    tags: ["gemini", "files"],
  },
  {
    name: "google_maps",
    description: "Access Google Maps results inside Gemini tool calls.",
    parameters: buildParameters({
      latitude: { type: "number", description: "User latitude." },
      longitude: { type: "number", description: "User longitude." },
    }),
    category: "browser",
    operationMode: "read",
    capabilities: ["maps lookup", "place search"],
    tags: ["gemini", "maps"],
  },
  {
    name: "retrieval",
    description: "Retrieve files through Gemini retrieval integrations.",
    parameters: buildParameters({
      retrieval_types: {
        type: "array",
        description: "Retrieval backends to enable.",
      },
    }),
    category: "files",
    operationMode: "read",
    capabilities: ["retrieval", "knowledge grounding"],
    tags: ["gemini", "retrieval"],
  },
];

const TOOL_MANIFESTS: Record<Vendor, VendorToolManifestEntry[]> = {
  openai: OPENAI_TOOL_MANIFEST,
  anthropic: ANTHROPIC_TOOL_MANIFEST,
  xai: XAI_TOOL_MANIFEST,
  gemini: GEMINI_TOOL_MANIFEST,
};

function inferOperationMode(name: string, description: string): OperationMode {
  const haystack = `${name} ${description}`.toLowerCase();

  if (
    /\b(create|update|delete|edit|patch|execute|shell|computer|bash|write)\b/.test(
      haystack,
    )
  ) {
    return /\b(read|search|fetch|lookup|retrieve)\b/.test(haystack)
      ? "mixed"
      : "write";
  }

  if (/\b(run|generate|analy[sz]e|score|transform|compute)\b/.test(haystack)) {
    return "transform";
  }

  return "read";
}

function buildToolFromManifest(
  vendor: Vendor,
  name: string,
  manifest: VendorToolManifestEntry | undefined,
): Tool {
  if (manifest) {
    return {
      name,
      description: manifest.description,
      parameters: manifest.parameters,
      category: manifest.category,
      operationMode:
        manifest.operationMode ?? inferOperationMode(name, manifest.description),
      capabilities: manifest.capabilities,
      tags: manifest.tags,
    };
  }

  const fallbackDescription = `${vendor} built-in tool discovered through vendor metadata.`;

  return {
    name,
    description: fallbackDescription,
    parameters: buildParameters({}),
    category: "automation",
    operationMode: inferOperationMode(name, fallbackDescription),
    capabilities: ["vendor built-in tool"],
    tags: [vendor, "discovered"],
  };
}

function uniqueTools(tools: Tool[]) {
  const deduped = new Map<string, Tool>();

  for (const tool of tools) {
    if (!deduped.has(tool.name)) {
      deduped.set(tool.name, tool);
    }
  }

  return [...deduped.values()];
}

function normalizeModel(vendor: Vendor, model?: string) {
  if (!model?.trim()) {
    return DEFAULT_MODELS[vendor];
  }

  const trimmed = model.trim();

  if (vendor !== "gemini") {
    return trimmed;
  }

  return trimmed.startsWith("models/") ? trimmed.slice("models/".length) : trimmed;
}

export function normalizeVendor(vendor: string): Vendor {
  const normalized = vendor.trim().toLowerCase();

  if (normalized === "openai" || normalized === "gpt") return "openai";
  if (normalized === "anthropic" || normalized === "claude") return "anthropic";
  if (normalized === "xai" || normalized === "grok") return "xai";
  if (normalized === "gemini" || normalized === "google") return "gemini";

  throw new DiscoveryFailure({
    code: "ERR_VENDOR",
    message: `Unsupported vendor "${vendor}". Supported vendors: ${SUPPORTED_VENDORS.join(", ")}.`,
    status: 400,
  });
}

export function getVendorApiKey(
  vendor: Vendor,
  explicitApiKey?: string,
  envSource: Record<string, string | undefined> = {},
) {
  if (explicitApiKey?.trim()) {
    return explicitApiKey.trim();
  }

  for (const envName of VENDOR_ENV_NAMES[vendor]) {
    const value = envSource[envName];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function createToolLookup(vendor: Vendor) {
  const lookup = new Map<string, VendorToolManifestEntry>();

  for (const entry of TOOL_MANIFESTS[vendor]) {
    if (entry.name) {
      lookup.set(entry.name.toLowerCase(), entry);
    }

    for (const alias of entry.aliases ?? []) {
      lookup.set(alias.toLowerCase(), entry);
    }
  }

  return lookup;
}

function buildDiscoveryMetadata(
  vendor: Vendor,
  model: string,
  cacheTtlMs: number,
  cached: boolean,
  fetchedAt: string,
): DiscoveryMetadata {
  return {
    cached,
    fetchedAt,
    model,
    ttlSeconds: Math.round(cacheTtlMs / 1000),
    vendor,
  };
}

async function cacheKeyFor(vendor: Vendor, model: string, apiKey?: string) {
  const encoder = new TextEncoder();
  const cacheIdentity = apiKey?.trim() ? apiKey : "anonymous";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${vendor}:${model}:${cacheIdentity}`),
  );
  const bytes = [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  return `${vendor}:${model}:${bytes}`;
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseRetryAfter(headers: Headers) {
  const value = headers.get("retry-after");
  if (!value) return undefined;

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber;
  }

  return undefined;
}

function sanitizeErrorMessage(message: string) {
  return message
    .replace(/bearer\s+[a-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/\bsk-ant-[a-z0-9_-]+\b/gi, "[redacted]")
    .replace(/\bsk-(?:proj-|live-|test-)?[a-z0-9_-]+\b/gi, "[redacted]")
    .replace(/\bAIza[0-9A-Za-z\-_]+\b/g, "[redacted]")
    .replace(/\bya29\.[0-9A-Za-z\-_]+\b/g, "[redacted]")
    .replace(/\bxai[-_][a-z0-9._-]+\b/gi, "[redacted]");
}

function buildMissingCredentialError(vendor: Vendor) {
  return new DiscoveryFailure({
    code: "ERR_AUTH",
    message: `Missing credentials for ${vendor}. Provide auth_token/apiKey or configure ${VENDOR_ENV_NAMES[vendor].join(" / ")}.`,
    status: 401,
    vendor,
  });
}

export function getDiscoveryCacheTtlMs(
  envSource: Record<string, string | undefined> = {},
) {
  const rawValue = envSource.LIDLIFT_DISCOVERY_CACHE_TTL_SECONDS;
  const parsedValue = Number(rawValue);

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return Math.round(parsedValue * 1000);
  }

  return DEFAULT_DISCOVERY_CACHE_TTL_MS;
}

export function resetVendorDiscoveryCache() {
  discoveryCache.clear();
}

async function readDiscoveryCache(
  key: string,
  cache: DiscoveryCacheAdapter | undefined,
  now: number,
) {
  const entry = cache ? await cache.get(key) : discoveryCache.get(key) ?? null;

  if (!entry || entry.expiresAt <= now) {
    return null;
  }

  return entry;
}

async function writeDiscoveryCache(
  key: string,
  entry: DiscoveryCacheEntry,
  cache: DiscoveryCacheAdapter | undefined,
  cacheTtlMs: number,
) {
  if (cache) {
    await cache.set(key, entry, Math.max(1, Math.ceil(cacheTtlMs / 1000)));
    return;
  }

  discoveryCache.set(key, entry);
}

function shouldFallbackToStaticBuiltIns(error: unknown) {
  return (
    error instanceof DiscoveryFailure &&
    (error.details.code === "ERR_NETWORK" ||
      error.details.code === "ERR_UPSTREAM" ||
      error.details.code === "ERR_MODEL")
  );
}

class DiscoveryFailure extends Error {
  readonly details: DiscoveryError;

  constructor(details: DiscoveryError) {
    super(details.message);
    this.details = details;
  }
}

async function ensureOpenAiModel(context: DiscoveryContext) {
  if (!context.apiKey) {
    throw buildMissingCredentialError("openai");
  }

  const response = await fetch(
    `https://api.openai.com/v1/models/${encodeURIComponent(context.model)}`,
    {
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
      },
      signal: context.options.signal,
    },
  );

  await assertVendorResponse("openai", response);
}

async function ensureAnthropicModel(context: DiscoveryContext) {
  if (!context.apiKey) {
    return;
  }

  const response = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": context.apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal: context.options.signal,
  });

  const payload = await assertVendorResponse("anthropic", response);
  const models = Array.isArray(payload?.data) ? payload.data : [];
  const match = models.find(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "id" in entry &&
      entry.id === context.model,
  );

  if (!match) {
    throw new DiscoveryFailure({
      code: "ERR_MODEL",
      message: `The requested Anthropic model "${context.model}" could not be validated.`,
      status: 404,
      vendor: "anthropic",
    });
  }
}

async function ensureXaiModel(context: DiscoveryContext) {
  if (!context.apiKey) {
    return;
  }

  const response = await fetch(
    `https://api.x.ai/v1/models/${encodeURIComponent(context.model)}`,
    {
      headers: {
        Authorization: `Bearer ${context.apiKey}`,
      },
      signal: context.options.signal,
    },
  );

  await assertVendorResponse("xai", response);
}

async function ensureGeminiModel(context: DiscoveryContext) {
  if (!context.apiKey) {
    return;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      context.model,
    )}?key=${encodeURIComponent(context.apiKey)}`,
    {
      signal: context.options.signal,
    },
  );

  await assertVendorResponse("gemini", response);
}

async function assertVendorResponse(vendor: Vendor, response: Response) {
  if (response.ok) {
    return readJson(response);
  }

  if (response.status === 401 || response.status === 403) {
    throw new DiscoveryFailure({
      code: "ERR_AUTH",
      message: `Authentication with ${vendor} failed while discovering tools.`,
      status: response.status,
      vendor,
    });
  }

  if (response.status === 429) {
    throw new DiscoveryFailure({
      code: "ERR_RATE_LIMIT",
      message: `The ${vendor} API rate limit was reached while discovering tools.`,
      retryAfterSeconds: parseRetryAfter(response.headers),
      status: response.status,
      vendor,
    });
  }

  const payload = await readJson(response);
  const upstreamMessage =
    (payload &&
      typeof payload.error === "object" &&
      payload.error !== null &&
      "message" in payload.error &&
      typeof payload.error.message === "string" &&
      payload.error.message) ||
    (payload &&
      typeof payload.message === "string" &&
      payload.message) ||
    "";

  const message = sanitizeErrorMessage(upstreamMessage);

  if (response.status === 400 || response.status === 404) {
    throw new DiscoveryFailure({
      code: "ERR_MODEL",
      message:
        message || `The requested ${vendor} model could not be validated.`,
      status: response.status,
      vendor,
    });
  }

  throw new DiscoveryFailure({
    code: "ERR_UPSTREAM",
    message:
      message ||
      `The ${vendor} API could not complete tool discovery right now.`,
    status: response.status,
    vendor,
  });
}

export const STATIC_BUILT_INS: Record<Exclude<Vendor, "openai">, Tool[]> = {
  anthropic: uniqueTools(
    ANTHROPIC_TOOL_MANIFEST.map((entry) =>
      buildToolFromManifest("anthropic", entry.name ?? "unknown", entry),
    ),
  ),
  xai: uniqueTools(
    XAI_TOOL_MANIFEST.map((entry) =>
      buildToolFromManifest("xai", entry.name ?? "unknown", entry),
    ),
  ),
  gemini: uniqueTools(
    GEMINI_TOOL_MANIFEST.map((entry) =>
      buildToolFromManifest("gemini", entry.name ?? "unknown", entry),
    ),
  ),
};

export const vendorAdapterRegistry: Record<Vendor, VendorAdapter> = {
  openai: {
    vendor: "openai",
    async discover(context) {
      await ensureOpenAiModel(context);
      return uniqueTools(
        OPENAI_TOOL_MANIFEST.map((entry) =>
          buildToolFromManifest("openai", entry.name ?? "unknown", entry),
        ),
      );
    },
  },
  anthropic: {
    vendor: "anthropic",
    async discover(context) {
      if (!context.apiKey) {
        return STATIC_BUILT_INS.anthropic;
      }

      try {
        await ensureAnthropicModel(context);
      } catch (error) {
        if (shouldFallbackToStaticBuiltIns(error)) {
          return STATIC_BUILT_INS.anthropic;
        }

        throw error;
      }

      return STATIC_BUILT_INS.anthropic;
    },
  },
  xai: {
    vendor: "xai",
    async discover(context) {
      if (!context.apiKey) {
        return STATIC_BUILT_INS.xai;
      }

      try {
        await ensureXaiModel(context);
      } catch (error) {
        if (shouldFallbackToStaticBuiltIns(error)) {
          return STATIC_BUILT_INS.xai;
        }

        throw error;
      }

      return STATIC_BUILT_INS.xai;
    },
  },
  gemini: {
    vendor: "gemini",
    async discover(context) {
      if (!context.apiKey) {
        return STATIC_BUILT_INS.gemini;
      }

      try {
        await ensureGeminiModel(context);
      } catch (error) {
        if (shouldFallbackToStaticBuiltIns(error)) {
          return STATIC_BUILT_INS.gemini;
        }

        throw error;
      }

      return STATIC_BUILT_INS.gemini;
    },
  },
};

async function discoverVendorToolsInternal(
  vendor: string,
  options: DiscoverVendorToolsOptions = {},
) {
  const normalizedVendor = normalizeVendor(vendor);
  const model = normalizeModel(normalizedVendor, options.model);
  const apiKey = getVendorApiKey(normalizedVendor, options.apiKey);
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_DISCOVERY_CACHE_TTL_MS;
  const key = await cacheKeyFor(normalizedVendor, model, apiKey);
  const now = Date.now();

  if (!options.forceRefresh) {
    const cached = await readDiscoveryCache(key, options.cache, now);

    if (cached) {
      return {
        cached: true,
        fetchedAt: cached.fetchedAt,
        model,
        tools: cached.tools,
        vendor: normalizedVendor,
      };
    }
  }

  try {
    const tools = await vendorAdapterRegistry[normalizedVendor].discover({
      apiKey,
      model,
      options,
    });
    const fetchedAt = new Date(now).toISOString();
    const cacheEntry = {
      expiresAt: now + cacheTtlMs,
      fetchedAt,
      tools,
    } satisfies DiscoveryCacheEntry;

    await writeDiscoveryCache(key, cacheEntry, options.cache, cacheTtlMs);

    return {
      cached: false,
      fetchedAt,
      model,
      tools,
      vendor: normalizedVendor,
    };
  } catch (error) {
    if (error instanceof DiscoveryFailure) {
      throw error;
    }

    throw new DiscoveryFailure({
      code: "ERR_NETWORK",
      message:
        error instanceof Error
          ? sanitizeErrorMessage(error.message)
          : `Unexpected ${normalizedVendor} discovery failure.`,
      vendor: normalizedVendor,
    });
  }
}

export async function discoverVendorTools(
  vendor: string,
  options: DiscoverVendorToolsOptions = {},
) {
  const result = await discoverVendorToolsInternal(vendor, options);
  return result.tools;
}

export async function discoverVendorToolsResponse(
  vendor: string,
  options: DiscoverVendorToolsOptions = {},
): Promise<DiscoveryResponse> {
  try {
    const result = await discoverVendorToolsInternal(vendor, options);
    const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_DISCOVERY_CACHE_TTL_MS;

    return {
      ok: true,
      ...buildDiscoveryMetadata(
        result.vendor,
        result.model,
        cacheTtlMs,
        result.cached,
        result.fetchedAt,
      ),
      tools: result.tools,
    } satisfies DiscoverySuccessResponse;
  } catch (error) {
    const failure =
      error instanceof DiscoveryFailure
        ? error
        : new DiscoveryFailure({
            code: "ERR_NETWORK",
            message:
              error instanceof Error
                ? sanitizeErrorMessage(error.message)
                : "Unexpected discovery failure.",
          });

    return {
      ok: false,
      error: failure.details,
      model: options.model?.trim() ? options.model.trim() : null,
      vendor: failure.details.vendor ?? null,
    };
  }
}

export function mergeToolCatalogs(...catalogs: Array<Tool[] | undefined>) {
  const merged = new Map<string, Tool>();

  for (const catalog of catalogs) {
    for (const tool of catalog ?? []) {
      const existing = merged.get(tool.name);
      merged.set(tool.name, {
        ...existing,
        ...tool,
      });
    }
  }

  return [...merged.values()];
}

export function describeKnownVendorTools(vendor: Vendor) {
  return uniqueTools(
    TOOL_MANIFESTS[vendor].map((entry) =>
      buildToolFromManifest(vendor, entry.name ?? "unknown", entry),
    ),
  );
}
