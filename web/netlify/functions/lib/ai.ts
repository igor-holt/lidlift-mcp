import OpenAI from "openai";

import type { OverviewPayload } from "../../../src/types";
import { getRuntimeConfig } from "./config";
import { buildFallbackBrief, buildOperatorBriefPrompt } from "./prompts";

export async function generateOperatorBrief(
  overview: OverviewPayload,
  evidence: unknown,
  cycleId: string | null,
): Promise<{ summary: string; model: string }> {
  const config = getRuntimeConfig();
  if (!config.aiGatewayBaseUrl || !config.aiGatewayToken) {
    return {
      summary: buildFallbackBrief(overview, evidence, cycleId),
      model: "fallback-local",
    };
  }

  const client = new OpenAI({
    apiKey: config.aiGatewayToken,
    baseURL: config.aiGatewayBaseUrl,
  });
  const response = await client.responses.create({
    model: config.aiGatewayModel,
    input: buildOperatorBriefPrompt(overview, evidence, cycleId),
    max_output_tokens: 300,
  });

  return {
    summary: response.output_text || buildFallbackBrief(overview, evidence, cycleId),
    model: config.aiGatewayModel,
  };
}
