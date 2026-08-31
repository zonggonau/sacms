import { ImageResponse } from "next/og"
import { getLandingData } from "@/lib/public-api"
import { type BlogPost } from "@/components/blog/blog-explorer"

export const runtime = "nodejs"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  let title = "SaCMS Blog"
  let category = "Insights"
  let author = "Tim SaCMS"
  let date = "2026"

  try {
    const data = await getLandingData()
    const blogs: BlogPost[] = data.blogs || []
    const post = blogs.find(
      (b) => (b.slug || b.id || b.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) === slug
    )
    if (post) {
      title = post.title
      category = post.category || "Headless CMS"
      author = post.author || "Tim SaCMS"
      date = post.date || "2026"
    }
  } catch (e) {
    console.error("Error generating OG image for blog post:", e)
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0b0f19",
          backgroundImage:
            "radial-gradient(circle at 25px 25px, #1e293b 2%, transparent 0%), radial-gradient(circle at 75px 75px, #1e293b 2%, transparent 0%)",
          backgroundSize: "80px 80px",
          color: "white",
          padding: "70px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Glow ambient */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            right: "10%",
            width: "500px",
            height: "350px",
            background: "radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, rgba(99, 102, 241, 0.15) 50%, transparent 80%)",
            filter: "blur(70px)",
            borderRadius: "50%",
          }}
        />

        {/* Top bar: Brand & Category Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "#f97316",
                color: "white",
                fontSize: "24px",
                fontFamily: "monospace",
                fontWeight: "900",
              }}
            >
              &lt;/&gt;
            </div>
            <span style={{ fontSize: "32px", fontWeight: "900", letterSpacing: "-1px" }}>
              Sa<span style={{ color: "#f97316" }}>CMS</span>
            </span>
          </div>

          <div
            style={{
              padding: "6px 16px",
              borderRadius: "9999px",
              background: "rgba(249, 115, 22, 0.15)",
              border: "1px solid rgba(249, 115, 22, 0.35)",
              color: "#fb923c",
              fontSize: "14px",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {category}
          </div>
        </div>

        {/* Article Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            maxWidth: "960px",
          }}
        >
          <div
            style={{
              fontSize: title.length > 60 ? "46px" : "56px",
              fontWeight: "900",
              lineHeight: 1.15,
              letterSpacing: "-1.5px",
              color: "#ffffff",
            }}
          >
            {title}
          </div>
        </div>

        {/* Footer Meta */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            paddingTop: "24px",
            width: "100%",
            color: "#94a3b8",
            fontSize: "16px",
            fontWeight: "600",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <span>✍️ {author}</span>
            <span>📅 {date}</span>
          </div>
          <span style={{ color: "#f97316" }}>sacms.cloud/blog</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
