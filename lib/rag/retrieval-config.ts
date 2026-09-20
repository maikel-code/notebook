import { z } from "zod"

import calibrationArtifact from "@/eval/dataset/retrieval-calibration.json"

const retrievalCalibrationSchema = z
  .object({
    algorithmVersion: z.literal("1"),
    chunkConfigFingerprint: z.string().min(1),
    datasetFingerprint: z.string().min(1),
    distanceMetric: z.literal("cosine"),
    embeddingModel: z.literal("text-embedding-3-small"),
    minimumSimilarity: z.number().min(0).max(1),
    topK: z.literal(8),
  })
  .strict()

export type RetrievalCalibration = z.infer<typeof retrievalCalibrationSchema>

export function parseRetrievalCalibration(value: unknown): RetrievalCalibration {
  return retrievalCalibrationSchema.parse(value)
}

export function validateRetrievalCalibrationFingerprints(
  expected: unknown,
  actual: unknown,
): RetrievalCalibration {
  const baseline = parseRetrievalCalibration(expected)
  const parsed = parseRetrievalCalibration(actual)
  if (
    baseline.embeddingModel !== parsed.embeddingModel ||
    baseline.distanceMetric !== parsed.distanceMetric ||
    baseline.datasetFingerprint !== parsed.datasetFingerprint ||
    baseline.chunkConfigFingerprint !== parsed.chunkConfigFingerprint
  ) {
    throw new Error("Die Abrufkalibrierung passt nicht zu Datensatz oder Chunk-Konfiguration.")
  }
  return parsed
}

let cachedCalibration: RetrievalCalibration | undefined

export async function loadRetrievalCalibration(): Promise<RetrievalCalibration> {
  if (cachedCalibration) return cachedCalibration
  const parsed = parseRetrievalCalibration(calibrationArtifact)
  cachedCalibration = parsed
  return parsed
}
