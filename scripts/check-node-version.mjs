import { readFileSync } from "node:fs"

const requiredMajor = Number.parseInt(
  readFileSync(new URL("../.nvmrc", import.meta.url), "utf8").trim(),
  10,
)
const actualMajor = Number.parseInt(process.versions.node, 10)

if (!Number.isInteger(requiredMajor) || actualMajor !== requiredMajor) {
  console.error(`Node.js ${requiredMajor}.x is required; received ${process.versions.node}.`)
  process.exit(1)
}
