import {
	analyzeToolFit,
	rankTools,
	sampleToolCatalog,
	toolCandidateSchema,
	toolCatalogSchema,
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
		},
	},
	async ({ prompt, tools }) => {
		const result = rankTools(prompt, tools ?? sampleToolCatalog);

		return {
			content: [{ type: "text", text: formatRankingText(result) }],
			structuredContent: toStructuredContent(result),
		};
	},
);

const handleMcp = createMcpHandler(server, {
	route: "/mcp",
	corsOptions: {
		origin: "*",
		methods: "GET, POST, DELETE, OPTIONS",
		headers:
			"Content-Type, Authorization, Last-Event-ID, MCP-Protocol-Version, mcp-session-id",
		exposeHeaders: "MCP-Protocol-Version, mcp-session-id",
		maxAge: 86400,
	},
});

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/mcp") {
			return handleMcp(request, env, ctx);
		}

		if (url.pathname === "/" || url.pathname === "") {
			return Response.json({
				name: "lidlift-mcp",
				ok: true,
				transport: "streamable-http",
				endpoints: {
					health: "/health",
					mcp: "/mcp",
				},
				tools: ["analyze_tool_fit", "rank_tools"],
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
