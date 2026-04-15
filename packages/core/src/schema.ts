import { z } from "zod";

export const operationModeSchema = z.enum(["read", "write", "transform", "mixed"]);

export const riskLevelSchema = z.enum(["low", "moderate", "high", "critical"]);

export const toolCandidateSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1).optional(),
  operationMode: operationModeSchema.optional(),
  capabilities: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

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
