export type OperationMode = "read" | "write" | "transform" | "mixed";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface ToolCandidate {
  name: string;
  description: string;
  category?: string;
  operationMode?: OperationMode;
  capabilities?: string[];
  tags?: string[];
}

export interface AnalysisInput {
  prompt: string;
  tool: ToolCandidate;
}

export interface AnalysisSignal {
  label: string;
  detail: string;
  impact: "positive" | "negative" | "neutral";
}

export interface AnalysisResult {
  tool: ToolCandidate;
  prompt: string;
  alignmentScore: number;
  dissonanceScore: number;
  riskLevel: RiskLevel;
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

