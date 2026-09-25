/**
 * SaCMS Agentic AI Builder — Structured Types
 *
 * Defines the multi-phase agent orchestration model:
 *   Phase 1: Planner (analyze prompt → produce ApplicationPlan)
 *   Phase 2: Schema Agent (provision Content Types / Single Types via MCP)
 *   Phase 3: Data Agent (seed realistic entries)
 *   Phase 4: Coding Agent (generate frontend files per framework)
 *   Phase 5: QA Agent (self-validate generated code)
 *
 * Each phase reports progress via the `reportAgentPhase` tool so the
 * UI can render a real-time phase timeline.
 */

// ────────────────────────────────────────────────────────────────────────────
// Agent Phase Definitions
// ────────────────────────────────────────────────────────────────────────────

export type AgentPhaseId =
  | "planning"
  | "schema_provisioning"
  | "data_seeding"
  | "coding"
  | "qa_validation"
  | "completed"
  | "error"

export type AgentPhaseStatus = "pending" | "running" | "completed" | "skipped" | "error"

export interface AgentPhase {
  id: AgentPhaseId
  label: string
  description: string
  icon: string // Lucide icon name
  status: AgentPhaseStatus
  startedAt?: string
  completedAt?: string
  details?: string
}

/** Default phase pipeline definition */
export const AGENT_PHASE_PIPELINE: Omit<AgentPhase, "status">[] = [
  {
    id: "planning",
    label: "Perencanaan Arsitektur",
    description: "Menganalisis prompt pengguna, mengidentifikasi entitas domain, dan merancang Application Plan.",
    icon: "Brain",
  },
  {
    id: "schema_provisioning",
    label: "Provisi Skema Database",
    description: "Membuat Content Types & Single Types baru di database SaCMS tenant via MCP Server.",
    icon: "Database",
  },
  {
    id: "data_seeding",
    label: "Injeksi Data Realistis",
    description: "Mengisi 3-5 entri data contoh berbahasa Indonesia ke setiap koleksi agar API langsung aktif.",
    icon: "Layers",
  },
  {
    id: "coding",
    label: "Kompilasi Frontend",
    description: "Menulis kode frontend terstruktur dengan typed API client, komponen UI, dan halaman responsif.",
    icon: "Code2",
  },
  {
    id: "qa_validation",
    label: "Validasi & Penyelesaian",
    description: "Memverifikasi kelengkapan berkas, import paths, dan fallback data agar sandbox preview berfungsi.",
    icon: "ShieldCheck",
  },
]

// ────────────────────────────────────────────────────────────────────────────
// Application Plan (Structured Output from Planner Phase)
// ────────────────────────────────────────────────────────────────────────────

export interface PlannedField {
  name: string
  slug: string
  type: "string" | "text" | "richtext" | "number" | "boolean" | "date" | "media" | "relation"
  required?: boolean
  unique?: boolean
  relationSlug?: string
  description?: string
}

export interface PlannedContentType {
  name: string
  slug: string
  description?: string
  fields: PlannedField[]
  seedCount?: number
}

export interface PlannedSingleType {
  name: string
  slug: string
  description?: string
  fields: PlannedField[]
}

export interface PlannedPage {
  path: string
  title: string
  description: string
  components: string[]
}

export interface ApplicationPlan {
  /** Human-readable project name */
  projectName: string
  /** Short summary of what's being built */
  summary: string
  /** Target domain/industry */
  domain: string
  /** Framework to use */
  framework: string
  /** Content Types to create */
  contentTypes: PlannedContentType[]
  /** Single Types to create */
  singleTypes: PlannedSingleType[]
  /** Pages to generate */
  pages: PlannedPage[]
  /** Design theme notes */
  designNotes: string
}

// ────────────────────────────────────────────────────────────────────────────
// Agent Phase Report (tool output for UI timeline)
// ────────────────────────────────────────────────────────────────────────────

export interface AgentPhaseReport {
  phaseId: AgentPhaseId
  status: AgentPhaseStatus
  message: string
  details?: string
  /** Number of items processed (e.g. "3 Content Types created") */
  itemsProcessed?: number
  /** Elapsed time in ms */
  elapsedMs?: number
}

// ────────────────────────────────────────────────────────────────────────────
// QA Validation Result
// ────────────────────────────────────────────────────────────────────────────

export interface QACheckResult {
  passed: boolean
  checks: Array<{
    name: string
    passed: boolean
    detail?: string
  }>
  suggestions?: string[]
}
