import {
	analyzeToolFit,
	autoDetectVendor,
	discoverVendorToolsResponse,
	getDiscoveryCacheTtlMs,
	getVendorApiKey,
	mergeToolCatalogs,
	normalizeVendor,
	rankTools,
	sampleToolCatalog,
	toolCandidateSchema,
	toolCatalogSchema,
	vendorSchema,
	type DiscoveryCacheAdapter,
	type DiscoveryCacheEntry,
	type DiscoveryError,
} from "@tool-dissonance/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";

function formatPercent(value: number) {
	return `${Math.round(value * 100)}%`;
}

function formatBestFitText(result: ReturnType<typeof analyzeToolFit>) {
	return [
		`Best fit analysis for "${result.tool.name}"`,
		`Decision: ${result.guardrailDecision}`,
		`Risk: ${result.riskLevel}`,
		`Alignment: ${formatPercent(result.alignmentScore)}`,
		`Dissonance: ${formatPercent(result.dissonanceScore)}`,
		`Reason: ${result.guardrailReason}`,
		`Recommendation: ${result.recommendation}`,
	].join("\n");
}

function formatRankingText(result: ReturnType<typeof rankTools>) {
	if (!result.best) {
		return "No tools were available to rank.";
	}

	return [
		`Best candidate: ${result.best.tool.name} (${result.best.guardrailDecision}, ${result.best.riskLevel})`,
		...result.ranked.map(
			(entry, index) =>
				`${index + 1}. ${entry.tool.name} — ${entry.guardrailDecision} — dissonance ${formatPercent(entry.dissonanceScore)} — ${entry.recommendation}`,
		),
	].join("\n");
}

function toStructuredContent<T>(value: T) {
	return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function parseForceRefresh(value: unknown) {
	if (typeof value === "boolean") {
		return value;
	}

	if (typeof value === "string") {
		return value.trim().toLowerCase() === "true";
	}

	return false;
}

function readBearerToken(request: Request) {
	const authorization = request.headers.get("authorization");

	if (!authorization?.toLowerCase().startsWith("bearer ")) {
		return undefined;
	}

	return authorization.slice("bearer ".length).trim() || undefined;
}

function resolveVendorApiKey(
	vendor: string,
	explicitApiKey: string | undefined,
	envSource: Record<string, unknown>,
) {
	try {
		const normalizedVendor = normalizeVendor(vendor);
		return getVendorApiKey(
			normalizedVendor,
			explicitApiKey,
			envSource as Record<string, string | undefined>,
		);
	} catch {
		return explicitApiKey;
	}
}

function createKvDiscoveryCache(
	namespace: KVNamespace | undefined,
): DiscoveryCacheAdapter | undefined {
	if (!namespace) {
		return undefined;
	}

	return {
		async get(key) {
			return (await namespace.get<DiscoveryCacheEntry>(key, "json")) ?? null;
		},
		async set(key, value, ttlSeconds) {
			await namespace.put(key, JSON.stringify(value), {
				expirationTtl: ttlSeconds,
			});
		},
	};
}

function discoveryErrorPayload(error: DiscoveryError, status = error.status ?? 500) {
	return {
		body: {
			ok: false,
			error,
			model: null,
			vendor: error.vendor ?? null,
		},
		status,
	};
}

function jsonWithCache(payload: unknown, status = 200, cacheTtlMs = 10 * 60 * 1000) {
	return Response.json(payload, {
		status,
		headers: {
			"Cache-Control": `private, max-age=${Math.max(
				0,
				Math.ceil(cacheTtlMs / 1000),
			)}`,
		},
	});
}

async function resolveCatalogFromInput({
	authToken,
	cache,
	cacheTtlMs,
	envSource,
	forceRefresh,
	model,
	tools,
	vendor,
}: {
	authToken?: string;
	cache?: DiscoveryCacheAdapter;
	cacheTtlMs: number;
	envSource: Record<string, unknown>;
	forceRefresh?: boolean;
	model?: string;
	tools?: z.infer<typeof toolCatalogSchema>;
	vendor?: string;
}) {
	if (!vendor) {
		return {
			catalogSource: tools ? "request" : "sample",
			discovery: null,
			tools: tools ?? sampleToolCatalog,
		};
	}

	const discovery = await discoverVendorToolsResponse(vendor, {
		cache,
		cacheTtlMs,
		forceRefresh,
		model,
		apiKey: resolveVendorApiKey(vendor, authToken, envSource),
	});

	if (!discovery.ok) {
		return {
			discovery,
			error: discovery.error.message,
			status: discovery.error.status ?? 500,
		};
	}

	return {
		catalogSource: tools ? "merged" : "vendor",
		discovery,
		tools: tools ? mergeToolCatalogs(discovery.tools, tools) : discovery.tools,
	};
}

const mcpHandlerOptions = {
	route: "/mcp",
	corsOptions: {
		origin: "*",
		methods: "GET, POST, DELETE, OPTIONS",
		headers:
			"Content-Type, Authorization, Last-Event-ID, MCP-Protocol-Version, mcp-session-id",
		exposeHeaders: "MCP-Protocol-Version, mcp-session-id",
		maxAge: 86400,
	},
} as const;

function createServer(envSource: Record<string, unknown>) {
	const cacheTtlMs = getDiscoveryCacheTtlMs(
		envSource as Record<string, string | undefined>,
	);
	// Optional production binding:
	// add `kv_namespaces = [{ binding = "DISCOVERY_CACHE", id = "..." }]`
	// in wrangler.jsonc and the Worker will use KV-backed discovery cache.
	const discoveryCache = createKvDiscoveryCache(
		(envSource as { DISCOVERY_CACHE?: KVNamespace }).DISCOVERY_CACHE,
	);
	const server = new McpServer({
		name: "lidlift-mcp",
		version: "1.0.0",
	});

	server.registerTool(
		"analyze_tool_fit",
		{
			title: "Analyze Tool Fit",
			description:
				"Score how well a single tool matches a prompt and identify mismatches before execution.",
			inputSchema: {
				prompt: z.string().min(1),
				tool: toolCandidateSchema,
			},
		},
		async ({ prompt, tool }) => {
			const result = analyzeToolFit({ prompt, tool });

			return {
				content: [{ type: "text", text: formatBestFitText(result) }],
				structuredContent: toStructuredContent(result),
			};
		},
	);

	server.registerTool(
		"rank_tools",
		{
			title: "Rank Tools",
			description:
				"Rank a catalog of tools by dissonance for a given prompt and return the safest candidate first.",
			inputSchema: {
				prompt: z.string().min(1),
				tools: toolCatalogSchema.optional(),
				vendor: vendorSchema.optional(),
				model: z.string().min(1).optional(),
				auth_token: z.string().min(1).optional(),
				force_refresh: z.boolean().optional(),
			},
		},
		async ({ auth_token, force_refresh, model, prompt, tools, vendor }) => {
			const resolvedCatalog = await resolveCatalogFromInput({
				authToken: auth_token,
				cache: discoveryCache,
				cacheTtlMs,
				envSource,
				forceRefresh: force_refresh,
				model,
				tools,
				vendor,
			});

			if ("error" in resolvedCatalog) {
				const errorText =
					resolvedCatalog.error ?? "Unable to discover vendor tools.";

				return {
					content: [{ type: "text", text: errorText }],
					structuredContent: toStructuredContent({
						ok: false,
						discovery: resolvedCatalog.discovery,
						error: errorText,
					}),
				};
			}

			const result = rankTools(prompt, resolvedCatalog.tools);

			return {
				content: [{ type: "text", text: formatRankingText(result) }],
				structuredContent: toStructuredContent({
					...result,
					catalogSource: resolvedCatalog.catalogSource,
					discovery: resolvedCatalog.discovery,
				}),
			};
		},
	);

	server.registerTool(
		"discover_vendor_tools",
		{
			title: "Discover Vendor Tools",
			description:
				"Resolve the current built-in tool surface for a supported AI vendor and optional model.",
			inputSchema: {
				vendor: vendorSchema,
				model: z.string().min(1).optional(),
				auth_token: z.string().min(1).optional(),
				force_refresh: z.boolean().optional(),
			},
		},
		async ({ auth_token, force_refresh, model, vendor }) => {
			const discovery = await discoverVendorToolsResponse(vendor, {
				cache: discoveryCache,
				cacheTtlMs,
				forceRefresh: force_refresh,
				model,
				apiKey: resolveVendorApiKey(vendor, auth_token, envSource),
			});

			if (!discovery.ok) {
				return {
					content: [{ type: "text", text: discovery.error.message }],
					structuredContent: toStructuredContent(discovery),
				};
			}

			return {
				content: [
					{
						type: "text",
						text: `Discovered ${discovery.tools.length} ${vendor} tools for ${discovery.model}.`,
					},
				],
				structuredContent: toStructuredContent(discovery),
			};
		},
	);

	return server;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const cacheTtlMs = getDiscoveryCacheTtlMs(
			env as Record<string, string | undefined>,
		);
		const discoveryCache = createKvDiscoveryCache(
			(env as { DISCOVERY_CACHE?: KVNamespace }).DISCOVERY_CACHE,
		);

		if (url.pathname === "/mcp") {
			const handleMcp = createMcpHandler(
				createServer(env as Record<string, unknown>),
				mcpHandlerOptions,
			);
			return handleMcp(request, env, ctx);
		}

		if (url.pathname === "/discover-tools") {
			if (request.method === "GET") {
				const vendor = url.searchParams.get("vendor") ?? autoDetectVendor(request);
				const model = url.searchParams.get("model") ?? undefined;
				const forceRefresh = parseForceRefresh(
					url.searchParams.get("force_refresh"),
				);

				if (!vendor?.trim()) {
					const failure = discoveryErrorPayload(
						{
							code: "ERR_VENDOR",
							message:
								"Vendor is required. Provide ?vendor=... or send X-Vendor or vendor-specific auth headers for auto-detection.",
							status: 400,
						},
						400,
					);

					return jsonWithCache(failure.body, failure.status, cacheTtlMs);
				}

				const discovery = await discoverVendorToolsResponse(vendor, {
					cache: discoveryCache,
					cacheTtlMs,
					forceRefresh,
					model,
					apiKey: resolveVendorApiKey(
						vendor,
						readBearerToken(request),
						env as Record<string, unknown>,
					),
				});

				return jsonWithCache(
					discovery,
					discovery.ok ? 200 : discovery.error.status ?? 500,
					cacheTtlMs,
				);
			}

			if (request.method === "POST") {
				try {
					const body = (await request.json()) as {
						auth_token?: unknown;
						apiKey?: unknown;
						force_refresh?: unknown;
						forceRefresh?: unknown;
						model?: unknown;
						vendor?: unknown;
					};
					const vendor =
						typeof body.vendor === "string" && body.vendor.trim()
							? body.vendor.trim()
							: autoDetectVendor(request);

					if (!vendor?.trim()) {
						const failure = discoveryErrorPayload(
							{
								code: "ERR_VENDOR",
								message:
									"Vendor is required. Provide vendor in the request body or send X-Vendor or vendor-specific auth headers for auto-detection.",
								status: 400,
							},
							400,
						);

						return jsonWithCache(failure.body, failure.status, cacheTtlMs);
					}

					const authToken =
						typeof body.auth_token === "string"
							? body.auth_token
							: typeof body.apiKey === "string"
								? body.apiKey
								: readBearerToken(request);

					const discovery = await discoverVendorToolsResponse(vendor, {
						cache: discoveryCache,
						cacheTtlMs,
						forceRefresh:
							parseForceRefresh(body.force_refresh) ||
							parseForceRefresh(body.forceRefresh),
						model: typeof body.model === "string" ? body.model : undefined,
						apiKey: resolveVendorApiKey(
							vendor,
							authToken,
							env as Record<string, unknown>,
						),
					});

					return jsonWithCache(
						discovery,
						discovery.ok ? 200 : discovery.error.status ?? 500,
						cacheTtlMs,
					);
				} catch (error) {
					const failure = discoveryErrorPayload(
						{
							code: "ERR_NETWORK",
							message:
								error instanceof Error
									? error.message
									: "Unable to discover vendor tools.",
							status: 500,
						},
						500,
					);

					return jsonWithCache(failure.body, failure.status, cacheTtlMs);
				}
			}
		}

		if (url.pathname === "/" || url.pathname === "") {
			return Response.json({
				name: "lidlift-mcp",
				ok: true,
				transport: "streamable-http",
				endpoints: {
					health: "/health",
					discoverTools: "/discover-tools",
					mcp: "/mcp",
				},
				tools: ["analyze_tool_fit", "rank_tools", "discover_vendor_tools"],
			});
		}

		if (url.pathname === "/health") {
			return Response.json({
				name: "lidlift-mcp",
				ok: true,
				transport: "streamable-http",
				timestamp: new Date().toISOString(),
			});
		}

		return Response.json(
			{
				error: "Not Found",
				ok: false,
			},
			{ status: 404 },
		);
	},
} satisfies ExportedHandler<Env>;
