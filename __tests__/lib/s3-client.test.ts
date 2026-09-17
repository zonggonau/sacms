import { describe, it, expect } from "vitest"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { createS3Client } from "@/lib/s3-client"

/**
 * Resolve the URL an upload would be sent to, without touching the network: a
 * finalizeRequest middleware throws with the final request before it is signed/sent.
 */
async function uploadUrl(endpoint: string): Promise<string> {
  const s3 = createS3Client(endpoint, "access", "secret")
  s3.middlewareStack.add(
    () => async (args: any) => {
      const r = args.request
      throw new Error(`${r.protocol}//${r.hostname}${r.path}`)
    },
    { step: "finalizeRequest", priority: "low" },
  )
  try {
    await s3.send(new PutObjectCommand({ Bucket: "sacms-media", Key: "upload/acme/logo.png", Body: "x" }))
  } catch (error) {
    return (error as Error).message
  }
  throw new Error("request was not intercepted")
}

describe("createS3Client", () => {
  // Regression: without forcePathStyle the SDK sent MinIO uploads to
  // https://sacms-media.media-acme.sacms.cloud/..., a host that does not exist.
  it("addresses a MinIO bucket in the path, on the endpoint's own host", async () => {
    expect(await uploadUrl("https://media-acme.sacms.cloud")).toBe(
      "https://media-acme.sacms.cloud/sacms-media/upload/acme/logo.png",
    )
  })

  it("uses the same path-style addressing for Cloudflare R2", async () => {
    expect(await uploadUrl("https://abc123.r2.cloudflarestorage.com")).toBe(
      "https://abc123.r2.cloudflarestorage.com/sacms-media/upload/acme/logo.png",
    )
  })
})
