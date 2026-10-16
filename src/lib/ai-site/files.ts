import type { PrismaClient } from "../../../prisma/generated-client"
import { STARTER_FILES } from "./template"

export type ProjectFileContent = { path: string; content: string }

/** The project's files, seeded with the starter app on first use. */
export async function listProjectFiles(tenantDb: PrismaClient, projectId: string): Promise<ProjectFileContent[]> {
  const files = await selectFiles(tenantDb, projectId)
  if (files.length > 0) return files

  await tenantDb.aiSiteFile.createMany({
    data: Object.entries(STARTER_FILES).map(([path, content]) => ({ projectId, path, content })),
    skipDuplicates: true,
  })

  return selectFiles(tenantDb, projectId)
}

export async function readProjectFile(tenantDb: PrismaClient, projectId: string, path: string) {
  const file = await tenantDb.aiSiteFile.findUnique({
    where: { projectId_path: { projectId, path } },
    select: { content: true },
  })

  return file?.content
}

export async function writeProjectFiles(tenantDb: PrismaClient, projectId: string, files: ProjectFileContent[]) {
  if (files.length === 0) return
  // Sequential, not a batched $transaction([...]) — dedicated-tenant clients
  // are wrapped in a connection-fallback Proxy (database.ts) whose .catch()
  // wrapping strips the PrismaPromise branding $transaction's array form
  // requires, so a batch call throws "All elements of the array need to be
  // Prisma Client promises."
  for (const file of files) {
    await tenantDb.aiSiteFile.upsert({
      where: { projectId_path: { projectId, path: file.path } },
      create: { projectId, path: file.path, content: file.content },
      update: { content: file.content },
    })
  }
}

export async function deleteProjectFiles(tenantDb: PrismaClient, projectId: string, paths: string[]) {
  if (paths.length === 0) return
  await tenantDb.aiSiteFile.deleteMany({
    where: { projectId, path: { in: paths } },
  })
}

function selectFiles(tenantDb: PrismaClient, projectId: string) {
  return tenantDb.aiSiteFile.findMany({
    where: { projectId },
    select: { path: true, content: true },
    orderBy: { path: "asc" },
  })
}
