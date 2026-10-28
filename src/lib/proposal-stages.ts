/**
 * Fixed pipeline stages for the "Penawaran" (sales proposal) module —
 * see prisma/schema.prisma's Proposal.stage. "won"/"lost" are terminal:
 * entering either sets Proposal.closedAt (see the PATCH handler in
 * src/app/api/admin/proposals/[id]/route.ts).
 */
export const PROPOSAL_STAGES = [
  { key: "draft", label: "Draft", color: "slate" },
  { key: "sent", label: "Terkirim", color: "blue" },
  { key: "negotiation", label: "Negosiasi", color: "amber" },
  { key: "won", label: "Kontrak Ditandatangani", color: "emerald" },
  { key: "lost", label: "Gagal", color: "red" },
] as const

export type ProposalStage = (typeof PROPOSAL_STAGES)[number]["key"]

export const TERMINAL_STAGES: ProposalStage[] = ["won", "lost"]

export function isValidStage(value: string): value is ProposalStage {
  return PROPOSAL_STAGES.some((s) => s.key === value)
}

export function getStageLabel(stage: string): string {
  return PROPOSAL_STAGES.find((s) => s.key === stage)?.label ?? stage
}
