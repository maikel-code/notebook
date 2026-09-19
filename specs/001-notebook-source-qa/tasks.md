---

description: "Task list for 001-notebook-source-qa"
---

# Tasks: Quellengebundenes Notebook-Frage-Antwort-System

**Input**: Design documents from `specs/001-notebook-source-qa/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Testaufgaben sind Pflicht. Spezifikation und Constitution verlangen anforderungsbezogene Nachweise, die feste Zugriffsmatrix sowie die Trennung deterministischer Tests von probabilistischer Bewertung.

**Organization**: Setup und Fundament sind gemeinsam; danach folgt je eine unabhängig prüfbare Phase pro User Story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel ausführbar, weil andere Dateien betroffen sind und keine offene Aufgabe vorausgesetzt wird
- **[Story]**: User Story US1–US6; Setup, Fundament und Abschluss tragen kein Story-Label
- Jeder Task nennt einen konkreten Dateipfad

## Path Conventions

Ein Next.js-Projekt im Wurzelverzeichnis: `app/`, `components/`, `lib/`, `supabase/`, `tests/`, `eval/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Projektgerüst, Abhängigkeiten und verbindliche Prüfkommandos

- [ ] T001 Next.js-App-Router-Projekt mit TypeScript im Wurzelverzeichnis und den Strukturen `app/`, `components/`, `lib/`, `supabase/`, `tests/` und `eval/` gemäß `specs/001-notebook-source-qa/plan.md` anlegen
- [ ] T002 Node 22 LTS in `.nvmrc` und im Feld `engines` von `package.json` festschreiben
- [ ] T003 [P] TypeScript im strengen Modus in `tsconfig.json` konfigurieren
- [ ] T004 [P] Linting und Formatierung in `eslint.config.mjs` konfigurieren
- [ ] T005 [P] Tailwind CSS v4 und die globalen Grundstile in `app/globals.css` einrichten
- [ ] T006 Komponenten von neobrutalism.com über die shadcn-kompatible CLI nach `components/ui/` übernehmen, vorher Lizenz und Herkunft prüfen und das Ergebnis unter D-13 in `specs/001-notebook-source-qa/research.md` dokumentieren
- [ ] T007 Laufzeitabhängigkeiten Next.js, React, Supabase JS, Vercel AI SDK, pdf.js und Zod sowie Entwicklungsabhängigkeiten Vitest und Playwright in `package.json` festlegen
- [ ] T008 Skripte `typecheck`, `lint`, `test`, `test:integration`, `test:e2e`, `db:reset`, `eval`, `calibrate:retrieval`, `perf` und `worker:sweep` mit der Torzuordnung aus `specs/001-notebook-source-qa/plan.md` in `package.json` anlegen
- [ ] T009 [P] `.env.example` mit Supabase-URL, Anon-Key, Dienstrollen-Key, getrennten Modellanbieter-Schlüsseln und `JOB_TRIGGER_SECRET` anlegen; nur URL und Anon-Key dürfen `NEXT_PUBLIC_` tragen
- [ ] T010 [P] Umgebungsvariablen mit Zod in `lib/env.ts` prüfen und serverseitige Werte so exportieren, dass sie nicht in Client-Bundles importiert werden können
- [ ] T011 [P] Vitest mit Unit-Testpfad `tests/unit/` in `vitest.config.ts` konfigurieren
- [ ] T012 [P] Playwright mit E2E-Testpfad `tests/e2e/` und lokalem Webserver in `playwright.config.ts` konfigurieren

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistenz, Zugriffsgrenzen, zentrale Limits und Testumgebung

**⚠️ CRITICAL**: Keine User Story beginnt vor Abschluss dieser Phase.

- [ ] T013 Cloud- und lokale Supabase-Instanz getrennt einrichten und sichere Befehle in `README.md` dokumentieren; `supabase db reset` darf nie gegen das verknüpfte Cloud-Projekt laufen
- [ ] T014 Migration `notebooks` in `supabase/migrations/202609190001_notebooks.sql` anlegen: `user_id` FK auf `auth.users` mit Kaskade, `name` „1–200 Zeichen, nicht leer nach Trimmen“, `created_at` und `updated_at`
- [ ] T015 Migration `sources` in `supabase/migrations/202609190002_sources.sql` anlegen: Pfad `{user_id}/{notebook_id}/{source_id}.pdf`, Inhalts-Hash, `byte_size ≤ 10 MB`, `page_count ≤ 50`, Status `uploading · processing · ready · failed · unusable`, nullable `error_reason`, persistentes `is_selected`, `replaces_source_id` nullable mit `ON DELETE SET NULL` nur für Ersatz-Entwürfe, `cleanup_storage_path` nullable und nicht browserlesbar sowie bewusst nicht eindeutiger Index `(notebook_id, content_hash)`
- [ ] T016 Migration `ingestion_jobs` in `supabase/migrations/202609190003_ingestion_jobs.sql` anlegen: Status `queued · running · succeeded · failed`, nullable Phase `cleanup · extract · chunk · embed · finalize`, `attempt` Start 0 und Höchstwert 3, nullable `last_error`, `correlation_id`, nullable `locked_at`, `started_at`, `finished_at` und Laufzeitgrenze 5 Minuten
- [ ] T017 `pgvector` und Migration `chunks` in `supabase/migrations/202609190004_chunks.sql` anlegen: `source_id` kaskadiert, `ordinal`, `page_start`, `page_end`, `content`, `char_count`, Embedding-Dimension für `text-embedding-3-small`, Ähnlichkeitsindex und Eindeutigkeit `(source_id, ordinal)`
- [ ] T018 Migration `messages` in `supabase/migrations/202609190005_messages.sql` anlegen: Rolle `user · assistant`, User-`content ≤ 2.000 Zeichen`, Status `streaming · complete · aborted · failed`, nullable `unsupported_reason` aus `no_selection · no_ready_source · below_similarity_threshold · invalid_citations`, `selected_sources_snapshot` nur bei User-Nachrichten, `question_message_id` bei Assistant-Nachrichten mit `ON DELETE CASCADE`, `attempt_no ≥ 1`, Eindeutigkeit `(question_message_id, attempt_no)` und partieller eindeutiger Index für höchstens eine streamende Assistant-Nachricht je Notebook
- [ ] T019 Migration `citations` in `supabase/migrations/202609190006_citations.sql` anlegen: `message_id` kaskadiert, nullable `chunk_id` und `source_id` jeweils `ON DELETE SET NULL`, persistente Kopien `source_name`, geprüfter `quote`, `page_start`, `page_end` und `ordinal`
- [ ] T020 RLS für alle sechs Tabellen mit `user_id = auth.uid()` für Lesen, Einfügen, Ändern und Löschen in `supabase/migrations/202609190007_rls.sql` aktivieren
- [ ] T021 Privaten Storage-Bucket und Pfadregel auf den ersten Abschnitt `{user_id}/…` ohne öffentliche URLs in `supabase/migrations/202609190008_storage.sql` anlegen
- [ ] T022 Alle Limits zentral in `lib/limits.ts` definieren: `MAX_FILE_BYTES = 10 MB`, `MAX_PAGES = 50`, `MAX_SOURCES_PER_NOTEBOOK = 30`, `MAX_SELECTED_SOURCES = 10`, `MAX_QUESTION_CHARS = 2.000`, `MAX_CONTEXT_CHARS = 60.000`, `MAX_JOB_ATTEMPTS = 3`, `JOB_TIMEOUT_MS = 5 Minuten`
- [ ] T023 Supabase-Verbindungen in `lib/supabase/server.ts`, `lib/supabase/browser.ts` und `lib/supabase/service.ts` anlegen; die Dienstrolle darf ausschließlich in `lib/supabase/service.ts` erzeugt werden
- [ ] T024 [P] Zentrale Sitzungs- und Eigentümerprüfungen mit identischer `404`-Antwort für fremde und fehlende Objekte in `lib/auth/authorize.ts` implementieren
- [ ] T025 [P] Fehlerdiagnose mit Korrelationsmerkmal, Phase und Ursache ohne Dokumentinhalt, personenbezogene Daten oder Geheimnisse in `lib/diagnostics.ts` implementieren
- [ ] T026 [P] Gemeinsame HTTP-Fehler `401`, `404`, `409`, `422`, `502` ohne Existenzauskunft oder Inhaltsfragment in `lib/http/errors.ts` definieren
- [ ] T027 Integrations-Testgerüst mit zwei echten Benutzerkonten, anonymem Zugriff, lokalem Schema-Reset und gültigem, fehlendem sowie ungültigem `JOB_TRIGGER_SECRET` in `tests/integration/setup.ts` anlegen

**Checkpoint**: Schema, RLS, Storage, Limits und Testumgebung stehen.

---

## Phase 3: User Story 1 — Privater Arbeitsbereich (Priority: P1) 🎯 MVP

**Goal**: Registrieren, anmelden, abmelden und eigene Notebooks verwalten, ohne fremde Inhalte offenzulegen.

**Independent Test**: Zwei Konten und je ein Notebook anlegen; Konto B und ein anonymer Client erhalten über die bekannte Notebook-ID von A keine Inhalte oder Existenzauskunft.

### Tests for User Story 1

- [ ] T028 [P] [US1] Notebook-Seite der Zugriffsmatrix für Eigentümer, fremdes Konto und anonymen Zugriff in `tests/integration/access-notebook-page.test.ts` zuerst fehlschlagend abbilden
- [ ] T029 [P] [US1] `renameNotebook` der Zugriffsmatrix für Eigentümer, fremdes Konto und anonymen Zugriff in `tests/integration/access-rename-notebook.test.ts` zuerst fehlschlagend abbilden
- [ ] T030 [P] [US1] Gleiche Antwort für fremde und nicht vorhandene Notebook-ID ohne Inhaltsfragment in `tests/integration/no-existence-disclosure.test.ts` zuerst fehlschlagend abbilden
- [ ] T031 [P] [US1] Registrierung, Anmeldung, Leerzustand, Anlegen, Umbenennen, bestätigtes Löschen und Abmelden in `tests/e2e/auth-and-notebooks.spec.ts` zuerst fehlschlagend abbilden

### Implementation for User Story 1

- [ ] T032 [P] [US1] Registrierungsseite mit E-Mail und Passwort ohne E-Mail-Bestätigung in `app/(auth)/sign-up/page.tsx` implementieren
- [ ] T033 [P] [US1] Anmeldeseite mit feldbezogenen Fehlermeldungen in `app/(auth)/sign-in/page.tsx` implementieren
- [ ] T034 [US1] Registrierung, Anmeldung und Abmeldung als Server Actions in `app/(auth)/actions.ts` implementieren
- [ ] T035 [US1] Geschützte Routen ohne Sitzung zur Anmeldung umleiten, ohne Inhalte zu rendern, in `middleware.ts` implementieren
- [ ] T036 [US1] `createNotebook`, `renameNotebook` und `deleteNotebook` mit zentraler Eigentümerprüfung in `app/notebooks/actions.ts` implementieren; Name „1–200 Zeichen, nicht leer nach Trimmen“, Löschung nur nach Bestätigung und während `streaming` mit `409`
- [ ] T037 [US1] Notebook-Übersicht mit erklärendem Leerzustand und Anlegeaktion in `app/notebooks/page.tsx` implementieren
- [ ] T038 [P] [US1] Bedienbaren Bestätigungsdialog für Löschungen in `components/notebook/confirm-delete-dialog.tsx` implementieren
- [ ] T039 [US1] Notebook-Detailseite mit serverseitigem Eigentümer-Lookup und `404` für fremd oder nicht vorhanden in `app/notebooks/[notebookId]/page.tsx` implementieren
- [ ] T040 [US1] US1-Tests aus `tests/integration/access-notebook-page.test.ts`, `tests/integration/access-rename-notebook.test.ts`, `tests/integration/no-existence-disclosure.test.ts` und `tests/e2e/auth-and-notebooks.spec.ts` ausführen und das Story-Checkpoint-Ergebnis in `specs/001-notebook-source-qa/verification.md` festhalten

**Checkpoint**: US1 ist unabhängig vorführbar und bildet den MVP.

---

## Phase 4: User Story 2 — Quellen aufnehmen und Zustand verstehen (Priority: P1)

**Goal**: PDFs sicher aufnehmen, verarbeiten, ersetzen und wiederholen; alle Zustände bleiben verständlich.

**Independent Test**: Gültiges PDF, beschädigtes PDF und Bilddatei hochladen; zusätzlich einen erfolgreichen und einen abgebrochenen Dubletten-Ersatz prüfen.

### Tests for User Story 2

- [ ] T041 [P] [US2] Ablehnung für beschädigtes, leeres, passwortgeschütztes oder Nicht-PDF, über 10 MB, über 50 Seiten und 31. zusätzliche Quelle in `tests/integration/ingestion-rejects.test.ts` zuerst fehlschlagend abbilden
- [ ] T042 [P] [US2] Scan ohne extrahierbaren Text endet `unusable` und nie `ready` in `tests/integration/ingestion-scan.test.ts` zuerst fehlschlagend abbilden
- [ ] T043 [P] [US2] Wiederholte Verarbeitung ersetzt Chunks atomar und erzeugt weder doppelte Chunks noch Quellen in `tests/integration/ingestion-idempotent.test.ts` zuerst fehlschlagend abbilden
- [ ] T044 [P] [US2] Drei automatische Versuche, sichtbarer Endzustand `failed` und manueller Neustart bei Versuch 0 in `tests/integration/ingestion-retries.test.ts` zuerst fehlschlagend abbilden
- [ ] T045 [P] [US2] `/api/jobs/run` und `/api/jobs/sweep` mit gültigem, fehlendem und ungültigem Geheimnis sowie Cross-User-Dienstrollenlauf in `tests/integration/ingestion-job-access.test.ts` zuerst fehlschlagend abbilden
- [ ] T046 [P] [US2] `GET /api/jobs/status` für Eigentümer, fremdes Konto und anonymen Zugriff in `tests/integration/access-job-status.test.ts` zuerst fehlschlagend abbilden
- [ ] T047 [P] [US2] Storage-Download für Eigentümer, fremdes Konto und anonymen Zugriff über denselben bekannten Pfad in `tests/integration/access-storage.test.ts` zuerst fehlschlagend abbilden
- [ ] T048 [P] [US2] Dublettenoptionen `replace · add · cancel`, fremde `replaceSourceId`, Ersatz bei 30 Quellen und unveränderte Altquelle bei Upload-Abbruch in `tests/integration/upload-replacement.test.ts` zuerst fehlschlagend abbilden
- [ ] T049 [P] [US2] `confirmUpload` prüft Existenz, Größe und Hash, wechselt Quelle und Auftrag atomar und erzeugt bei Wiederholung keinen zweiten Auftrag in `tests/integration/upload-confirmation.test.ts` zuerst fehlschlagend abbilden
- [ ] T050 [P] [US2] Upload, Statuswechsel ohne Reload, verständliche Fehlerursache und Retry in `tests/e2e/source-ingestion.spec.ts` zuerst fehlschlagend abbilden

### Implementation for User Story 2

- [ ] T051 [P] [US2] SHA-256-Prüfsumme des Dateiinhalts statt des Dateinamens in `lib/upload/hash.ts` implementieren
- [ ] T052 [P] [US2] PDF serverseitig nach Dateisignatur, Passwortschutz, Beschädigung, 10-MB-Grenze und 50-Seiten-Grenze in `lib/ingestion/validate-pdf.ts` prüfen
- [ ] T053 [P] [US2] Seitenweisen Text mit pdf.js und Seitenzahl in `lib/ingestion/extract.ts` extrahieren
- [ ] T054 [P] [US2] Chunks mit `ordinal`, `page_start`, `page_end`, `content` und `char_count` in `lib/ingestion/chunk.ts` erzeugen; Seitenwerte unterscheiden sich nur beim Seitenumbruch
- [ ] T055 [P] [US2] Einbettungen über OpenAI `text-embedding-3-small` in `lib/ingestion/embed.ts` erzeugen
- [ ] T056 [US2] `prepareUpload` mit `ok · duplicate · rejected`, Limit 30, `intent: add | replace`, Eigentümer-/Hash-Prüfung und Ersatz-Entwurf mit `replaces_source_id` in `app/notebooks/[notebookId]/actions.ts` implementieren
- [ ] T057 [US2] `cancelUpload` nur für eigene `uploading`-Entwürfe ohne Auftrag und ohne Änderung der Altquelle in `app/notebooks/[notebookId]/actions.ts` implementieren
- [ ] T058 [US2] `confirmUpload` idempotent mit serverseitiger Existenz-, Größen- und Hash-Prüfung sowie gesperrter Transaktion für Quellenwechsel und genau einen Auftrag in `app/notebooks/[notebookId]/actions.ts` implementieren
- [ ] T059 [US2] Alten Storage-Pfad aus `cleanup_storage_path` idempotent löschen und „nicht vorhanden“ als Erfolg behandeln in `lib/ingestion/cleanup.ts`
- [ ] T060 [US2] Chunks einer Quelle in derselben Transaktion löschen und neu schreiben in `lib/ingestion/persist.ts`
- [ ] T061 [US2] Auftrag mit `FOR UPDATE SKIP LOCKED` im Eigentümerkontext beanspruchen und Phasen `cleanup → extract → chunk → embed → finalize` in `lib/ingestion/run-job.ts` implementieren
- [ ] T062 [US2] Internen, nur mit `JOB_TRIGGER_SECRET` erreichbaren Aufruf in `app/api/jobs/run/route.ts` implementieren
- [ ] T063 [US2] Hängende Jobs über 5 Minuten sowie vorgemerkte Wiederholungen im Eigentümerkontext in `app/api/jobs/sweep/route.ts` einsammeln
- [ ] T064 [US2] Lokalen einmaligen und wiederkehrenden Sweep-Aufruf in `scripts/sweep.ts` implementieren
- [ ] T065 [US2] Eigentümergebundene Statusausgabe ohne `cleanup_storage_path` oder Dokumentinhalt in `app/api/jobs/status/route.ts` implementieren
- [ ] T066 [US2] `retryIngestion` nur für eigene Quelle im Zustand `failed` mit neuem Auftrag und Versuch 0 in `app/notebooks/[notebookId]/actions.ts` implementieren
- [ ] T067 [US2] Quellenliste mit `wird verarbeitet · bereit · fehlgeschlagen · nicht nutzbar`, wobei `uploading` und `processing` beide „wird verarbeitet“ heißen, in `components/notebook/source-list.tsx` implementieren
- [ ] T068 [P] [US2] Polling nur solange ein Auftrag offen ist in `components/notebook/use-job-status.ts` implementieren
- [ ] T069 [US2] Uploadfeld und Dublettenentscheidung mit Lade-, Abbruch-, Erfolgs- und Fehlerzuständen in `components/notebook/source-upload.tsx` implementieren; Upload-Abbruch ruft `cancelUpload` auf und lässt die Altquelle unverändert

**Checkpoint**: US2 nimmt Dokumente verlässlich auf und zeigt alle Fehler- und Ersatzpfade.

---

## Phase 5: User Story 3 — Belegte Antwort erhalten und im Original prüfen (Priority: P1)

**Goal**: Fragen schrittweise mit vollständig geprüften Claim-Absätzen beantworten und jeden Verweis bis zur Originalstelle verfolgen.

**Independent Test**: Eine bekannte Frage beantworten, jeden terminalen Verweis öffnen sowie Anbieterausfall, Retry und einen ungültigen Claim prüfen.

### Tests for User Story 3

- [ ] T070 [P] [US3] Abruf mit ausschließlich eigenen ausgewählten `ready`-Quellen, Top-8, 60.000-Zeichen-Packing sowie Scores unterhalb, genau auf und oberhalb des versionierten Mindestwerts in `tests/unit/retrieval.test.ts` zuerst fehlschlagend abbilden
- [ ] T071 [P] [US3] Kalibrierartefakt-Schema und Fingerprints für Modell, Distanzmaß, Datensatz und Chunk-Konfiguration in `tests/unit/retrieval-config.test.ts` zuerst fehlschlagend abbilden
- [ ] T072 [P] [US3] Claim-Schema, unbekannte Chunknummer, nicht ausgewählte Quelle, abweichender Wortlaut, fehlender Beleg sowie vollständige Verwerfung bei einem ungültigen von mehreren Claims in `tests/unit/verify-claims.test.ts` zuerst fehlschlagend abbilden
- [ ] T073 [P] [US3] Atomaren Abschluss aus Nachricht, allen Citations und `complete` sowie `invalid_citations` ohne Citations in `tests/integration/answer-persistence.test.ts` zuerst fehlschlagend abbilden
- [ ] T074 [P] [US3] `POST /api/chat` für Eigentümer, fremdes Konto und anonymen Zugriff sowie Vorbedingungen keine Auswahl, keine bereite Quelle, unter Mindestwert und Frage über 2.000 Zeichen in `tests/integration/access-chat.test.ts` zuerst fehlschlagend abbilden
- [ ] T075 [P] [US3] Anbieterfehler `failed`, Client-Abbruch `aborted`, zweite parallele Frage `409` sowie Notebook- und Quellenlöschung während `streaming` `409` in `tests/integration/chat-terminal-states.test.ts` zuerst fehlschlagend abbilden
- [ ] T076 [P] [US3] Retry nur für eigene fehlgeschlagene Assistant-Nachricht, fremde ID `404`, anderer Zustand `422`, monotone `attempt_no` und unveränderter Altversuch in `tests/integration/chat-retry.test.ts` zuerst fehlschlagend abbilden
- [ ] T077 [P] [US3] Kernablauf Upload, Frage, provisorische Claim-Absätze, fertige terminale Verweise und PDF-Sprung/Fallback in `tests/e2e/core-flow.spec.ts` zuerst fehlschlagend abbilden
- [ ] T078 [P] [US3] Fehlgeschlagenen Versuch sichtbar lassen, neuen Versuch anhängen und beide nach Reload in Reihenfolge zeigen in `tests/e2e/chat-retry.spec.ts` zuerst fehlschlagend abbilden

### Implementation for User Story 3

- [ ] T079 [P] [US3] Vier freigegebene Demo-PDFs und zwölf Fragen mit sechs beantwortbaren, drei unbeantwortbaren, zwei widersprüchlichen und einer Injection-Frage samt erwarteten Stellen in `eval/dataset/questions.json` und `eval/dataset/documents/` anlegen
- [ ] T080 [US3] Kandidatenschwellen aus dem Referenzdatensatz bewerten, Balanced Accuracy maximieren und bei Gleichstand fail-closed den höheren Wert wählen in `eval/calibrate-retrieval.ts`
- [ ] T081 [US3] Kalibriervorschlag mit Modell-, Distanz-, Datensatz- und Chunk-Fingerprint erzeugen, Maintainer-Freigabe einholen und erst danach den freigegebenen Wert mit `topK = 8` in `eval/dataset/retrieval-calibration.json` versionieren
- [ ] T082 [US3] Kalibrierartefakt mit Zod laden, Fingerprint-Abweichungen ablehnen und nie zur Laufzeit umschreiben in `lib/rag/retrieval-config.ts`
- [ ] T083 [US3] Top-8-Cosine-Suche mit Mindestwert ausschließlich über eigene ausgewählte `ready`-Quellen in `lib/rag/retrieve.ts` implementieren
- [ ] T084 [US3] Treffer in Rangfolge als nummerierte Blöcke mit Quellennamen, Seitenbereich und höchstens 60.000 Zeichen in `lib/rag/context.ts` packen
- [ ] T085 [US3] Systemanweisung für untrusted Dokumentblöcke und das Ergebnis `{ kind: "answer", claims[] } | { kind: "unsupported" }` in `lib/rag/prompt.ts` implementieren
- [ ] T086 [US3] Strukturierte Claim-Einheiten über Anthropic und das Vercel AI SDK vollständig je Einheit puffern in `lib/rag/generate-answer.ts`
- [ ] T087 [US3] Claim-Schema mit einzeiligem, nichtleerem `text`, mindestens einer Citation und ausschließlich bekannten Feldern in `lib/rag/claim-schema.ts` definieren
- [ ] T088 [US3] Auswahl, Chunkherkunft und whitespace-normalisierten Wortlaut jedes Belegs prüfen und bei einem Fehler den gesamten Entwurf verwerfen in `lib/rag/verify-claims.ts`
- [ ] T089 [US3] Erfolgreiche Antwort, vollständige Citations und Zustand `complete` atomar speichern; bei `invalid_citations` nur festen Einschränkungstext ohne Citations speichern in `lib/rag/persist-answer.ts`
- [ ] T090 [US3] Neue Frage mit User-Nachricht, Auswahl-Snapshot und Assistant-Versuch `attempt_no = 1` über `POST /api/chat` in `app/api/chat/route.ts` implementieren
- [ ] T091 [US3] `retryOfMessageId` in `app/api/chat/route.ts` implementieren: fehlgeschlagenen eigenen Versuch und zugehörige Frage sperren, nächste `attempt_no` anhängen, gespeicherten Fragetext und Snapshot verwenden und frühere Versuche nicht verändern
- [ ] T092 [US3] Verbindungsabbruch an den Modellaufruf weitergeben, Zustand `aborted` setzen und die Notebook-Sperre zuverlässig lösen in `app/api/chat/route.ts`
- [ ] T093 [US3] Keine-Auswahl-, Keine-Ready-, Unter-Grenzwert- und Modell-`unsupported`-Fälle ohne Citations als feste Texte in `lib/rag/unsupported.ts` abbilden
- [ ] T094 [P] [US3] Chatverlauf mit provisorischem Zustand „wird geprüft“, Claim-Einheit je Absatz und nicht interaktiven Verweisen bis zum Gesamtabschluss in `components/notebook/chat-thread.tsx` implementieren
- [ ] T095 [P] [US3] Frageeingabe während `streaming` sperren und Abbrechen anbieten in `components/notebook/question-input.tsx`
- [ ] T096 [P] [US3] „Erneut versuchen“ ausschließlich an fehlgeschlagenen Assistant-Versuchen anzeigen und `retryOfMessageId` senden in `components/notebook/retry-answer-button.tsx`
- [ ] T097 [P] [US3] Feste Einschränkungstexte ohne Verweise in `components/notebook/unsupported-answer.tsx` darstellen
- [ ] T098 [P] [US3] Terminale Verweise mit Wortlaut, Quellenname und Seite in `components/notebook/citation-chip.tsx` rendern
- [ ] T099 [US3] PDF mit pdf.js auf der belegten Seite öffnen, Wortlaut hervorheben und bei fehlender Textebenenstelle den geprüften Wortlaut daneben anzeigen in `components/notebook/source-viewer.tsx`
- [ ] T100 [US3] Quellenliste, Chatverlauf, Fragefeld und Belegansicht in `app/notebooks/[notebookId]/page.tsx` zum vollständigen Kernablauf integrieren

**Checkpoint**: US3 liefert den vollständigen vorführbaren Kernablauf.

---

## Phase 6: User Story 4 — Quellenauswahl steuern und Quellen entfernen (Priority: P2)

**Goal**: Persistente Auswahl für neue Antworten steuern und Quellen entfernen, ohne historische Belege zu verlieren.

**Independent Test**: Eine nur aus Quelle A beantwortbare Frage mit A und B stellen, Auswahl nach Reload prüfen und anschließend A löschen.

### Tests for User Story 4

- [ ] T101 [P] [US4] Abruf und Citations stammen ausschließlich aus höchstens zehn ausgewählten Quellen in `tests/integration/selection-scope.test.ts` zuerst fehlschlagend abbilden
- [ ] T102 [P] [US4] Auswahlzustand bleibt nach Reload erhalten und keine Auswahl erzeugt `no_selection` in `tests/integration/selection-persistence.test.ts` zuerst fehlschlagend abbilden
- [ ] T103 [P] [US4] Quellenlöschung entfernt Datei und Chunks, setzt historische `chunk_id` und `source_id` auf `NULL`, erhält Wortlaut, Quellenname und Seite und bietet keinen Sprung an in `tests/integration/source-removal.test.ts` zuerst fehlschlagend abbilden
- [ ] T104 [P] [US4] Auswahl, Reload, Löschen mit Bestätigung und Darstellung „Quelle entfernt“ in `tests/e2e/source-selection.spec.ts` zuerst fehlschlagend abbilden

### Implementation for User Story 4

- [ ] T105 [US4] `setSourceSelected` mit persistenter Speicherung und höchstens zehn ausgewählten Quellen in `app/notebooks/[notebookId]/actions.ts` implementieren
- [ ] T106 [US4] `deleteSource` mit Bestätigung, `409` während `streaming`, Storage-Löschung, Chunk-Löschung und erhaltenen Citations in `app/notebooks/[notebookId]/actions.ts` implementieren
- [ ] T107 [P] [US4] Auswahlbedienung, Höchstgrenzenhinweis und Zustand „keine Quelle ausgewählt“ in `components/notebook/source-list.tsx` implementieren
- [ ] T108 [P] [US4] Historischen Beleg mit gespeichertem Wortlaut, Quellenname, Seite und Hinweis „Quelle entfernt“ ohne Link in `components/notebook/citation-chip.tsx` implementieren
- [ ] T109 [US4] US4-Tests aus `tests/integration/selection-scope.test.ts`, `tests/integration/selection-persistence.test.ts`, `tests/integration/source-removal.test.ts` und `tests/e2e/source-selection.spec.ts` ausführen und das Ergebnis in `specs/001-notebook-source-qa/verification.md` ergänzen

**Checkpoint**: US4 ist unabhängig auf Auswahl und Löschung prüfbar.

---

## Phase 7: User Story 5 — Widersprüche und Anweisungsversuche (Priority: P2)

**Goal**: Widersprüche der abgerufenen Passagen sichtbar machen und Dokumentanweisungen wirkungslos halten.

**Independent Test**: Widersprüchliches Quellenpaar und präpariertes Injection-Dokument aus dem Referenzdatensatz verwenden.

### Tests for User Story 5

- [ ] T110 [P] [US5] Widerspruch wird innerhalb der abgerufenen Passagen benannt und mit beiden terminalen Verweisen belegt in `tests/integration/contradiction.test.ts` zuerst fehlschlagend abbilden
- [ ] T111 [P] [US5] Dokumentanweisung zum Offenlegen fremder Notebooks oder Ignorieren der Belegregeln verändert Antwort und Zugriffsgrenze nicht in `tests/integration/prompt-injection.test.ts` zuerst fehlschlagend abbilden
- [ ] T112 [P] [US5] Widerspruch und Injection-Dokument im vollständigen UI-Ablauf in `tests/e2e/trust-cases.spec.ts` zuerst fehlschlagend abbilden

### Implementation for User Story 5

- [ ] T113 [US5] Promptregel für Widersprüche ausschließlich innerhalb der herangezogenen Passagen und Belegpflicht beider Seiten in `lib/rag/prompt.ts` ergänzen
- [ ] T114 [US5] Dokumenttext und Metadaten als abgegrenzte untrusted Datenblöcke ohne Einfluss auf System- oder Zugriffsregeln in `lib/rag/context.ts` implementieren
- [ ] T115 [P] [US5] Widerspruch als Claim mit mehreren terminalen Verweisen in `components/notebook/chat-thread.tsx` verständlich darstellen
- [ ] T116 [US5] US5-Tests aus `tests/integration/contradiction.test.ts`, `tests/integration/prompt-injection.test.ts` und `tests/e2e/trust-cases.spec.ts` ausführen und das Ergebnis in `specs/001-notebook-source-qa/verification.md` ergänzen

**Checkpoint**: US5 schützt Vertrauenswürdigkeit gegen Widerspruch und Dokumentanweisung.

---

## Phase 8: User Story 6 — Gesprächsverlauf bleibt erhalten (Priority: P3)

**Goal**: Fragen, alle Antwortversuche und Verweise bleiben nach Abmeldung und erneutem Öffnen in Reihenfolge erhalten.

**Independent Test**: Frage mit fehlgeschlagenem und erfolgreichem Retry erzeugen, abmelden, erneut anmelden und denselben Verlauf öffnen.

### Tests for User Story 6

- [ ] T117 [P] [US6] User-Frage einmal, Assistant-Versuche nach `attempt_no`, Citations und historische Quellenbelege in stabiler Reihenfolge sowie fremder Zugriff `404` in `tests/integration/conversation-history.test.ts` zuerst fehlschlagend abbilden
- [ ] T118 [P] [US6] Abmelden, erneut anmelden und vollständigen Verlauf einschließlich fehlgeschlagenem Altversuch und Retry wiederfinden in `tests/e2e/history.spec.ts` zuerst fehlschlagend abbilden

### Implementation for User Story 6

- [ ] T119 [US6] User-Nachrichten mit ihren Assistant-Versuchen nach `created_at` und `attempt_no` eigentümergebunden in `lib/chat/load-history.ts` laden
- [ ] T120 [US6] Verlauf samt Citations serverseitig in `app/notebooks/[notebookId]/page.tsx` laden
- [ ] T121 [US6] Eine Frage mit mehreren sichtbaren Antwortversuchen ohne duplizierte User-Frage in `components/notebook/chat-thread.tsx` darstellen
- [ ] T122 [US6] US6-Tests aus `tests/integration/conversation-history.test.ts` und `tests/e2e/history.spec.ts` ausführen und das Ergebnis in `specs/001-notebook-source-qa/verification.md` ergänzen

**Checkpoint**: US6 erhält den vollständigen Verlauf über Sitzungen hinweg.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Barrierefreiheit, Diagnose, reproduzierbarer Betrieb und getrennte Qualitätsberichte

- [ ] T123 [P] Belegtreue und Anteil ehrlicher Einschränkungen am versionierten Referenzdatensatz als probabilistischen, nicht blockierenden Bericht in `eval/run.ts` implementieren
- [ ] T124 [P] Kernablauf ausschließlich mit Tastatur, sichtbarem Fokus und ohne Fokusfalle in `tests/e2e/keyboard.spec.ts` prüfen
- [ ] T125 [P] Kontrast, Fokusring, Beschriftungen und Fehlerzuordnung der übernommenen Komponenten in `components/ui/` korrigieren
- [ ] T126 [P] Diagnoseausgaben auf Korrelationsmerkmal, Phase und Ursache sowie Abwesenheit von Dokumenttext, personenbezogenen Daten und Geheimnissen in `tests/integration/diagnostics.test.ts` prüfen
- [ ] T127 [P] Ausschluss von Dienstrollen-, Modell- und Job-Geheimnissen aus Client-Bundles in `tests/unit/no-server-secrets.test.ts` prüfen
- [ ] T128 [P] Fünf Demo-Läufe bis zum ersten sichtbaren Claim messen, Einzelwerte und Vier-von-fünf-Ziel ≤ 5 Sekunden als Nicht-Gate in `eval/performance.ts` berichten
- [ ] T129 Voraussetzungen, Cloud-/Lokal-Setup, Start, Sweep, Migrationen, Kalibrierfreigabe und alle Prüfkommandos in `README.md` vervollständigen
- [ ] T130 Frisches lokales Setup einschließlich `pnpm db:reset` und aller 15 Nachweisläufe aus `specs/001-notebook-source-qa/quickstart.md` durchführen und Ergebnisse in `specs/001-notebook-source-qa/verification.md` dokumentieren
- [ ] T131 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e` und `pnpm db:reset` vollständig ausführen; `pnpm eval`, `pnpm calibrate:retrieval` und `pnpm perf` getrennt als Nicht-Gates in `specs/001-notebook-source-qa/verification.md` ausweisen
- [ ] T132 Stand, Task-IDs, Branch, Commit, Änderungen, Prüfungen und offene Einschränkungen für eine frische unabhängige Review-Sitzung in `specs/001-notebook-source-qa/handoff.md` dokumentieren; nicht selbst mergen

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 Setup
   └─► Phase 2 Foundational  ⚠ blockiert alle Stories
          └─► Phase 3 US1 (P1) 🎯 MVP
                 └─► Phase 4 US2 (P1)
                        └─► Phase 5 US3 (P1) — vorführbarer Kern
                               ├─► Phase 6 US4 (P2) ─┐
                               ├─► Phase 7 US5 (P2) ─┼─► Phase 9 Polish
                               └─► Phase 8 US6 (P3) ─┘
```

- US1 braucht nur das Fundament.
- US2 braucht Notebook und Sitzung aus US1.
- US3 braucht verarbeitete Quellen aus US2.
- US4, US5 und US6 brauchen den Chatkern aus US3, hängen aber nicht voneinander ab.
- Phase 9 beginnt nach den für die Abnahme vorgesehenen Story-Phasen.

### Within Each User Story

- Tests werden zuerst geschrieben und müssen vor der Implementierung fehlschlagen.
- Datenmodell und Datenzugriff kommen vor Services, Actions und Route Handlers.
- Endpunkte kommen vor UI-Integration.
- Der Story-Checkpoint muss bestehen, bevor die nächste abhängige Phase beginnt.
- T081 ist ein ausdrücklicher Maintainer-Checkpoint: Ein Kalibriervorschlag wird nicht automatisch zur Laufzeitkonfiguration.

## Parallel Opportunities

| Phase | Parallel ausführbar |
|---|---|
| Setup | T003–T005, T009–T012 |
| Foundational | T024–T026; Migrationen T014–T019 können in getrennten Dateien vorbereitet werden, T020 folgt danach |
| US1 | Tests T028–T031; UI T032, T033 und T038 |
| US2 | Tests T041–T050; Logik T051–T055; UI T067 und T068 |
| US3 | Tests T070–T078; nach T093 die UI T094–T098 |
| US4 | Tests T101–T104; UI T107 und T108 |
| US5 | Tests T110–T112; Darstellung T115 parallel zu Prompt/Context |
| US6 | Tests T117 und T118 |
| Polish | T123–T128; T129–T132 folgen als Dokumentations- und Gesamtnachweis |

## Parallel Examples

### User Story 1

`T028`, `T029`, `T030` und `T031` können als getrennte Testdateien parallel entstehen; danach können `T032`, `T033` und `T038` parallel umgesetzt werden.

### User Story 2

`T041`–`T050` können parallel als fehlschlagende Nachweise geschrieben werden. Anschließend sind `T051`–`T055` unabhängig; der Transaktionspfad `T056`–`T066` bleibt seriell.

### User Story 3

`T070`–`T078` können parallel vorbereitet werden. Danach laufen Kalibrierung und Runtime-Konfiguration `T079`–`T093` seriell; `T094`–`T098` sind nach dem Serververtrag parallel.

### User Story 4

`T101`–`T104` laufen parallel; nach Actions `T105` und `T106` können `T107` und `T108` parallel umgesetzt werden.

### User Story 5

`T110`, `T111` und `T112` laufen parallel; `T113` und `T114` sind seriell zur gemeinsamen Prompt-/Context-Grenze, `T115` kann parallel zur Darstellung entstehen.

### User Story 6

`T117` und `T118` laufen parallel; danach folgen Loader `T119`, Page-Integration `T120` und Darstellung `T121`.

---

## Implementation Strategy

### MVP First

1. Phase 1 Setup abschließen.
2. Phase 2 Fundament abschließen.
3. Phase 3 US1 abschließen.
4. US1 unabhängig prüfen und als privaten Arbeitsbereich vorführen.

### First Complete Demo

1. US2 ergänzt die sichere Dokumentaufnahme.
2. US3 ergänzt den belegten Chat und bildet den vollständigen Kernablauf.
3. Am T081-Checkpoint den Retrieval-Wert ausdrücklich freigeben.
4. Nach T100 Kernablauf und feste Zugriffsmatrix erneut prüfen.

### Incremental Delivery

1. US4 ergänzt Auswahl und historische Belege.
2. US5 ergänzt Widersprüche und Schutz vor Dokumentanweisungen.
3. US6 ergänzt den persistenten Verlauf.
4. Phase 9 führt alle Gates, Nicht-Gate-Berichte und den Handoff aus.

## Notes

- `[P]` bedeutet ausschließlich dateiseitig unabhängige Arbeit.
- Kein Agent merged; der Autor ist nicht alleiniger Reviewer.
- Deterministische Gate-Tests werden nie zugunsten eines Modellberichts abgeschwächt.
- `pnpm eval`, `pnpm calibrate:retrieval` und `pnpm perf` bleiben Nicht-Gates.
- Die physische Bereinigung verwaister Storage-Objekte nach Upload-Abbruch oder vollständiger Notebook-Löschung bleibt die dokumentierte Demo-Ausnahme; normale Quellenlöschung und Replacement-`cleanup` bleiben Pflicht.
