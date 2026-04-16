export const DEFAULT_NARRATIVE_MODEL = "anthropic/claude-sonnet-4.6";

export function getNarrativeModelId() {
  return process.env.AI_GATEWAY_MODEL ?? DEFAULT_NARRATIVE_MODEL;
}

export function hasNarrativeProvider() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.VERCEL,
  );
}
