# Quickstart: Quellenarbeitsbereich und Studio-Notizen

## Prerequisites

- Node.js 22 and pnpm 11.
- Local Supabase running with the existing environment values from `.env.example`.
- Server-side OpenAI and Anthropic keys. Web search consumes the existing server-side OpenAI access; no browser key is configured.

## Setup and required verification

```text
pnpm install
SUPABASE_TELEMETRY_ENABLED=false pnpm db:reset
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright test --project=chromium --workers=1
```

## Manual Chromium walkthrough

1. Register a fresh user, create a notebook and upload `~/Downloads/Mitgliedantrag.pdf`.
2. Wait for `bereit`; confirm that the source is listed and exactly one cited orientation with three to five questions is shown.
3. Select the source, read its overview and text, then return to the chat.
4. Search a harmless public term, open a result preview, confirm one result and wait for its separate status. Confirm that a result not imported is not listed.
5. Ask a source-grounded question, save the complete answer, open the Studio note and reload the notebook.
6. Repeat direct read and write attempts with a second user and without a session. No source text, result, preview, import control or note content may be exposed.

## Expected outcomes

- Failed PDF or web processing is never shown as ready or summarized as successful.
- Web imports show one outcome per selected URL, respect the source limit and never download a non-public target.
- A second save of the same answer leaves one unchanged Studio note.
- Removing a cited source leaves saved quote plus “Quelle entfernt” but no document or website link.
