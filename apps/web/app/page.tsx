import {
  ArrowUpRight,
  Cloud,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";

import { AnalyzerConsole } from "@/components/analyzer-console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.7),transparent_40%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.15),transparent_34%)]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-16 px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-8">
            <div className="flex flex-wrap gap-2">
              <Badge className="rounded-full border-transparent bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                LidLift
              </Badge>
              <Badge className="rounded-full border-transparent bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
                Vercel + Cloudflare + OpenAI
              </Badge>
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.05em] text-foreground sm:text-6xl lg:text-7xl">
                Stop AI agents from choosing the wrong tool.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                LidLift scores prompt-tool fit before execution, turns it into an explicit allow, review, clarify, or block decision, and exposes the same analyzer through a live API and remote MCP server.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-5">
                <a href="#console">
                  Run the analyzer
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-5">
                <a
                  href="https://github.com/igor-holt/lidlift-mcp"
                  target="_blank"
                  rel="noreferrer"
                >
                  View source
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-5">
                <a href="https://api.optimizationinversion.com" target="_blank" rel="noreferrer">
                  Open live API
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-none bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.07)] backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-4xl font-semibold">4</CardTitle>
                  <CardDescription>Guardrail outcomes: allow, review, clarify, block</CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-none bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.07)] backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-4xl font-semibold">1</CardTitle>
                  <CardDescription>Public repo and launch surface on your own domain</CardDescription>
                </CardHeader>
              </Card>
              <Card className="border-none bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.07)] backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-4xl font-semibold">2</CardTitle>
                  <CardDescription>Shared runtime surfaces: HTTP and MCP</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          <Card className="border-none bg-white/82 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">Selected launch integration</CardTitle>
              <CardDescription>
                The best fit for this product is a split runtime: Vercel for the operator console, Cloudflare for the remote MCP surface, and OpenAI Responses for the optional narrative layer.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-3xl border border-border/70 bg-background/75 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  Web control plane on Vercel
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Fast Next.js App Router deploys, typed API routes, and a polished launch surface for analysts and operators.
                </p>
              </div>
              <div className="rounded-3xl border border-border/70 bg-background/75 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Cloud className="size-4 text-primary" />
                  Remote MCP server on Cloudflare
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Streamable HTTP transport on `/mcp`, low-latency edge distribution, and a public endpoint that shares the same analysis engine.
                </p>
              </div>
              <div className="rounded-3xl border border-border/70 bg-background/75 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="size-4 text-primary" />
                  OpenAI Responses for operator briefings
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Deterministic ranking stays primary. Responses adds a concise launch-grade explanation when you want human-readable triage.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <AnalyzerConsole />

        <section className="grid gap-6 lg:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Block costly misfires",
              body: "Read-vs-write mismatches do not just get a scary score. They can be hard-blocked before an agent publishes, refunds, deletes, or sends the wrong thing.",
            },
            {
              icon: Waves,
              title: "One engine, every surface",
              body: "The browser preview, Next.js API, and Cloudflare MCP server all run the same analyzer, so demos, operators, and agents stay aligned.",
            },
            {
              icon: Sparkles,
              title: "Built to spread",
              body: "A public API, a live MCP endpoint, and a sharp share card make this easy to demo, post, and reuse in other tool-routing stacks.",
            },
          ].map(({ body, icon: Icon, title }) => (
            <Card
              key={title}
              className="border-none bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.07)] backdrop-blur"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Icon className="size-5 text-primary" />
                  {title}
                </CardTitle>
                <CardDescription className="leading-7">{body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section id="launch" className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="space-y-4">
            <Badge className="rounded-full border-transparent bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Launch Checklist
            </Badge>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
              What is already productized
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              The remaining work is distribution, benchmarks, and operator adoption. The product surface, API contract, and MCP server are already aligned.
            </p>
          </div>

          <Card className="border-none bg-white/82 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <CardContent className="grid gap-5 pt-6">
              {[
                "Shared `@tool-dissonance/core` package for heuristics, schemas, and sample catalog.",
                "Next.js operator console with live preview, ranked results, and explicit guardrail decisions.",
                "Cloudflare Worker exposing `analyze_tool_fit` and `rank_tools` over remote MCP transport on `/mcp`.",
                "Health endpoints and environment examples for both the web app and the Worker.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-3xl border border-border/70 bg-background/75 p-4">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-sm leading-6 text-foreground">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section id="api" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <Badge className="rounded-full border-transparent bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Surface Area
            </Badge>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
              Launch interfaces
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              The product ships as both a human-facing console and an agent-facing endpoint. That keeps operator workflows and agent workflows on the same scoring contract.
            </p>
          </div>

          <Card className="border-none bg-white/82 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <CardHeader>
              <CardTitle>API map</CardTitle>
              <CardDescription>Minimal endpoints needed to ship the first production release.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 font-mono text-xs leading-7 text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground">POST /api/analyze</p>
                <p>Rank prompt-tool fit for the supplied catalog and optionally attach an OpenAI-generated operator brief.</p>
              </div>
              <Separator />
              <div>
                <p className="font-semibold text-foreground">GET /api/health</p>
                <p>Expose web readiness and whether OpenAI narrative generation is configured.</p>
              </div>
              <Separator />
              <div>
                <p className="font-semibold text-foreground">POST /mcp</p>
                <p>Remote MCP transport on Cloudflare Workers. Provides analysis tools to external clients over Streamable HTTP.</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
