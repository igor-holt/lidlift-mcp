import { z } from "zod";

export const operationModeSchema = z.enum(["read", "write", "transform", "mixed"]);

export const riskLevelSchema = z.enum(["low", "moderate", "high", "critical"]);
export const vendorSchema = z.enum(["openai", "anthropic", "xai", "gemini"]);
export const guardrailDecisionSchema = z.enum([
  "allow",
  "review",
  "clarify",
  "block",
]);

export const toolParameterSchemaSchema = z.object({
  type: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  required: z.array(z.string().min(1)).optional(),
  additionalProperties: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
}).catchall(z.unknown());

export const toolCandidateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: toolParameterSchemaSchema.optional(),
  category: z.string().min(1).optional(),
  operationMode: operationModeSchema.optional(),
  capabilities: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export const toolSchema = toolCandidateSchema;
export const toolCatalogSchema = z.array(toolCandidateSchema).min(1).max(50);

export const analysisSignalSchema = z.object({
  label: z.string(),
  detail: z.string(),
  impact: z.enum(["positive", "negative", "neutral"]),
});

export const analysisResultSchema = z.object({
  tool: toolCandidateSchema,
  prompt: z.string(),
  alignmentScore: z.number().min(0).max(1),
  dissonanceScore: z.number().min(0).max(1),
  riskLevel: riskLevelSchema,
  guardrailDecision: guardrailDecisionSchema,
  guardrailReason: z.string(),
  recommendation: z.string(),
  rationale: z.array(z.string()),
  matchedDomains: z.array(z.string()),
  mismatchedDomains: z.array(z.string()),
  matchedOperations: z.array(operationModeSchema),
  conflictingOperations: z.array(operationModeSchema),
  signals: z.array(analysisSignalSchema),
});

export const rankedToolResultSchema = z.object({
  best: analysisResultSchema.nullable(),
  ranked: z.array(analysisResultSchema),
});

export const discoveryErrorSchema = z.object({
  code: z.enum([
    "ERR_VENDOR",
    "ERR_AUTH",
    "ERR_RATE_LIMIT",
    "ERR_MODEL",
    "ERR_UPSTREAM",
    "ERR_NETWORK",
  ]),
  message: z.string().min(1),
  retryAfterSeconds: z.number().int().positive().optional(),
  status: z.number().int().positive().optional(),
  vendor: vendorSchema.optional(),
});

export const discoveryMetadataSchema = z.object({
  cached: z.boolean(),
  fetchedAt: z.string().min(1),
  model: z.string().min(1).nullable(),
  ttlSeconds: z.number().int().positive(),
  vendor: vendorSchema,
});

export const discoverySuccessResponseSchema = discoveryMetadataSchema.extend({
  ok: z.literal(true),
  tools: z.array(toolSchema),
});

export const discoveryErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: discoveryErrorSchema,
  model: z.string().min(1).nullable(),
  vendor: vendorSchema.nullable(),
});

export const discoveryResponseSchema = z.union([
  discoverySuccessResponseSchema,
  discoveryErrorResponseSchema,
]);
