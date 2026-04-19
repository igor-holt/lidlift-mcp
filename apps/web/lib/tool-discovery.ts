import {
  discoverVendorToolsResponse,
  getDiscoveryCacheTtlMs,
  getVendorApiKey,
  mergeToolCatalogs,
  normalizeVendor,
  sampleToolCatalog,
  toolCatalogSchema,
  type DiscoveryError,
  type DiscoveryResponse,
  type Tool,
  type Vendor,
} from "@tool-dissonance/core";

export interface DiscoveryInput {
  authToken?: string;
  forceRefresh?: boolean;
  model?: string;
  tools?: unknown;
  vendor?: string;
}

export interface ResolvedToolCatalog {
  catalogSize: number;
  catalogSource: "sample" | "request" | "vendor" | "merged";
  discovery: DiscoveryResponse | null;
  model: string | null;
  tools: Tool[];
  vendor: Vendor | null;
}

export interface DiscoveryFailureResult {
  discovery: DiscoveryResponse | null;
  error: DiscoveryError;
  status: number;
}

function parseRequestedTools(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = toolCatalogSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid tool catalog.");
  }

  return parsed.data;
}

export async function resolveToolCatalog(
  input: DiscoveryInput,
  envSource: Record<string, string | undefined>,
): Promise<ResolvedToolCatalog | DiscoveryFailureResult> {
  const requestedTools = parseRequestedTools(input.tools);

  if (!input.vendor) {
    const tools = requestedTools ?? sampleToolCatalog;

    return {
      tools,
      catalogSize: tools.length,
      catalogSource: requestedTools ? "request" : "sample",
      discovery: null,
      vendor: null,
      model: null,
    };
  }

  let vendor: Vendor;

  try {
    vendor = normalizeVendor(input.vendor);
  } catch (error) {
    return {
      discovery: null,
      error: {
        code: "ERR_VENDOR",
        message:
          error instanceof Error ? error.message : "Unsupported vendor.",
      },
      status: 400,
    };
  }

  const discovery = await discoverVendorToolsResponse(vendor, {
    cacheTtlMs: getDiscoveryCacheTtlMs(envSource),
    forceRefresh: input.forceRefresh,
    model: input.model,
    apiKey: getVendorApiKey(vendor, input.authToken, envSource),
  });

  if (!discovery.ok) {
    return {
      discovery,
      error: discovery.error,
      status: discovery.error.status ?? 500,
    };
  }

  const tools = requestedTools
    ? mergeToolCatalogs(discovery.tools, requestedTools)
    : discovery.tools;

  return {
    tools,
    catalogSize: tools.length,
    catalogSource: requestedTools ? "merged" : "vendor",
    discovery,
    vendor,
    model: discovery.model,
  };
}
