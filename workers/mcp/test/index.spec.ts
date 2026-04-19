import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe("LidLift MCP worker", () => {
	it("returns service metadata at root", async () => {
		const request = new Request<unknown, IncomingRequestCfProperties>(
			"http://example.com/"
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			name: "lidlift-mcp",
			ok: true,
			transport: "streamable-http",
		});
	});

	it("returns health information through the deployed worker", async () => {
		const request = new Request("http://example.com/health");
		const response = await SELF.fetch(request);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			name: "lidlift-mcp",
			ok: true,
			transport: "streamable-http",
		});
		expect(typeof payload.timestamp).toBe("string");
	});

	it("discovers vendor tools through the public worker endpoint", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);

			if (url === "https://api.openai.com/v1/models/gpt-5") {
				return new Response(JSON.stringify({ id: "gpt-5" }), { status: 200 });
			}

			throw new Error(`Unexpected fetch: ${url}`);
		});

		globalThis.fetch = fetchMock as typeof fetch;

		const request = new Request(
			"http://example.com/discover-tools?vendor=openai&model=gpt-5",
			{
				headers: {
					authorization: "Bearer sk-test",
				},
			},
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			ok: true,
			vendor: "openai",
			model: "gpt-5",
		});
		expect(payload.tools.map((tool: { name: string }) => tool.name)).toContain(
			"web_search",
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("auto-detects the vendor and honors force_refresh", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);

			if (url === "https://api.openai.com/v1/models/gpt-5") {
				return new Response(JSON.stringify({ id: "gpt-5" }), { status: 200 });
			}

			throw new Error(`Unexpected fetch: ${url}`);
		});

		globalThis.fetch = fetchMock as typeof fetch;

		const request = new Request(
			"http://example.com/discover-tools?model=gpt-5&force_refresh=true",
			{
				headers: {
					"user-agent": "OpenAI Codex",
					authorization: "Bearer sk-test",
				},
			},
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toMatchObject({
			cached: false,
			ok: true,
			vendor: "openai",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
