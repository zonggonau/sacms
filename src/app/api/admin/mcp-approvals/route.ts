import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"
import { APPROVAL_ACTION_LABELS, type ApprovalAction } from "@/lib/infrastructure/mcp-approvals"

// Requests the sacms-developer MCP server queued for a human decision
// (publish, platform-default schema, cascade delete). The agent can only ask;
// a super admin decides here.
export const GET = withAdminAuth(async (req) => {
  const status = req.nextUrl.searchParams.get("status") === "pending" ? "pending" : undefined

  const [requests, pendingCount] = await Promise.all([
    db.mcpApprovalRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.mcpApprovalRequest.count({ where: { status: "pending" } }),
  ])

  return NextResponse.json({
    pendingCount,
    requests: requests.map((request) => ({
      id: request.id,
      action: request.action,
      actionLabel: APPROVAL_ACTION_LABELS[request.action as ApprovalAction] ?? request.action,
      targetId: request.targetId,
      targetName: request.targetName,
      details: request.details,
      status: request.status,
      requestedByName: request.requestedByName,
      resultMessage: request.resultMessage,
      createdAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() ?? null,
    })),
  })
})
