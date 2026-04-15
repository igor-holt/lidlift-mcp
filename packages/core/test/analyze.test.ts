import { describe, expect, it } from "vitest";

import { analyzeToolFit, rankTools, sampleToolCatalog } from "../src";

describe("analyzeToolFit", () => {
  it("scores a strong weather match as low dissonance", () => {
    const result = analyzeToolFit({
      prompt: "What is the weather in Paris tomorrow morning?",
      tool: sampleToolCatalog[0],
    });

    expect(result.dissonanceScore).toBeLessThan(0.45);
    expect(result.riskLevel).toBe("low");
    expect(result.guardrailDecision).toBe("allow");
  });

  it("flags write-risk mismatch", () => {
    const result = analyzeToolFit({
      prompt: "Read the latest deployment logs for this project.",
      tool: sampleToolCatalog[1],
    });

    expect(result.riskLevel).toBe("critical");
    expect(result.guardrailDecision).toBe("block");
    expect(result.conflictingOperations).toContain("read");
  });

  it("asks for clarification when the prompt domain is explicit but unsupported", () => {
    const result = analyzeToolFit({
      prompt: "Find archived genomic variants for this allele and species.",
      tool: sampleToolCatalog[2],
    });

    expect(result.guardrailDecision).toBe("clarify");
    expect(result.mismatchedDomains).toContain("life_science");
  });
});

describe("rankTools", () => {
  it("returns the best candidate first", () => {
    const ranked = rankTools(
      "Find the best tool to score prompt and tool mismatch in an MCP workflow.",
      sampleToolCatalog,
    );

    expect(ranked.best?.tool.name).toBe("tool_fit_analyzer");
    expect(ranked.best?.guardrailDecision).not.toBe("block");
  });
});
