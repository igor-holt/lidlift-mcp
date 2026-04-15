export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    name: "lidlift-web",
    ok: true,
    services: {
      analyzer: "ready",
      openaiNarrative: process.env.OPENAI_API_KEY ? "configured" : "disabled",
    },
    timestamp: new Date().toISOString(),
  });
}
