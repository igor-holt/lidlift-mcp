import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LidLift";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "58px",
          background:
            "linear-gradient(140deg, rgb(255,250,240) 0%, rgb(248,244,233) 45%, rgb(229,238,247) 100%)",
          color: "rgb(20, 34, 56)",
          fontFamily: "Space Grotesk",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "30px auto auto 34px",
            display: "flex",
            width: "160px",
            height: "160px",
            borderRadius: "999px",
            background: "radial-gradient(circle, rgba(14,165,233,0.22), rgba(14,165,233,0))",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "auto 26px 18px auto",
            display: "flex",
            width: "280px",
            height: "280px",
            borderRadius: "999px",
            background: "radial-gradient(circle, rgba(245,158,11,0.20), rgba(245,158,11,0))",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            border: "1px solid rgba(20,34,56,0.08)",
            borderRadius: "32px",
            padding: "40px",
            background: "rgba(255,255,255,0.72)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                borderRadius: "999px",
                background: "rgba(20,34,56,0.08)",
                padding: "10px 16px",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              LidLift
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "rgba(20,34,56,0.68)",
              }}
            >
              Allow / Review / Clarify / Block
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              maxWidth: "840px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 78,
                fontWeight: 700,
                lineHeight: 1.02,
                letterSpacing: "-0.05em",
              }}
            >
              Stop AI agents from choosing the wrong tool.
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                lineHeight: 1.35,
                color: "rgba(20,34,56,0.78)",
              }}
            >
              Pre-execution tool gating for MCP stacks with a live API and remote MCP endpoint.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 24,
              color: "rgba(20,34,56,0.72)",
            }}
          >
            <div style={{ display: "flex" }}>api.optimizationinversion.com</div>
            <div style={{ display: "flex" }}>Cloudflare + Vercel</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
