const notebookPathPattern =
  /^\/notebooks(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i

export function safeNotebookReturnPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !notebookPathPattern.test(value)) {
    return "/notebooks"
  }

  return value
}
