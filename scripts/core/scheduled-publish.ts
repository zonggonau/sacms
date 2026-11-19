import { db } from "@/lib/database"
import { publishScheduledContent } from "@/lib/content/scheduled-publishing"

export async function processScheduledContent(options: { dryRun?: boolean } = {}) {
  const result = await publishScheduledContent(options)
  const totalPublished = options.dryRun ? result.scanned : result.published
  console.log({ ...result, dryRun: options.dryRun ?? false })
  return { totalPublished, totalErrors: result.failed }
}

if (import.meta.main) {
  try {
    const result = await processScheduledContent({ dryRun: process.argv.includes("--dry-run") })
    if (result.totalErrors) process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}
