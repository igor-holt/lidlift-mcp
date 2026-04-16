import { generateText, gateway, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { rankTools, sampleToolCatalog, toolCatalogSchema } from "@tool-dissonance/core";
import {
  getNarrativeModelId,
  hasNarrativeProvider,
} from "@/lib/narrative-config";

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

function parseTools(value: unknown) {
  if (value === undefined) {
    return sampleToolCatalog;
  }

  const parsed = toolCatalogSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid tool catalog.");
  }

  return parsed.data;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      includeNarrative?: boolean;
      prompt?: unknown;
      tools?: unknown;
    };

    const prompt =
      typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return Response.json(
        { error: "Prompt is required." },
        { status: 400 },
      );
    }

    const tools = parseTools(body.tools);
    const ranked = rankTools(prompt, tools);
    const narrative: NarrativePayload =
      body.includeNarrative === false
        ? { model: null, narrative: null }
        : await buildNarrative({ prompt, ranked });

    return Response.json({
      ...ranked,
      catalogSize: tools.length,
      generatedAt: new Date().toISOString(),
      model: narrative.model,
      narrative: narrative.narrative,
      prompt,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze this request.",
      },
      { status: 500 },
    );
  }
}
