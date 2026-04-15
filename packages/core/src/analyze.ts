import { DOMAIN_KEYWORDS, OPERATION_KEYWORDS } from "./lexicon";
import type {
  AnalysisInput,
  AnalysisResult,
  AnalysisSignal,
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

function recommendationFor(score: number, destructiveMismatch: boolean) {
  if (destructiveMismatch) {
    return "Require explicit approval or choose a read-only tool before execution.";
  }

  if (score >= 0.75) {
    return "Reject this tool for the current prompt and surface safer alternatives.";
  }

  if (score >= 0.45) {
    return "Gate this tool behind review and provide a better-matched option.";
  }

  return "This tool is a reasonable fit for the prompt.";
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

  addSignal(signals, matchedOperations.length > 0, {
    label: "Operation fit",
    detail: `Matched intent(s): ${matchedOperations.join(", ")}.`,
    impact: "positive",
  });

  const rationale = [
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
    recommendation: recommendationFor(dissonanceScore, destructiveMismatch),
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
    .sort((left, right) => left.dissonanceScore - right.dissonanceScore);

  return {
    best: ranked[0] ?? null,
    ranked,
  };
}
