import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // L1: Validate critical secrets at startup
    if (!process.env.NEXTAUTH_SECRET) {
      const msg = "[SECURITY] NEXTAUTH_SECRET is not set. Authentication will be insecure."
      if (process.env.NODE_ENV === "production") {
        throw new Error(msg + " Refusing to start in production without NEXTAUTH_SECRET.")
      }
      console.warn(`⚠️  ${msg}`)
    }
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
