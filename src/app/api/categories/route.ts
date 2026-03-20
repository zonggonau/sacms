import { NextResponse } from "next/server"

// GET /api/categories - Return categories for select field
export async function GET() {
  try {
    // Return categories array for select field
    // This can be dynamic in the future (from database, config, etc.)
    const categories = [
      "Kegiatan",
      "Kesehatan",
      "Politik",
      "Berita",
      "Pengumuman",
      "Artikel",
      "Press Release",
    ]

    return NextResponse.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}