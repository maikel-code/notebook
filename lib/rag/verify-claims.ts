import { generatedAnswerSchema } from "@/lib/rag/claim-schema"

export interface RetrievedCitationChunk {
  chunkId: string
  chunkNumber: number
  content: string
  pageEnd: number
  pageStart: number
  selected?: boolean
  sourceId: string
  sourceName: string
}

export interface VerifiedCitation {
  chunkId: string
  ordinal: number
  pageEnd: number
  pageStart: number
  quote: string
  sourceId: string
  sourceName: string
}

export type ClaimVerification =
  | { citations: VerifiedCitation[]; claims: string[]; kind: "valid" }
  | { kind: "invalid"; reason: "invalid_citations" }

const normalizeWhitespace = (value: string) => value.replaceAll(/\s+/g, " ").trim()

export function verifyClaims(value: unknown, chunks: RetrievedCitationChunk[]): ClaimVerification {
  const parsed = generatedAnswerSchema.safeParse(value)
  if (!parsed.success || parsed.data.kind !== "answer")
    return { kind: "invalid", reason: "invalid_citations" }
  const citations: VerifiedCitation[] = []
  for (const claim of parsed.data.claims) {
    for (const citation of claim.citations) {
      const chunk = chunks.find((candidate) => candidate.chunkNumber === citation.chunkNumber)
      if (
        !chunk ||
        chunk.selected === false ||
        !normalizeWhitespace(chunk.content).includes(normalizeWhitespace(citation.quote))
      ) {
        return { kind: "invalid", reason: "invalid_citations" }
      }
      citations.push({
        chunkId: chunk.chunkId,
        ordinal: citations.length,
        pageEnd: chunk.pageEnd,
        pageStart: chunk.pageStart,
        quote: citation.quote,
        sourceId: chunk.sourceId,
        sourceName: chunk.sourceName,
      })
    }
  }
  return { citations, claims: parsed.data.claims.map((claim) => claim.text), kind: "valid" }
}
