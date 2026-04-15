import { DOMAIN_KEYWORDS, OPERATION_KEYWORDS } from "./lexicon";
import type {
  AnalysisInput,
  AnalysisResult,
  AnalysisSignal,
  GuardrailDecision,
  OperationMode,
  RankedToolResult,
  RiskLevel,
  ToolCandidate,
} from "./types";

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s*_-]/g, " ");
}

function tokenize(text: string) {
  return normalize(text)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function hasKeyword(haystack: string, tokens: string[], keyword: string) {
  const normalizedKeyword = normalize(keyword).trim();
  return normalizedKeyword.includes(" ")
    ? haystack.includes(normalizedKeyword)
    : tokens.includes(normalizedKeyword);
}

function jaccard(a: string[], b: string[]) {
  const left = new Set(a);
  const right = new Set(b);

  if (!left.size && !right.size) return 1;

  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function detectDomains(text: string) {
  const haystack = normalize(text);
  const tokens = tokenize(text);
  return Object.entries(DOMAIN_KEYWORDS)
    .filter(([, keywords]) =>
      keywords.some((keyword) => hasKeyword(haystack, tokens, keyword)),
    )
    .map(([domain]) => domain);
}

function detectOperations(text: string, explicit?: OperationMode) {
  const haystack = normalize(text);
  const tokens = tokenize(text);
  const inferred = Object.entries(OPERATION_KEYWORDS)
    .filter(([, keywords]) =>
      keywords.some((keyword) => hasKeyword(haystack, tokens, keyword)),
    )
    .map(([operation]) => operation as OperationMode);

  return explicit ? Array.from(new Set([...inferred, explicit])) : inferred;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function riskFrom(score: number, destructiveMismatch: boolean): RiskLevel {
  if (destructiveMismatch) return "critical";
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "moderate";
  return "low";
}

function decisionFor({
  alignmentScore,
  destructiveMismatch,
  dissonanceScore,
  lexicalOverlap,
  matchedDomains,
  matchedOperations,
  promptDomains,
  promptOperations,
}: {
  alignmentScore: number;
  destructiveMismatch: boolean;
  dissonanceScore: number;
  lexicalOverlap: number;
  matchedDomains: string[];
  matchedOperations: OperationMode[];
  promptDomains: string[];
  promptOperations: OperationMode[];
}) {
  const explicitDomainGap =
    promptDomains.length > 0 && matchedDomains.length === 0;
  const explicitOperationGap =
    promptOperations.length > 0 && matchedOperations.length === 0;
  const lowConfidence = alignmentScore < 0.32 || lexicalOverlap < 0.16;
  const positiveEvidence =
    matchedDomains.length > 0 || matchedOperations.length > 0;

  if (destructiveMismatch) {
    return {
      guardrailDecision: "block" as GuardrailDecision,
      guardrailReason:
        "The prompt reads as inspection or retrieval, but this tool exposes a write path.",
    };
  }

  if (explicitDomainGap && lowConfidence) {
    return {
      guardrailDecision: "clarify" as GuardrailDecision,
      guardrailReason:
        "The prompt names a domain the tool does not advertise, so the safe next step is clarification or a different tool.",
    };
  }

  if (explicitOperationGap && lowConfidence) {
    return {
      guardrailDecision: "clarify" as GuardrailDecision,
      guardrailReason:
        "The intended operation is not clearly supported by this tool, so execution should pause for clarification.",
    };
  }

  if (
    dissonanceScore >= 0.7 ||
    (dissonanceScore >= 0.45 &&
      (!positiveEvidence || lexicalOverlap < 0.22))
  ) {
    return {
      guardrailDecision: "review" as GuardrailDecision,
      guardrailReason:
        "Mismatch signals are strong enough that a person should review this tool choice before execution.",
    };
  }

  return {
    guardrailDecision: "allow" as GuardrailDecision,
    guardrailReason:
      "The prompt and tool show enough domain and operation evidence to proceed without extra gating.",
  };
}

function recommendationFor(decision: GuardrailDecision) {
  if (decision === "block") {
    return "Block execution and require a safer read-only or lower-impact tool.";
  }

  if (decision === "clarify") {
    return "Ask a clarification question or swap to a tool with explicit domain support before execution.";
  }

  if (decision === "review") {
    return "Gate this tool behind human review and surface a better-matched alternative.";
  }

  return "Allow execution and continue monitoring for downstream failures.";
}

function decisionPriority(decision: GuardrailDecision) {
  switch (decision) {
    case "allow":
      return 0;
    case "review":
      return 1;
    case "clarify":
      return 2;
    case "block":
      return 3;
  }
}

function addSignal(
  signals: AnalysisSignal[],
  condition: boolean,
  signal: AnalysisSignal,
) {
  if (condition) signals.push(signal);
}

export function analyzeToolFit({ prompt, tool }: AnalysisInput): AnalysisResult {
  const promptTokens = tokenize(prompt);
  const toolCorpus = [
    tool.name,
    tool.description,
    tool.category,
    ...(tool.capabilities ?? []),
    ...(tool.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  const toolTokens = tokenize(toolCorpus);

  const matchedDomains = detectDomains(prompt).filter((domain) =>
    detectDomains(toolCorpus).includes(domain),
  );
  const promptDomains = detectDomains(prompt);
  const toolDomains = detectDomains(toolCorpus);
  const mismatchedDomains = promptDomains.filter(
    (domain) => !toolDomains.includes(domain),
  );

  const promptOperations = detectOperations(prompt);
  const toolOperations = detectOperations(toolCorpus, tool.operationMode);
  const matchedOperations = promptOperations.filter((op) =>
    toolOperations.includes(op),
  );
  const conflictingOperations = promptOperations.filter(
    (op) => op === "read" && toolOperations.includes("write"),
  );

  const lexicalOverlap = jaccard(promptTokens, toolTokens);
  const domainAlignment =
    !promptDomains.length || !toolDomains.length
      ? 0.45
      : matchedDomains.length / new Set([...promptDomains, ...toolDomains]).size;
  const operationAlignment =
    !promptOperations.length || !toolOperations.length
      ? 0.5
      : matchedOperations.length / new Set([...promptOperations, ...toolOperations]).size;

  const destructiveMismatch =
    conflictingOperations.length > 0 &&
    !matchedOperations.includes("write") &&
    (tool.operationMode === "write" || toolOperations.includes("write"));

  const mismatchPenalty = mismatchedDomains.length ? 0.12 : 0;
  const destructivePenalty = destructiveMismatch ? 0.25 : 0;
  const domainMatchBonus = matchedDomains.length > 0 ? 0.05 : 0;

  const alignmentScore = clamp(
    lexicalOverlap * 0.35 + domainAlignment * 0.4 + operationAlignment * 0.25 -
      mismatchPenalty -
      destructivePenalty +
      domainMatchBonus,
  );

  const dissonanceScore = clamp(1 - alignmentScore);
  const riskLevel = riskFrom(dissonanceScore, destructiveMismatch);
  const { guardrailDecision, guardrailReason } = decisionFor({
    alignmentScore,
    destructiveMismatch,
    dissonanceScore,
    lexicalOverlap,
    matchedDomains,
    matchedOperations,
    promptDomains,
    promptOperations,
  });

  const signals: AnalysisSignal[] = [];

  addSignal(signals, lexicalOverlap >= 0.2, {
    label: "Shared vocabulary",
    detail: `Prompt and tool share ${Math.round(lexicalOverlap * 100)}% lexical similarity.`,
    impact: lexicalOverlap >= 0.35 ? "positive" : "neutral",
  });

  addSignal(signals, matchedDomains.length > 0, {
    label: "Domain match",
    detail: `Matched domain(s): ${matchedDomains.join(", ")}.`,
    impact: "positive",
  });

  addSignal(signals, mismatchedDomains.length > 0, {
    label: "Domain drift",
    detail: `Prompt expects ${mismatchedDomains.join(", ")} but the tool does not advertise those domains.`,
    impact: "negative",
  });

  addSignal(signals, destructiveMismatch, {
    label: "Write-risk mismatch",
    detail: "The prompt reads like a read-only intent, but the tool can perform write actions.",
    impact: "negative",
  });

  addSignal(signals, guardrailDecision === "clarify", {
    label: "Clarification required",
    detail: guardrailReason,
    impact: "negative",
  });

  addSignal(signals, matchedOperations.length > 0, {
    label: "Operation fit",
    detail: `Matched intent(s): ${matchedOperations.join(", ")}.`,
    impact: "positive",
  });

  const rationale = [
    `Guardrail decision: ${guardrailDecision}.`,
    `Lexical overlap: ${Math.round(lexicalOverlap * 100)}%.`,
    `Domain alignment: ${Math.round(domainAlignment * 100)}%.`,
    `Operation alignment: ${Math.round(operationAlignment * 100)}%.`,
  ];

  if (destructiveMismatch) {
    rationale.push("The tool exposes a write path for a prompt that reads like retrieval or inspection.");
  } else if (mismatchedDomains.length) {
    rationale.push(
      `The strongest mismatch is domain drift: ${mismatchedDomains.join(", ")}.`,
    );
  } else if (matchedDomains.length) {
    rationale.push(
      `The prompt and tool align in ${matchedDomains.join(", ")}.`,
    );
  }

  return {
    tool,
    prompt,
    alignmentScore,
    dissonanceScore,
    riskLevel,
    guardrailDecision,
    guardrailReason,
    recommendation: recommendationFor(guardrailDecision),
    rationale,
    matchedDomains,
    mismatchedDomains,
    matchedOperations,
    conflictingOperations,
    signals,
  };
}

export function rankTools(prompt: string, tools: ToolCandidate[]): RankedToolResult {
  const ranked = tools
    .map((tool) => analyzeToolFit({ prompt, tool }))
    .sort((left, right) => {
      const decisionDelta =
        decisionPriority(left.guardrailDecision) -
        decisionPriority(right.guardrailDecision);

      if (decisionDelta !== 0) {
        return decisionDelta;
      }

      return left.dissonanceScore - right.dissonanceScore;
    });

  return {
    best: ranked[0] ?? null,
    ranked,
  };
}
