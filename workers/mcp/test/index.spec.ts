import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

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
});
