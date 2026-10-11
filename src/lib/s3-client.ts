import { S3Client } from "@aws-sdk/client-s3"

/**
 * S3 client for any S3-compatible backend: MinIO on our own infrastructure, or Cloudflare R2.
 *
 * `forcePathStyle` is required for MinIO. Without it the SDK addresses buckets
 * virtual-hosted style — `https://<bucket>.media-acme.sacms.cloud/...` — a hostname
 * our DNS records and Caddyfile never serve, so every upload would fail.
 * R2 accepts path-style requests as well.
 *
 * Pass region "us-east-1" when creating MinIO buckets: with "auto" the SDK sends
 * CreateBucketConfiguration/LocationConstraint=auto, with us-east-1 it sends no body.
 */
export function createS3Client(
  endpoint: string,
  accessKeyId: string,
  secretAccessKey: string,
  region = "auto",
): S3Client {
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })
}
