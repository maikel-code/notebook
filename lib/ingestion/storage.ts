export const SOURCES_BUCKET = "sources"

export function sourceStoragePath(userId: string, notebookId: string, sourceId: string): string {
  return `${userId}/${notebookId}/${sourceId}.pdf`
}
