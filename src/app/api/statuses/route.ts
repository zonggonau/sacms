import { NextResponse } from "next/server"

// GET /api/statuses - Return statuses for select field
export async function GET() {
  try {
    // Return statuses array for select field
    const statuses = [
      "Draft",
      "Published",
      "Archived",
    ]

    return NextResponse.json(statuses)
  } catch (error) {
    console.error("Error fetching statuses:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}