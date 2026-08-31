import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const alt = "SaCMS — Smart Content Management System"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#090d16",
          backgroundImage:
            "radial-gradient(circle at 25px 25px, #1e293b 2%, transparent 0%), radial-gradient(circle at 75px 75px, #1e293b 2%, transparent 0%)",
          backgroundSize: "100px 100px",
          color: "white",
          padding: "60px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Glow ambient */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "20%",
            width: "600px",
            height: "300px",
            background: "radial-gradient(circle, rgba(249, 115, 22, 0.25) 0%, rgba(59, 130, 246, 0.15) 50%, transparent 80%)",
            filter: "blur(60px)",
            borderRadius: "50%",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 20px",
            borderRadius: "9999px",
            background: "rgba(249, 115, 22, 0.12)",
            border: "1px solid rgba(249, 115, 22, 0.3)",
            color: "#f97316",
            fontSize: "16px",
            fontWeight: "bold",
            letterSpacing: "2px",
            textTransform: "uppercase",
            marginBottom: "28px",
          }}
        >
          <span>✨</span>
          <span>Smart Content Management System</span>
        </div>

        {/* Brand Logo & Name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "18px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "70px",
              height: "70px",
              borderRadius: "18px",
              backgroundColor: "#f97316",
              color: "white",
              fontSize: "36px",
              fontFamily: "monospace",
              fontWeight: "900",
              boxShadow: "0 10px 25px rgba(249, 115, 22, 0.4)",
            }}
          >
            &lt;/&gt;
          </div>
          <div style={{ display: "flex", fontSize: "72px", fontWeight: "900", letterSpacing: "-2px" }}>
            <span>Sa</span>
            <span style={{ color: "#f97316" }}>CMS</span>
          </div>
        </div>

        {/* Motto Headline */}
        <div
          style={{
            fontSize: "34px",
            fontWeight: "800",
            textAlign: "center",
            background: "linear-gradient(to right, #ffffff, #94a3b8)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "20px",
            letterSpacing: "-0.5px",
          }}
        >
          Build smarter. Manage easier. Scale faster.
        </div>

        {/* Feature Pills */}
        <div
          style={{
            display: "flex",
            gap: "14px",
            marginTop: "16px",
          }}
        >
          {[
            "PostgreSQL 17 Appliance",
            "Dynamic GraphQL & MCP",
            "1-Prompt AI Engine",
            "Vercel Custom DNS",
            "Midtrans Billing",
          ].map((pill, i) => (
            <div
              key={i}
              style={{
                padding: "8px 16px",
                borderRadius: "12px",
                backgroundColor: "rgba(30, 41, 59, 0.7)",
                border: "1px solid rgba(148, 163, 184, 0.15)",
                color: "#cbd5e1",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              {pill}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
