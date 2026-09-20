# Tasks: Quellenarbeitsbereich und Studio-Notizen

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [workspace-http.md](contracts/workspace-http.md), [quickstart.md](quickstart.md)

**Tests**: Tests are mandatory under the Constitution. Write each test task first and confirm its initial failure before the corresponding implementation task.

## Phase 1: Setup

**Purpose**: Establish fixed demo limits, dependencies and fixtures without changing existing behavior.

- [X] T001 Add the selected HTML extraction dependency and lockfile entry in `package.json` and `pnpm-lock.yaml`
- [X] T002 [P] Add search-result, web-response and orientation limits in `lib/limits.ts`
- [X] T003 [P] Add deterministic public HTML, redirect, private-address and web-search fixtures in `tests/fixtures/workspace-sources.ts`

---

## Phase 2: Foundational schema and authorization

**Purpose**: Add one additive migration and owner-scoped domain services that all stories need.

- [X] T004 Add `pdf`/`web` source shape, web uniqueness, `fetch` ingestion phase, orientation message shape and immutable `studio_notes` RLS schema in `supabase/migrations/202609200002_workspace_sources.sql`
- [X] T005 Add reset-safe migration and RLS boundary tests for source kinds, orientation messages and studio notes in `tests/integration/workspace-schema-access.test.ts`
- [X] T006 Add owner-scoped source detail, workspace snapshot and studio-note persistence/read services in `lib/notebooks/workspace-service.ts` and `lib/studio/service.ts`
- [X] T007 Add direct owner, foreign and anonymous service/action tests for detail reads, imports and note operations in `tests/integration/workspace-access.test.ts`
- [X] T008 Run `SUPABASE_TELEMETRY_ENABLED=false pnpm db:reset` and the two new integration files; record failures before story work in `specs/002-workspace-sources/verification.md`

**Checkpoint**: The data model resets cleanly and all new owned operations deny foreign and anonymous access.

---

## Phase 3: User Story 1 - Erstes Dokument verstehen (Priority: P1) 🎯 MVP

**Goal**: A first successful file becomes a listed, cited orientation with usable starter questions.

**Independent Test**: Upload one readable PDF into an empty notebook and obtain one persisted, cited orientation; add another source and verify no second orientation appears.

- [ ] T009 [P] [US1] Add red unit tests for an orientation with three to five questions and verified claims in `tests/unit/source-orientation.test.ts`
- [ ] T010 [P] [US1] Add red integration tests for one orientation per empty history, terminal failures and citation persistence in `tests/integration/source-orientation.test.ts`
- [ ] T011 [US1] Implement orientation prompt, generation, claim verification and persistence in `lib/rag/source-orientation.ts`
- [ ] T012 [US1] Trigger orientation only after the first owned source reaches `ready` in `lib/ingestion/run-job.ts`
- [ ] T013 [US1] Load orientation messages and starter questions in `app/notebooks/[notebookId]/page.tsx`
- [ ] T014 [US1] Render cited orientation cards and editable starter-question actions in `components/notebook/chat-thread.tsx` and `components/notebook/question-input.tsx`
- [ ] T015 [US1] Add the first-upload Chromium path and failure/no-duplicate assertions in `tests/e2e/workspace-orientation.spec.ts`

**Checkpoint**: US1 works without web search or Studio notes.

---

## Phase 4: User Story 2 - Quelle lesen und einordnen (Priority: P1)

**Goal**: The source list opens a readable, owner-scoped detail view without losing the chat context.

**Independent Test**: Select a ready PDF, inspect its metadata and all extracted text, return to chat, and verify a foreign source cannot be read.

- [ ] T016 [P] [US2] Add red unit tests for complete page/section text assembly and absent-text states in `tests/unit/source-detail.test.ts`
- [ ] T017 [P] [US2] Add red integration tests for owner-only detail data and removed-source behavior in `tests/integration/source-detail.test.ts`
- [ ] T018 [US2] Implement source-detail query, neutralen Überblick aus Metadaten/Textvorschau und vollständige extracted-text assembly in `lib/notebooks/workspace-service.ts`
- [ ] T019 [US2] Implement list selection, metadata, overview, text navigation and return affordance in `components/notebook/source-list.tsx` and `components/notebook/source-detail.tsx`
- [ ] T020 [US2] Compose the responsive sources/chat/studio workspace and selected-detail state in `components/notebook/workspace.tsx` and `app/notebooks/[notebookId]/page.tsx`
- [ ] T021 [US2] Add Chromium keyboard, detail-read, error-state and return-flow coverage in `tests/e2e/source-detail.spec.ts`

**Checkpoint**: US1 and US2 work with local PDFs; selected source text remains private.

---

## Phase 5: User Story 3 - Webquellen finden und gezielt aufnehmen (Priority: P2)

**Goal**: Users find public web pages, inspect result metadata, explicitly select them and use successfully processed selections as ordinary sources.

**Independent Test**: Search a term through the controlled adapter, preview one result, import one and verify it becomes ready; leave another unconfirmed and verify it is absent.

- [ ] T022 [P] [US3] Add red unit tests for result normalization, URL rejection, redirect validation and bounded HTML text extraction in `tests/unit/web-source.test.ts`
- [ ] T023 [P] [US3] Add red route/action contract tests for search limits, ownership, confirmation-only import, duplicate URLs and per-item failures in `tests/integration/web-source.test.ts`
- [ ] T024 [US3] Implement the server-only OpenAI web-search adapter and its Zod result contract in `lib/web/search.ts`
- [ ] T025 [US3] Implement validated public-page fetch, manual redirect handling and readable HTML extraction in `lib/web/fetch.ts`
- [ ] T026 [US3] Implement owner-scoped web-source preparation, canonical duplicate handling and per-item import outcomes in `lib/ingestion/web-import.ts` and `app/notebooks/actions.ts`
- [ ] T027 [US3] Extend the ingestion job for web fetch, chunking, embedding, overview and terminal states in `lib/ingestion/run-job.ts` and `lib/ingestion/persist.ts`
- [ ] T028 [US3] Implement authenticated search route, result preview and list/selection/import controls in `app/api/web/search/route.ts` and `components/notebook/source-search.tsx`
- [ ] T029 [US3] Render web source provenance and external-link citations without Storage access plus den gemeinsamen Fallback „Quelle entfernt“ ohne Link in `components/notebook/source-detail.tsx`, `components/notebook/citation-chip.tsx` and `components/notebook/source-viewer.tsx`
- [ ] T030 [US3] Add Chromium coverage for search, preview, individual/all selection, unconfirmed results, partial import and error states in `tests/e2e/web-source.spec.ts`

**Checkpoint**: Web sources are explicitly imported, bounded, owner-scoped and citation-compatible.

---

## Phase 6: User Story 4 - Antwort im Studio sichern (Priority: P2)

**Goal**: A verified answer can become one durable Studio note with the same citation guarantees.

**Independent Test**: Save one complete answer, reload and open its note; retry the save and verify there is exactly one unchanged note.

- [ ] T031 [P] [US4] Add red unit tests for title creation and idempotent note decisions in `tests/unit/studio-note.test.ts`
- [ ] T032 [P] [US4] Add red integration tests for complete-only saves, snapshots, RLS and removed-source citations in `tests/integration/studio-note.test.ts`
- [ ] T033 [US4] Implement atomic complete-answer note persistence and owner-scoped listing/detail reads in `lib/studio/service.ts` and `app/notebooks/actions.ts`
- [ ] T034 [US4] Render save controls only for complete answers and add note cards/detail view in `components/notebook/chat-thread.tsx` and `components/notebook/studio-notes.tsx`
- [ ] T035 [US4] Wire Studio previews and selected note state into `components/notebook/workspace.tsx` and `app/notebooks/[notebookId]/page.tsx`
- [ ] T036 [US4] Add Chromium save/open/reload/idempotency and inaccessible-note coverage in `tests/e2e/studio-notes.spec.ts`

**Checkpoint**: Studio notes are private, stable and citation-correct.

---

## Phase 7: Polish and cross-cutting verification

**Purpose**: Prove the complete demo path, accessibility, all matrix extensions and documented quality gates.

- [ ] T037 Add the required owner/fremd/anonym matrix cases for details, search, preview, import and notes to `tests/integration/workspace-access.test.ts`
- [ ] T038 [P] Add accessible labels, live states, focus return and responsive layout checks across `components/notebook/workspace.tsx`, `components/notebook/source-search.tsx` and `components/notebook/studio-notes.tsx`
- [ ] T039 [P] Update setup, limits, manual walkthrough and external-source caveats in `README.md` and `specs/002-workspace-sources/quickstart.md`
- [ ] T040 Execute database reset, typecheck, Biome, unit, integration, build and Chromium suites; document commands, outcomes, ten orientation runs, ten web-search smoke runs and the real PDF walkthrough in `specs/002-workspace-sources/verification.md`

## Dependencies & Execution Order

- Phase 1 → Phase 2 blocks every story.
- US1 and US2 are P1, but US2 follows US1 because both modify the initial source-to-workspace path.
- US3 needs the shared source model and source-detail UI; US4 needs complete-answer data but may follow US1 once the foundation is complete.
- Phase 7 follows all selected stories.

## Parallel Opportunities

- T002/T003, T009/T010, T016/T017, T022/T023 and T031/T032 modify independent test/support files and can run in parallel.
- T038/T039 can run in parallel after US3 and US4.

## Implementation Strategy

1. Establish schema and authorization proof first.
2. Deliver and validate the first-document orientation.
3. Deliver the selectable source-detail workspace.
4. Add controlled web search/import and then Studio notes.
5. Run the full matrix and real Chromium walkthrough only after all stories are integrated.
