import { readFile } from "node:fs/promises"

export interface RetrievalObservation {
  id: string
  relevant: boolean
  score: number
}

export interface ThresholdScore {
  balancedAccuracy: number
  falseNegatives: number
  falsePositives: number
  threshold: number
  trueNegatives: number
  truePositives: number
}

function assertObservation(observation: RetrievalObservation): void {
  if (!Number.isFinite(observation.score) || observation.score < 0 || observation.score > 1) {
    throw new Error(`Ungültiger Retrieval-Score für ${observation.id}.`)
  }
}

export function evaluateThreshold(
  observations: RetrievalObservation[],
  threshold: number,
): ThresholdScore {
  if (observations.length === 0) throw new Error("Für die Kalibrierung fehlen Retrieval-Scores.")
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error("Der Kandidatenschwellenwert muss zwischen 0 und 1 liegen.")
  }

  let truePositives = 0
  let falseNegatives = 0
  let trueNegatives = 0
  let falsePositives = 0
  for (const observation of observations) {
    assertObservation(observation)
    const accepted = observation.score >= threshold
    if (observation.relevant && accepted) truePositives += 1
    if (observation.relevant && !accepted) falseNegatives += 1
    if (!observation.relevant && !accepted) trueNegatives += 1
    if (!observation.relevant && accepted) falsePositives += 1
  }

  const positives = truePositives + falseNegatives
  const negatives = trueNegatives + falsePositives
  if (positives === 0 || negatives === 0) {
    throw new Error("Die Kalibrierung braucht relevante und nicht relevante Referenzfragen.")
  }
  return {
    balancedAccuracy: (truePositives / positives + trueNegatives / negatives) / 2,
    falseNegatives,
    falsePositives,
    threshold,
    trueNegatives,
    truePositives,
  }
}

export function selectFailClosedThreshold(observations: RetrievalObservation[]): ThresholdScore {
  const candidates = [...new Set(observations.map((observation) => observation.score))]
  if (candidates.length === 0) throw new Error("Für die Kalibrierung fehlen Retrieval-Scores.")
  return candidates
    .sort((left, right) => right - left)
    .map((threshold) => evaluateThreshold(observations, threshold))
    .sort(
      (left, right) =>
        right.balancedAccuracy - left.balancedAccuracy || right.threshold - left.threshold,
    )[0]
}

async function main(): Promise<void> {
  const inputPath = process.argv[2]
  if (!inputPath) {
    throw new Error(
      "Usage: pnpm calibrate:retrieval -- <retrieval-scores.json>. T081 erzeugt die Scores und den freizugebenden Vorschlag.",
    )
  }
  const observations = JSON.parse(await readFile(inputPath, "utf8")) as RetrievalObservation[]
  const result = selectFailClosedThreshold(observations)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1]?.endsWith("calibrate-retrieval.ts")) await main()
