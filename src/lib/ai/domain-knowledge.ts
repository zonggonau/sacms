import { DOMAIN_KNOWLEDGE_LIBRARY, DomainBlueprint } from "./domain-knowledge-types"

export { DOMAIN_KNOWLEDGE_LIBRARY }
export type { DomainBlueprint }

/**
 * Mengembalikan daftar blueprint domain instan yang siap digunakan
 */
export async function getDomainBlueprints(): Promise<DomainBlueprint[]> {
  return DOMAIN_KNOWLEDGE_LIBRARY
}
