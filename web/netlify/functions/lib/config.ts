function ensureUrl(value: string | undefined, fieldName: string): string {
  if (!value) {
    throw new Error(`${fieldName} is required`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error(`${fieldName} must be a valid URL: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`${fieldName} must use http or https`);
  }

  return parsed.toString().replace(/\/$/, "");
}

export interface RuntimeConfig {
  proofFirstApiBase: string;
  overviewTtlSeconds: number;
  evidenceTtlSeconds: number;
  briefTtlSeconds: number;
  aiGatewayBaseUrl: string | null;
  aiGatewayToken: string | null;
  aiGatewayModel: string;
}

export function getRuntimeConfig(): RuntimeConfig {
  return {
    // Keep the proof-first FastAPI service as the source of truth instead of duplicating execution logic at the edge.
    proofFirstApiBase: ensureUrl(process.env.PROOF_FIRST_API_BASE, "PROOF_FIRST_API_BASE"),
    overviewTtlSeconds: Number(process.env.OVERVIEW_TTL_SECONDS ?? 30),
    evidenceTtlSeconds: Number(process.env.EVIDENCE_TTL_SECONDS ?? 300),
    briefTtlSeconds: Number(process.env.BRIEF_TTL_SECONDS ?? 180),
    aiGatewayBaseUrl: process.env.NETLIFY_AI_GATEWAY_BASE_URL ?? process.env.OPENAI_BASE_URL ?? null,
    aiGatewayToken: process.env.NETLIFY_AI_GATEWAY_TOKEN ?? process.env.OPENAI_API_KEY ?? null,
    aiGatewayModel: process.env.AI_GATEWAY_MODEL ?? "gpt-4o-mini",
  };
}
