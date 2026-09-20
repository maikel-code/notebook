import { timingSafeEqual } from "node:crypto"

export function hasValidJobSecret(received: string | null | undefined, expected: string): boolean {
  if (!received) return false
  const left = Buffer.from(received)
  const right = Buffer.from(expected)
  return left.byteLength === right.byteLength && timingSafeEqual(left, right)
}
