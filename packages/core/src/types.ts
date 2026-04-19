export type OperationMode = "read" | "write" | "transform" | "mixed";

export type RiskLevel = "low" | "moderate" | "high" | "critical";
export type GuardrailDecision = "allow" | "review" | "clarify" | "block";
export type Vendor = "openai" | "anthropic" | "xai" | "gemini";

export type DiscoveryErrorCode =
  | "ERR_VENDOR"
  | "ERR_AUTH"
  | "ERR_RATE_LIMIT"
  | "ERR_MODEL"
  | "ERR_UPSTREAM"
  | "ERR_NETWORK";

export interface ToolParameterSchema {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean | Record<string, unknown>;
  [key: string]: unknown;
}

export interface Tool {
  name: string;
  description: string;
  parameters?: ToolParameterSchema;
  category?: string;
  operationMode?: OperationMode;
  capabilities?: string[];
  tags?: string[];
}

export type ToolCandidate = Tool;

export interface AnalysisInput {
  prompt: string;
  tool: Tool;
}

export interface AnalysisSignal {
  label: string;
  detail: string;
  impact: "positive" | "negative" | "neutral";
}

export interface AnalysisResult {
  tool: Tool;
  prompt: string;
  alignmentScore: number;
  dissonanceScore: number;
  riskLevel: RiskLevel;
  guardrailDecision: GuardrailDecision;
  guardrailReason: string;
  recommendation: string;
  rationale: string[];
  matchedDomains: string[];
  mismatchedDomains: string[];
  matchedOperations: string[];
  conflictingOperations: string[];
  signals: AnalysisSignal[];
}

export interface RankedToolResult {
  best: AnalysisResult | null;
  ranked: AnalysisResult[];
}

export interface DiscoveryCacheEntry {
  expiresAt: number;
  fetchedAt: string;
  tools: Tool[];
}

export interface DiscoveryCacheAdapter {
  get(key: string): Promise<DiscoveryCacheEntry | null>;
  set(key: string, value: DiscoveryCacheEntry, ttlSeconds: number): Promise<void>;
}

export interface DiscoverVendorToolsOptions {
  model?: string;
  apiKey?: string;
  cacheTtlMs?: number;
  forceRefresh?: boolean;
  cache?: DiscoveryCacheAdapter;
  signal?: AbortSignal;
}

export interface DiscoveryError {
  code: DiscoveryErrorCode;
  message: string;
  retryAfterSeconds?: number;
  status?: number;
  vendor?: Vendor;
}

export interface DiscoveryMetadata {
  cached: boolean;
  fetchedAt: string;
  model: string | null;
  ttlSeconds: number;
  vendor: Vendor;
}

export interface DiscoverySuccessResponse extends DiscoveryMetadata {
  ok: true;
  tools: Tool[];
}

export interface DiscoveryErrorResponse {
  ok: false;
  error: DiscoveryError;
  model: string | null;
  vendor: Vendor | null;
}

export type DiscoveryResponse = DiscoverySuccessResponse | DiscoveryErrorResponse;
