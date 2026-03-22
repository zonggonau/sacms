export interface SEOAnalysis {
  score: number
  results: {
    label: string
    status: "good" | "warning" | "error"
    message: string
  }[]
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ')
}

export function analyzeSEO(data: any, fields: any[]): SEOAnalysis {
  const results: SEOAnalysis["results"] = []
  let score = 100

  // 1. Identify key fields
  const title = String(data.judul_berita || data.judul || data.title || "")
  const content = stripHtml(String(data.konten || data.content || data.body || ""))
  const summary = stripHtml(String(data.ringkasan || data.summary || data.description || ""))
  const hasImage = !!(data.gambar_utama || data.cover || data.image || data.thumbnail)

  // 2. Title Analysis (Ideal: 40-60 characters)
  if (title.length === 0) {
    results.push({ label: "Title", status: "error", message: "Title is missing." })
    score -= 30
  } else if (title.length < 30) {
    results.push({ label: "Title Length", status: "warning", message: "Title is too short (min 30 chars)." })
    score -= 10
  } else if (title.length > 60) {
    results.push({ label: "Title Length", status: "warning", message: "Title is too long (max 60 chars)." })
    score -= 5
  } else {
    results.push({ label: "Title Length", status: "good", message: "Title length is optimal." })
  }

  // 3. Content Length Analysis (Ideal: > 300 words)
  const wordCount = content.trim().split(/\s+/).length
  if (content.length === 0) {
    results.push({ label: "Content", status: "error", message: "Main content is empty." })
    score -= 30
  } else if (wordCount < 200) {
    results.push({ label: "Content Depth", status: "warning", message: `Too thin (${wordCount} words). Aim for 300+.` })
    score -= 15
  } else {
    results.push({ label: "Content Depth", status: "good", message: `Good depth (${wordCount} words).` })
  }

  // 4. Summary / Meta Description Analysis (Ideal: 120-160 chars)
  if (summary.length === 0) {
    results.push({ label: "Summary", status: "warning", message: "Add a summary for meta description." })
    score -= 10
  } else if (summary.length < 100) {
    results.push({ label: "Summary Length", status: "warning", message: "Summary is a bit short." })
    score -= 5
  } else {
    results.push({ label: "Summary", status: "good", message: "Summary is well-optimized." })
  }

  // 5. Visual Content
  if (!hasImage) {
    results.push({ label: "Visuals", status: "warning", message: "Content without images performs poorly." })
    score -= 10
  } else {
    results.push({ label: "Visuals", status: "good", message: "Has featured image." })
  }

  return {
    score: Math.max(0, score),
    results
  }
}
