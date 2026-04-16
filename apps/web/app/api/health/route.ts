import { hasNarrativeProvider } from "@/lib/narrative-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    name: "lidlift-web",
    ok: true,
    services: {
      analyzer: "ready",
      narrativeBriefing: hasNarrativeProvider() ? "configured" : "disabled",
    },
    timestamp: new Date().toISOString(),
  });
}
