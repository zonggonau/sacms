// registerWebhookTools — Workspace MCP tools (split out of route.ts; see context.ts).
import { z } from "zod"
import { db } from "@/lib/database"
import { safeFetch } from "@/lib/safe-url"
import { McpServer, authContext, UNAUTHORIZED, hasScope, permissionDenied, redactWebhook } from "./context"

export function registerWebhookTools(server: McpServer) {
    // ── list_webhooks ────────────────────────────────────────────────────────
    server.registerTool(
      "list_webhooks",
      {
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        title: "List Webhooks",
        description: "List all configured webhooks, their subscribed events, URLs, and status.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const webhooks = await db.webhook.findMany({
          where: { tenantId: auth.tenantId },
          orderBy: { createdAt: "desc" },
        })

        const result = webhooks.map(redactWebhook)

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── get_webhook ──────────────────────────────────────────────────────────
    server.registerTool(
      "get_webhook",
      {
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        title: "Get Webhook",
        description: "Fetch details, subscribed events, endpoint URL, and status of a specific webhook by ID.",
        inputSchema: {
          id: z.string().describe("ID of the webhook to retrieve"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const webhook = await db.webhook.findFirst({
          where: { id, tenantId: auth.tenantId },
        })
        if (!webhook) {
          return {
            content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }],
            structuredContent: { ok: false, code: "NOT_FOUND", message: "Webhook not found." },
            isError: true,
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(redactWebhook(webhook), null, 2)
          }]
        }
      }
    )

    // ── create_webhook ───────────────────────────────────────────────────────
    server.registerTool(
      "create_webhook",
      {
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        title: "Create Webhook",
        description: "Register a new webhook endpoint to receive notifications on CMS events (e.g. 'content.created', 'content.published', 'content.updated', 'content.deleted', 'media.uploaded').",
        inputSchema: {
          name: z.string().describe("Descriptive name (e.g. 'Build Trigger', 'Discord Notification')"),
          url: z.string().url().describe("Destination endpoint URL (must start with https:// or http://)"),
          events: z.array(z.string()).min(1).describe("Array of event names (e.g. ['content.created', 'content.published', 'content.deleted']) — at least one required, or the webhook will never fire"),
          secret: z.string().optional().describe("Optional HMAC signature secret"),
          enabled: z.boolean().default(true).describe("Whether the webhook is immediately active"),
          hookType: z.enum(["async", "sync"]).default("async").describe("Hook type ('async' background dispatch or 'sync' pre-save validation)"),
        },
      },
      async ({ name, url, events, secret, enabled, hookType }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        try {
          const { assertPublicUrl } = await import("@/lib/safe-url")
          await assertPublicUrl(url.trim())
        } catch (e: any) {
          return { content: [{ type: "text" as const, text: `❌ Webhook URL rejected: ${e?.message || "not allowed"}` }], isError: true }
        }

        // One tenant-level cap, same bucket the dashboard's own webhook
        // creation lacks today too — bounded here first since this is a
        // new, easily-scriptable trigger for an unbounded "webhook storm".
        const existingCount = await db.webhook.count({ where: { tenantId: auth.tenantId } })
        if (existingCount >= 20) {
          return { content: [{ type: "text" as const, text: `❌ Batas maksimum 20 webhook per workspace sudah tercapai. Hapus webhook yang tidak terpakai sebelum membuat yang baru.` }], isError: true }
        }

        const webhook = await db.webhook.create({
          data: {
            tenantId: auth.tenantId,
            name: name.trim(),
            url: url.trim(),
            events: events as any,
            secret: secret || null,
            enabled: enabled ?? true,
            hookType: hookType || "async",
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Webhook '${webhook.name}' (ID: '${webhook.id}') created successfully targeting ${webhook.url}.\n\n${JSON.stringify(redactWebhook(webhook), null, 2)}`
          }]
        }
      }
    )

    // ── update_webhook ───────────────────────────────────────────────────────
    server.registerTool(
      "update_webhook",
      {
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        title: "Update Webhook",
        description: "Update an existing webhook configuration (name, URL, subscribed events, active state).",
        inputSchema: {
          id: z.string().describe("ID of the webhook to update"),
          name: z.string().optional(),
          url: z.string().url().optional(),
          events: z.array(z.string()).min(1).optional(),
          enabled: z.boolean().optional(),
          secret: z.string().optional(),
        },
      },
      async ({ id, name, url, events, enabled, secret }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const existing = await db.webhook.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Webhook not found." }, isError: true }

        if (url) {
          try {
            const { assertPublicUrl } = await import("@/lib/safe-url")
            await assertPublicUrl(url.trim())
          } catch (e: any) {
            return { content: [{ type: "text" as const, text: `❌ Webhook URL rejected: ${e?.message || "not allowed"}` }], isError: true }
          }
        }

        const updated = await db.webhook.update({
          where: { id, tenantId: auth.tenantId },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(url ? { url: url.trim() } : {}),
            ...(events ? { events: events as any } : {}),
            ...(enabled !== undefined ? { enabled } : {}),
            ...(secret !== undefined ? { secret } : {}),
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Webhook '${updated.name}' updated successfully.\n\n${JSON.stringify(redactWebhook(updated), null, 2)}`
          }]
        }
      }
    )

    // ── delete_webhook ───────────────────────────────────────────────────────
    server.registerTool(
      "delete_webhook",
      {
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
        title: "Delete Webhook",
        description: "Permanently delete a webhook configuration and its log history.",
        inputSchema: {
          id: z.string().describe("ID of the webhook to delete"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const existing = await db.webhook.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Webhook not found." }, isError: true }

        await db.webhook.delete({ where: { id, tenantId: auth.tenantId } })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Webhook '${existing.name}' (${existing.url}) deleted successfully.`
          }]
        }
      }
    )

    // ── test_webhook ─────────────────────────────────────────────────────────
    server.registerTool(
      "test_webhook",
      {
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        title: "Test Webhook",
        description: "Dispatch a mock test event to a webhook endpoint to verify its connectivity and response status. Check `delivered` (true only for an HTTP 2xx response), not just that this tool call itself succeeded — a real, confirmed bug: an endpoint that rejected the test with HTTP 405 used to come back looking like a success (no isError, a ✅ message) with no structured field distinguishing \"the endpoint responded\" from \"the endpoint actually accepted it\".",
        inputSchema: {
          id: z.string().describe("ID of the webhook to test"),
        },
        outputSchema: {
          ok: z.boolean(),
          delivered: z.boolean(),
          httpStatus: z.number().optional(),
          httpStatusText: z.string().optional(),
          durationMs: z.number(),
          message: z.string(),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const webhook = await db.webhook.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!webhook) return { content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Webhook not found." }, isError: true }

        const testPayload = {
          event: "webhook.test",
          timestamp: new Date().toISOString(),
          workspace: {
            id: auth.tenantId,
            name: auth.tenantName,
            slug: auth.tenantSlug
          },
          message: "This is a test notification from SaCMS MCP Server."
        }

        const start = Date.now()
        try {
          const res = await safeFetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "SaCMS-MCP-Webhook/1.0",
              ...(webhook.secret ? { "X-SaCMS-Signature": "test-signature" } : {}),
            },
            body: JSON.stringify(testPayload),
          })
          const durationMs = Date.now() - start
          // `res.ok` (2xx) is DELIVERY success — a 405/5xx means the
          // endpoint responded but rejected the test, which must not be
          // reported the same way as actually accepting it.
          const delivered = res.ok
          const structured = {
            ok: true,
            delivered,
            httpStatus: res.status,
            httpStatusText: res.statusText,
            durationMs,
            message: delivered
              ? `Webhook test delivered successfully in ${durationMs}ms (HTTP ${res.status} ${res.statusText}).`
              : `Webhook endpoint responded but did NOT accept the test — HTTP ${res.status} ${res.statusText} after ${durationMs}ms. This is a failed delivery, not a success.`,
          }

          return {
            content: [{
              type: "text" as const,
              text: `${delivered ? "✅" : "⚠️"} ${structured.message}`
            }],
            structuredContent: structured,
            isError: !delivered,
          }
        } catch (error: any) {
          const durationMs = Date.now() - start
          return {
            content: [{
              type: "text" as const,
              text: `❌ Webhook test failed: ${error.message || "Endpoint unreachable"}`
            }],
            structuredContent: {
              ok: false,
              delivered: false,
              durationMs,
              message: error.message || "Endpoint unreachable",
            },
            isError: true,
          }
        }
      }
    )

    // =========================================================================
    // 7. API INFORMATION & CAPABILITY INSPECTOR
    // =========================================================================
}
