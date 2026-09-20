"use client"

import { useEffect } from "react"

const OPEN_SOURCE_STATES = new Set(["uploading", "processing"])

export function useJobStatus(
  notebookId: string,
  sourceStatuses: string[],
  onUpdate: () => void,
): void {
  const hasOpenJob = sourceStatuses.some((status) => OPEN_SOURCE_STATES.has(status))

  useEffect(() => {
    if (!hasOpenJob) return
    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/status?notebookId=${encodeURIComponent(notebookId)}`)
      if (response.ok) onUpdate()
    }, 2_000)
    return () => window.clearInterval(interval)
  }, [hasOpenJob, notebookId, onUpdate])
}
