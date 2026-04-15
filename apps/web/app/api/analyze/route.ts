import OpenAI from "openai";
import { rankTools, sampleToolCatalog, toolCatalogSchema } from "@tool-dissonance/core";

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
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { model: null, narrative: null } satisfies {
      model: string | null;
      narrative: string | null;
    };
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model,
    store: false,
    instructions:
      "You are an operator briefing assistant for a tool-safety product. Summarize the best candidate, the primary risk, and the guardrail decision in 2 short paragraphs. Use only the provided ranking data.",
    input: JSON.stringify(
      {
        prompt,
        best: ranked.best,
        ranked: ranked.ranked.slice(0, 4),
      },
      null,
      2,
    ),
  });

  return {
    model,
    narrative: response.output_text.trim() || null,
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
