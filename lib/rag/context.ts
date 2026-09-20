import type { RetrievalCandidate } from "@/lib/rag/retrieve"
import { packRetrievalContext } from "@/lib/rag/retrieve"

export function buildUntrustedContext(candidates: RetrievalCandidate[]): string {
  return packRetrievalContext(candidates)
}
