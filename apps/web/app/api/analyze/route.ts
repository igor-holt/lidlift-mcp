import { generateText, gateway, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { autoDetectVendor, rankTools } from "@tool-dissonance/core";
import {
  getNarrativeModelId,
  hasNarrativeProvider,
} from "@/lib/narrative-config";
import { resolveToolCatalog } from "@/lib/tool-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NarrativePayload = Awaited<ReturnType<typeof buildNarrative>>;

async function buildNarrative({
  prompt,
  ranked,
}: {
  prompt: string;
  ranked: ReturnType<typeof rankTools>;
}) {
  if (!hasNarrativeProvider()) {
    return { model: null, narrative: null } satisfies {
      model: string | null;
      narrative: string | null;
    };
  }

  const modelId = getNarrativeModelId();
  const baseModel = gateway(modelId);
  const model =
    process.env.NODE_ENV === "production"
      ? baseModel
      : wrapLanguageModel({
          model: baseModel,
          middleware: devToolsMiddleware(),
        });

  const response = await generateText({
    model,
    system:
      "You are an operator briefing assistant for a tool-safety product. Summarize the best candidate, the primary risk, and the guardrail decision in 2 short paragraphs. Use only the provided ranking data.",
    prompt: JSON.stringify(
      {
        prompt,
        best: ranked.best,
        ranked: ranked.ranked.slice(0, 4),
      },
      null,
      2,
    ),
    providerOptions: {
      gateway: {
        tags: ["lidlift", "operator-brief"],
      },
    },
  });

  return {
    model: modelId,
    narrative: response.text.trim() || null,
  } satisfies {
    model: string | null;
    narrative: string | null;
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      auth_token?: unknown;
      apiKey?: unknown;
      force_refresh?: unknown;
      forceRefresh?: unknown;
      includeNarrative?: boolean;
      model?: unknown;
      prompt?: unknown;
      tools?: unknown;
      vendor?: unknown;
    };

    const prompt =
      typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "ERR_REQUEST",
            message: "Prompt is required.",
          },
        },
        { status: 400 },
      );
    }

    const requestedVendor =
      typeof body.vendor === "string" && body.vendor.trim()
        ? body.vendor
        : autoDetectVendor(request) ?? undefined;

    const resolvedCatalog = await resolveToolCatalog(
      {
        authToken:
          typeof body.auth_token === "string"
            ? body.auth_token
            : typeof body.apiKey === "string"
              ? body.apiKey
              : undefined,
        forceRefresh:
          body.force_refresh === true ||
          body.forceRefresh === true ||
          body.force_refresh === "true" ||
          body.forceRefresh === "true",
        model: typeof body.model === "string" ? body.model : undefined,
        tools: body.tools,
        vendor: requestedVendor,
      },
      process.env,
    );

    if ("error" in resolvedCatalog) {
      return Response.json(
        {
          ok: false,
          discovery: resolvedCatalog.discovery,
          error: resolvedCatalog.error,
        },
        { status: resolvedCatalog.status },
      );
    }

    const tools = resolvedCatalog.tools;
    const ranked = rankTools(prompt, tools);
    const narrative: NarrativePayload =
      body.includeNarrative === false
        ? { model: null, narrative: null }
        : await buildNarrative({ prompt, ranked });

    return Response.json({
      ...ranked,
      catalogSize: resolvedCatalog.catalogSize,
      catalogSource: resolvedCatalog.catalogSource,
      discovery: resolvedCatalog.discovery,
      generatedAt: new Date().toISOString(),
      model: narrative.model,
      narrative: narrative.narrative,
      prompt,
      requestedModel: resolvedCatalog.model,
      vendor: resolvedCatalog.vendor,
    });
  } catch (error) {
    const status =
      error instanceof Error &&
      error.message === "Invalid tool catalog."
        ? 400
        : 500;

    return Response.json(
      {
        ok: false,
        error: {
          code: status === 400 ? "ERR_REQUEST" : "ERR_NETWORK",
          message:
            error instanceof Error
              ? error.message
              : "Unable to analyze this request.",
        },
      },
      { status },
    );
  }
}
