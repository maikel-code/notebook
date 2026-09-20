import { describe, expect, it } from "vitest"

import {
  parseRetrievalCalibration,
  validateRetrievalCalibrationFingerprints,
} from "@/lib/rag/retrieval-config"

const validCalibration = {
  algorithmVersion: "1",
  chunkConfigFingerprint: "chunk-fingerprint",
  datasetFingerprint: "dataset-fingerprint",
  distanceMetric: "cosine",
  embeddingModel: "text-embedding-3-small",
  minimumSimilarity: 0.72,
  topK: 8,
}

describe("retrieval calibration", () => {
  it("accepts the complete versioned artifact", () => {
    expect(parseRetrievalCalibration(validCalibration)).toEqual(validCalibration)
  })

  it.each([
    ["embedding model", { ...validCalibration, embeddingModel: "other-model" }],
    ["distance metric", { ...validCalibration, distanceMetric: "euclidean" }],
    ["dataset", { ...validCalibration, datasetFingerprint: "changed-dataset" }],
    ["chunk configuration", { ...validCalibration, chunkConfigFingerprint: "changed-chunks" }],
  ])("rejects a changed %s fingerprint", (_label, actual) => {
    expect(() => validateRetrievalCalibrationFingerprints(validCalibration, actual)).toThrow()
  })

  it.each([
    { ...validCalibration, topK: 7 },
    { ...validCalibration, minimumSimilarity: 1.01 },
    { ...validCalibration, unknown: true },
  ])("rejects an invalid artifact shape", (artifact) => {
    expect(() => parseRetrievalCalibration(artifact)).toThrow()
  })
})
