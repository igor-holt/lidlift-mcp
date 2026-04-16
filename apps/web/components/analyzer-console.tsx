"use client";

import { useDeferredValue, useState, useTransition } from "react";
import type { AnalysisResult, RankedToolResult, ToolCandidate } from "@tool-dissonance/core";
import { rankTools, sampleToolCatalog, toolCatalogSchema } from "@tool-dissonance/core";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCheck,
  ScanSearch,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AnalyzeApiResponse = RankedToolResult & {
  catalogSize: number;
  generatedAt: string;
  model: string | null;
  narrative: string | null;
  prompt: string;
};

const defaultPrompt =
  "Read the latest deployment logs for this project and recommend the safest tool to use.";

const demoPrompts = [
  "Read the latest deployment logs for this project and recommend the safest tool to use.",
  "Publish the current branch, push it to GitHub, and open a draft pull request.",
  "Resolve archived genomic variants and explain which dataset is the best fit.",
  "Find the best tool to score prompt-to-tool mismatch in an MCP workflow.",
];

const defaultCatalog = JSON.stringify(sampleToolCatalog, null, 2);

const riskTone = {
  low: "bg-emerald-500/12 text-emerald-900 ring-emerald-800/15",
  moderate: "bg-amber-500/14 text-amber-900 ring-amber-900/15",
  high: "bg-orange-500/14 text-orange-900 ring-orange-900/15",
  critical: "bg-rose-500/14 text-rose-900 ring-rose-900/15",
} as const;

const decisionTone = {
  allow: "bg-emerald-500/12 text-emerald-900 ring-emerald-800/15",
  review: "bg-amber-500/14 text-amber-900 ring-amber-900/15",
  clarify: "bg-sky-500/12 text-sky-900 ring-sky-900/15",
  block: "bg-rose-500/14 text-rose-900 ring-rose-900/15",
} as const;

const impactTone = {
  positive: "bg-emerald-500/12 text-emerald-900 ring-emerald-800/15",
  neutral: "bg-slate-500/12 text-slate-800 ring-slate-800/15",
  negative: "bg-rose-500/14 text-rose-900 ring-rose-900/15",
} as const;

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function parseCatalogDraft(source: string) {
  try {
    const parsed = JSON.parse(source);
    const tools = toolCatalogSchema.parse(parsed);
    return { tools, error: null as string | null };
  } catch (error) {
    return {
      tools: null as ToolCandidate[] | null,
      error:
        error instanceof Error
          ? error.message
          : "Catalog JSON is invalid. Provide an array of tools.",
    };
  }
}

function ResultSignal({
  label,
  detail,
  impact,
}: AnalysisResult["signals"][number]) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge
          className={cn(
            "rounded-full border-transparent px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em]",
            impactTone[impact],
          )}
        >
          {impact}
        </Badge>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ResultCard({
  title,
  description,
  result,
}: {
  title: string;
  description: string;
  result: AnalysisResult | null;
}) {
  if (!result) {
    return (
      <Card className="border-none bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-3xl border border-dashed border-border/80 bg-background/70 p-6 text-sm leading-6 text-muted-foreground">
            Run the analyzer to populate the ranking, risk signal breakdown, and operator brief.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge
              className={cn(
                "rounded-full border-transparent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                decisionTone[result.guardrailDecision],
              )}
            >
              {result.guardrailDecision}
            </Badge>
            <Badge
              className={cn(
                "rounded-full border-transparent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                riskTone[result.riskLevel],
              )}
            >
              {result.riskLevel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Best Candidate
              </p>
              <h3 className="text-xl font-semibold text-foreground">{result.tool.name}</h3>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Alignment {formatPercent(result.alignmentScore)}</p>
              <p>Dissonance {formatPercent(result.dissonanceScore)}</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{result.tool.description}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Guardrail
            </p>
            <div className="mb-3 flex items-center gap-2">
              <Badge
                className={cn(
                  "rounded-full border-transparent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
                  decisionTone[result.guardrailDecision],
                )}
              >
                {result.guardrailDecision}
              </Badge>
            </div>
            <p className="mb-3 text-sm leading-6 text-foreground">{result.guardrailReason}</p>
            <p className="text-sm leading-6 text-muted-foreground">{result.recommendation}</p>
          </div>
          <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Matched Intent
            </p>
            <div className="flex flex-wrap gap-2">
              {result.matchedDomains.length === 0 && result.matchedOperations.length === 0 ? (
                <span className="text-sm text-muted-foreground">No direct matches detected.</span>
              ) : null}
              {result.matchedDomains.map((domain) => (
                <Badge
                  key={domain}
                  className="rounded-full border-transparent bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary"
                >
                  {domain.replaceAll("_", " ")}
                </Badge>
              ))}
              {result.matchedOperations.map((operation) => (
                <Badge
                  key={operation}
                  className="rounded-full border-transparent bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary-foreground"
                >
                  {operation}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {result.signals.map((signal) => (
            <ResultSignal key={`${signal.label}-${signal.impact}`} {...signal} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyzerConsole() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [catalogDraft, setCatalogDraft] = useState(defaultCatalog);
  const [includeNarrative, setIncludeNarrative] = useState(true);
  const [result, setResult] = useState<AnalyzeApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const deferredPrompt = useDeferredValue(prompt);
  const parsedCatalog = parseCatalogDraft(catalogDraft);
  const livePreview =
    deferredPrompt.trim().length > 0 && parsedCatalog.tools
      ? rankTools(deferredPrompt, parsedCatalog.tools)
      : null;
  const activeResult = result?.best ?? livePreview?.best ?? null;

  async function handleAnalyze() {
    if (!prompt.trim()) {
      setError("Enter a prompt before running the analyzer.");
      return;
    }

    if (!parsedCatalog.tools) {
      setError(parsedCatalog.error);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          tools: parsedCatalog.tools,
          includeNarrative,
        }),
      });

      const payload = (await response.json()) as
        | AnalyzeApiResponse
        | { error?: string };

      if (!response.ok) {
        const message =
          "error" in payload ? payload.error : undefined;
        throw new Error(message ?? "Analyzer request failed.");
      }

      startTransition(() => {
        setResult(payload as AnalyzeApiResponse);
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Analyzer request failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      id="console"
      className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
    >
      <Card className="border-none bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge className="rounded-full border-transparent bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Interactive Console
                </Badge>
                <Badge className="rounded-full border-transparent bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
                  Vercel UI + Cloudflare MCP
                </Badge>
              </div>
              <CardTitle className="text-2xl">Run the launch path before the model does</CardTitle>
              <CardDescription className="max-w-2xl leading-7">
                Score prompt-tool fit, inspect ranked alternatives, and optionally generate an operator brief through the Vercel AI SDK.
              </CardDescription>
            </div>
            <div className="rounded-3xl border border-border/70 bg-background/80 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Live Preview
              </p>
              <p className="text-lg font-semibold text-foreground">
                {livePreview?.best?.tool.name ?? "No candidate yet"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs defaultValue="prompt">
            <TabsList variant="line">
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="catalog">Catalog JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="prompt" className="space-y-4 pt-2">
              <div className="rounded-[28px] border border-border/70 bg-background/70 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  User prompt
                </p>
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="min-h-40 rounded-[22px] border-none bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                  placeholder="Describe the user intent you need to route safely."
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {demoPrompts.map((candidate) => (
                  <Button
                    key={candidate}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPrompt(candidate)}
                    className="rounded-full bg-white/70 px-3"
                  >
                    {candidate}
                  </Button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="catalog" className="space-y-4 pt-2">
              <div className="rounded-[28px] border border-border/70 bg-background/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Candidate tools
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCatalogDraft(defaultCatalog)}
                    className="rounded-full"
                  >
                    Reset sample catalog
                  </Button>
                </div>
                <Textarea
                  value={catalogDraft}
                  onChange={(event) => setCatalogDraft(event.target.value)}
                  className="min-h-[28rem] rounded-[22px] border-none bg-transparent font-mono text-xs leading-6 shadow-none focus-visible:ring-0"
                  spellCheck={false}
                />
              </div>

              {parsedCatalog.error ? (
                <Alert variant="destructive" className="rounded-[24px] border-destructive/20 bg-destructive/5">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Catalog validation failed</AlertTitle>
                  <AlertDescription>{parsedCatalog.error}</AlertDescription>
                </Alert>
              ) : (
                <Alert className="rounded-[24px] border-primary/10 bg-primary/5">
                  <CheckCheck className="size-4 text-primary" />
                  <AlertTitle>Catalog ready</AlertTitle>
                  <AlertDescription>
                    {parsedCatalog.tools?.length} tools loaded. These exact candidates will be ranked by the API and exposed through the MCP server.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="flex flex-col gap-3 rounded-[28px] border border-border/70 bg-background/70 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={includeNarrative}
                onChange={(event) => setIncludeNarrative(event.target.checked)}
                className="mt-1 size-4 rounded border-border text-primary"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-foreground">
                  Generate operator brief with AI Gateway
                </span>
                <span className="block text-sm leading-6 text-muted-foreground">
                  When AI Gateway auth is available, the API adds a short launch-grade narrative on top of the deterministic ranking.
                </span>
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ScanSearch className="size-4" />
                <span>
                  {parsedCatalog.tools?.length ?? 0} candidate tools available for this run
                </span>
              </div>
              <Button
                type="button"
                size="lg"
                onClick={handleAnalyze}
                disabled={isSubmitting || isPending}
                className="rounded-full px-5"
              >
                {isSubmitting ? "Scoring…" : "Analyze tool fit"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive" className="rounded-[24px] border-destructive/20 bg-destructive/5">
              <ShieldAlert className="size-4" />
              <AlertTitle>Request failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-3 border-none bg-transparent pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border-transparent bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
              Deterministic ranking
            </Badge>
            <Badge className="rounded-full border-transparent bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-secondary-foreground">
              Shared with MCP server
            </Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            The browser preview uses the same core ranking logic as the API and Cloudflare MCP endpoint, so your product UI and agent runtime stay aligned.
          </p>
        </CardFooter>
      </Card>

      <div className="space-y-6">
        <ResultCard
          title="Best Fit"
          description="The current top-ranked candidate from the same engine used by the MCP server."
          result={activeResult}
        />

        <Card className="border-none bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="size-5 text-primary" />
              Ranking Board
            </CardTitle>
            <CardDescription>
              Lower dissonance is better. Use this to gate write-capable tools before execution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(result?.ranked ?? livePreview?.ranked ?? []).map((entry, index) => (
              <div
                key={`${entry.tool.name}-${index}`}
                className="rounded-3xl border border-border/70 bg-background/75 p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Rank {index + 1}
                    </p>
                    <h3 className="text-base font-semibold text-foreground">{entry.tool.name}</h3>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge
                      className={cn(
                        "rounded-full border-transparent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
                        decisionTone[entry.guardrailDecision],
                      )}
                    >
                      {entry.guardrailDecision}
                    </Badge>
                    <Badge
                      className={cn(
                        "rounded-full border-transparent px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
                        riskTone[entry.riskLevel],
                      )}
                    >
                      {entry.riskLevel}
                    </Badge>
                  </div>
                </div>
                <p className="mb-3 text-sm leading-6 text-muted-foreground">
                  {entry.tool.description}
                </p>
                <p className="mb-3 text-sm leading-6 text-foreground">
                  {entry.guardrailReason}
                </p>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>Dissonance: {formatPercent(entry.dissonanceScore)}</p>
                  <p>Alignment: {formatPercent(entry.alignmentScore)}</p>
                </div>
              </div>
            ))}

            {(result?.ranked ?? livePreview?.ranked ?? []).length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border/80 bg-background/70 p-6 text-sm leading-6 text-muted-foreground">
                No ranked tools yet. Use one of the demo prompts or paste a custom catalog.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-none bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Operator Brief
            </CardTitle>
            <CardDescription>
              Optional narrative summary from the Vercel AI SDK. The ranking itself remains deterministic.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result?.narrative ? (
              <div className="space-y-3 rounded-3xl border border-border/70 bg-background/80 p-4">
                <p className="text-sm leading-7 whitespace-pre-wrap text-foreground">
                  {result.narrative}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <span>Generated {new Date(result.generatedAt).toLocaleString()}</span>
                  {result.model ? <span>Model {result.model}</span> : null}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border/80 bg-background/70 p-6 text-sm leading-6 text-muted-foreground">
                {includeNarrative
                  ? "Set AI Gateway auth for local development, then rerun the analyzer."
                  : "Narrative generation is disabled for this run."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
