// Works out where a workspace is on the path from planning to a live site, and
// what to do next. Pure: the dashboard card and the get_next_step MCP tool both
// call this with the same facts, so the two never disagree.

export type NextStepStage = "plan_schema" | "add_content" | "deploy_site" | "live"

export interface WorkspaceFacts {
  contentTypeCount: number
  singleTypeCount: number
  componentCount: number
  entryCount: number
  /** True when a Vercel project or deployment URL is recorded for the workspace. */
  hasSite: boolean
}

export type NextStepAction =
  | { id: string; label: string; description: string; via: "dashboard"; href: string }
  | { id: string; label: string; description: string; via: "mcp"; tool: string }

export interface NextStep {
  stage: NextStepStage
  /** 1-based position on the planning → live path. */
  stageNumber: number
  stageCount: number
  title: string
  summary: string
  actions: NextStepAction[]
}

export const NEXT_STEP_STAGE_COUNT = 4

export function deriveNextStep(facts: WorkspaceFacts, tenantSlug: string): NextStep {
  const hasSchema = facts.contentTypeCount + facts.singleTypeCount + facts.componentCount > 0
  const dash = (path: string) => `/dashboard/${tenantSlug}/${path}`

  if (!hasSchema) {
    return {
      stage: "plan_schema",
      stageNumber: 1,
      stageCount: NEXT_STEP_STAGE_COUNT,
      title: "Rancang struktur konten",
      summary: "Workspace ini belum punya Content Type, Single Type, atau Component. Mulai dari template siap pakai, atau susun schema sendiri.",
      actions: [
        {
          id: "apply-template",
          label: "Pilih Website Template",
          description: "Terapkan schema dan frontend sekaligus. Site langsung di-deploy ke Vercel.",
          via: "dashboard",
          href: dash("developer/schema"),
        },
        {
          id: "build-with-ai",
          label: "Bangun dengan AI lewat MCP",
          description: "Panggil get_agent_playbook, lalu get_full_schema dan list_field_types sebelum membuat schema.",
          via: "mcp",
          tool: "get_agent_playbook",
        },
        {
          id: "manual-content-type",
          label: "Buat Content Type manual",
          description: "Susun Content Type dan field sendiri di halaman Content Types.",
          via: "dashboard",
          href: dash("content-types"),
        },
      ],
    }
  }

  if (facts.entryCount === 0 && !facts.hasSite) {
    return {
      stage: "add_content",
      stageNumber: 2,
      stageCount: NEXT_STEP_STAGE_COUNT,
      title: "Isi konten",
      summary: "Schema sudah ada, tetapi belum ada entri konten. Tambahkan konten sendiri atau pakai data contoh untuk mencoba frontend.",
      actions: [
        {
          id: "add-entries",
          label: "Tambah entri konten",
          description: "Buka halaman Konten dan tulis entri pertama.",
          via: "dashboard",
          href: dash("cms/content"),
        },
        {
          id: "sample-content",
          label: "Isi data contoh",
          description: "Rencanakan dengan plan_sample_content, lalu jalankan seed_sample_content. Data contoh bisa dihapus lagi per batch.",
          via: "mcp",
          tool: "seed_sample_content",
        },
      ],
    }
  }

  if (!facts.hasSite) {
    return {
      stage: "deploy_site",
      stageNumber: 3,
      stageCount: NEXT_STEP_STAGE_COUNT,
      title: "Bangun dan deploy frontend",
      summary: "Schema dan konten sudah ada, tetapi site belum pernah di-deploy. Bangun frontend yang membaca konten ini, lalu deploy.",
      actions: [
        {
          id: "build-frontend",
          label: "Bangun frontend lewat MCP",
          description: "Panggil start_website_build untuk memulai build yang bisa dilanjutkan, lalu deploy_to_sacms.",
          via: "mcp",
          tool: "start_website_build",
        },
        {
          id: "apply-template",
          label: "Atau terapkan Website Template",
          description: "Pakai frontend siap pakai yang sudah cocok dengan schema ini.",
          via: "dashboard",
          href: dash("developer/schema"),
        },
      ],
    }
  }

  return {
    stage: "live",
    stageNumber: 4,
    stageCount: NEXT_STEP_STAGE_COUNT,
    title: "Site sudah live",
    summary: "Site sudah di-deploy. Ubah tampilan lewat AI, atur domain, dan pastikan perubahan konten memicu revalidasi.",
    actions: [
      {
        id: "revise-site",
        label: "Ubah site lewat MCP",
        description: "Kirim perubahan dengan deploy_website_patch. Tidak perlu membangun ulang dari nol.",
        via: "mcp",
        tool: "deploy_website_patch",
      },
      {
        id: "custom-domain",
        label: "Atur domain kustom",
        description: "Hubungkan domain sendiri ke site ini.",
        via: "dashboard",
        href: dash("domains"),
      },
      {
        id: "revalidation-webhook",
        label: "Atur webhook revalidasi",
        description: "Kirim webhook saat konten berubah supaya halaman frontend ikut diperbarui.",
        via: "dashboard",
        href: dash("webhooks"),
      },
      {
        id: "deploy-history",
        label: "Lihat riwayat deploy",
        description: "Periksa deploy terakhir dan kembali ke versi sebelumnya bila perlu.",
        via: "dashboard",
        href: dash("deployments"),
      },
    ],
  }
}
