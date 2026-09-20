export type DiagnosticPhase =
  | "authorize"
  | "cleanup"
  | "fetch"
  | "extract"
  | "chunk"
  | "embed"
  | "finalize"
  | "request"

export interface DiagnosticEvent {
  correlationId: string
  phase: DiagnosticPhase
  cause: string
}

const SAFE_CODE = /^[A-Z0-9_:-]{1,80}$/

export function writeDiagnostic(event: DiagnosticEvent): void {
  if (!SAFE_CODE.test(event.cause)) {
    throw new Error("Diagnostic causes must be stable, content-free codes")
  }

  console.error(
    JSON.stringify({
      cause: event.cause,
      correlationId: event.correlationId,
      phase: event.phase,
    }),
  )
}
