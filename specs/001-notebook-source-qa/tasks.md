---

description: "Task list for 001-notebook-source-qa"
---

# Tasks: Quellengebundenes Notebook-Frage-Antwort-System

**Input**: Design documents from `specs/001-notebook-source-qa/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Testaufgaben sind enthalten. Die Spezifikation verlangt sie ausdrücklich (Abschnitt Verification Approach), und die Constitution macht positive **und** negative Zugriffsprüfungen zur Pflicht (Prinzip II) sowie aus Anforderungen abgeleitete Tests (Prinzip VI).

**Organization**: Gruppiert nach User Story, damit jede unabhängig gebaut, geprüft und vorgeführt werden kann.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel ausführbar (andere Dateien, keine offene Abhängigkeit)
- **[Story]**: zugehörige User Story (US1–US6)
- Dateipfade sind Teil der Aufgabe

## Path Conventions

Ein Next.js-Projekt im Wurzelverzeichnis (plan.md, Structure Decision): `app/`, `components/`, `lib/`, `supabase/`, `tests/`, `eval/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Projektgerüst, Werkzeuge, Prüfkommandos

- [ ] T001 Next.js-Projekt mit TypeScript und App Router im Wurzelverzeichnis anlegen, Verzeichnisse `app/`, `components/`, `lib/`, `supabase/`, `tests/`, `eval/` gemäß plan.md
- [ ] T002 Node 22 LTS festschreiben in `.nvmrc` und im Feld `engines` von `package.json` (D-12; lokal läuft v25.4.0, das ist die Abweichung)
- [ ] T003 [P] TypeScript im strengen Modus konfigurieren in `tsconfig.json`
- [ ] T004 [P] Linting und Formatierung einrichten in `biome.json` oder `eslint.config.mjs`
- [ ] T005 [P] Tailwind CSS v4 einrichten in `app/globals.css` und der Tailwind-Konfiguration (D-13)
- [ ] T006 Komponenten von neobrutalism.com über die shadcn-kompatible Befehlszeile nach `components/ui/` holen; **vor der Verwendung die Lizenzbezeichnung prüfen und in `research.md` unter D-13 eintragen** (offener Punkt aus D-13)
- [ ] T007 Skripte in `package.json` anlegen: `typecheck`, `lint`, `test`, `test:integration`, `test:e2e`, `db:reset`, `eval`, `perf`, `worker:sweep` — Wortlaut und Torzuordnung nach plan.md, Abschnitt Verification Commands
- [ ] T008 [P] `.env.example` anlegen mit allen Variablen aus quickstart.md; Werte für Dienstrolle, Modellschlüssel und `JOB_TRIGGER_SECRET` ohne Präfix `NEXT_PUBLIC_`, damit sie den Browser nicht erreichen
- [ ] T009 [P] Umgebungsvariablen beim Start prüfen in `lib/env.ts` (Zod-Schema, Abbruch mit klarer Meldung bei fehlendem Wert)
- [ ] T010 [P] Vitest einrichten in `vitest.config.ts` mit Testpfad `tests/unit/`
- [ ] T011 [P] Playwright einrichten in `playwright.config.ts` mit Testpfad `tests/e2e/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, Zugriffsregeln und Verbindungen. Ohne diese Phase kann keine User Story beginnen.

**⚠️ CRITICAL**: Erst nach Abschluss dieser Phase darf Arbeit an einer User Story starten.

- [ ] T012 Supabase-Cloud-Projekt verknüpfen und lokale Instanz starten, beides dokumentiert in `README.md`; **`supabase db reset` niemals mit dem Zusatz für die verknüpfte Instanz versehen — das würde das Cloud-Projekt leeren** (D-14)
- [ ] T013 Migration `notebooks` in `supabase/migrations/`: `name` 1–200 Zeichen und nach Trimmen nicht leer, `user_id` als Fremdschlüssel auf `auth.users` mit Kaskade beim Löschen
- [ ] T014 Migration `sources` in `supabase/migrations/`: `storage_path` im Muster `{user_id}/{notebook_id}/{source_id}.pdf`, `byte_size` höchstens 10 MB, `page_count` höchstens 50, `status` aus `uploading` · `processing` · `ready` · `failed` · `unusable`, `is_selected` persistent, **Index auf `(notebook_id, content_hash)` bewusst nicht eindeutig**, weil FR-010a die zusätzliche Aufnahme einer inhaltsgleichen Datei erlaubt
- [ ] T015 Migration `ingestion_jobs` in `supabase/migrations/`: `status` aus `queued` · `running` · `succeeded` · `failed`, `phase` aus `extract` · `chunk` · `embed` · `finalize`, `attempt` beginnt bei 0 mit Höchstwert 3, dazu `correlation_id` und `locked_at`
- [ ] T016 `pgvector` aktivieren und Migration `chunks` anlegen in `supabase/migrations/`: eindeutig über `(source_id, ordinal)`, Spalten `page_start`, `page_end`, `content`, `char_count`, `embedding` in der Dimension des Einbettungsmodells aus D-04
- [ ] T017 [P] Migration `messages` in `supabase/migrations/`: `role` aus `user` · `assistant`, `status` aus `streaming` · `complete` · `aborted` · `failed`, `content` höchstens 2.000 Zeichen bei Rolle `user`, `selected_sources_snapshot` als JSON-Kopie
- [ ] T018 Migration `citations` in `supabase/migrations/`: `chunk_id` und `source_id` **mit `ON DELETE SET NULL`, nicht kaskadierend**, dazu `source_name`, `quote`, `page_start`, `page_end`, `ordinal` als eigene Spalten, damit der Beleg die Löschung der Quelle überdauert (FR-028a, FR-031)
- [ ] T019 Row-Level-Security auf allen sechs Tabellen einschalten und je Tabelle für Lesen, Einfügen, Ändern und Löschen die Bedingung `user_id = auth.uid()` setzen in `supabase/migrations/`
- [ ] T020 Privaten Storage-Bucket anlegen und Zugriffsregel auf den ersten Pfadabschnitt binden, sodass `{user_id}/…` nur vom Eigentümer gelesen wird; keine öffentlichen Adressen (FR-003)
- [ ] T021 [P] Grenzwerte an einer Stelle festhalten in `lib/limits.ts`: `MAX_FILE_BYTES` 10 MB, `MAX_PAGES` 50, `MAX_SOURCES_PER_NOTEBOOK` 30, `MAX_SELECTED_SOURCES` 10, `MAX_QUESTION_CHARS` 2.000, `MAX_CONTEXT_CHARS` 60.000, `MAX_JOB_ATTEMPTS` 3, `JOB_TIMEOUT_MS` 5 Minuten
- [ ] T022 Supabase-Verbindungen anlegen in `lib/supabase/server.ts`, `lib/supabase/browser.ts` und `lib/supabase/service.ts`; **die Dienstrolle wird ausschließlich in `service.ts` erzeugt und nirgends sonst importiert** (D-10)
- [ ] T023 [P] Fehlerdiagnose ohne Inhaltspreisgabe in `lib/diagnostics.ts`: Korrelationsmerkmal, Phase und Ursache; Dokumentinhalte, personenbezogene Daten und Geheimnisse werden nie protokolliert (FR-038, SC-013)
- [ ] T024 Prüfgerüst für Integrationsläufe in `tests/integration/setup.ts`: zwei echte Benutzerkonten, ein anonymer Zugriff sowie gültiges und ungültiges `JOB_TRIGGER_SECRET` gegen die **lokale** Instanz, Aufräumen zwischen den Läufen

**Checkpoint**: Schema, Zugriffsregeln und Verbindungen stehen — User Stories können beginnen.

---

## Phase 3: User Story 1 — Privater Arbeitsbereich (Priority: P1) 🎯 MVP

**Goal**: Registrieren, anmelden, abmelden; eigene Notebooks anlegen, umbenennen, löschen. Fremde Notebooks bleiben unzugänglich, auch über bekannte Kennungen.

**Independent Test**: Zwei Konten anlegen, je ein Notebook, und mit Konto B das Notebook von A über dessen Kennung aufrufen. Ohne weitere Funktionen ist damit bereits ein privater Ablageort belegt.

### Tests for User Story 1

- [ ] T025 [P] [US1] Notebook-Teil der Demo-Zugriffsmatrix in `tests/integration/access-notebooks.test.ts`: Notebook-Seite und `renameNotebook` funktionieren für Konto A; Konto B erhält für A jeweils `404` ohne Inhalt; anonymer Zugriff erhält jeweils `401` ohne Inhalt
- [ ] T026 [P] [US1] Negativtest anonym in `tests/integration/rls-anonymous.test.ts`: Zugriff ohne Sitzung auf Notebook und dessen geschützte Seite liefert keine Inhalte und führt zur Anmeldung
- [ ] T027 [P] [US1] Test gegen Existenzauskunft in `tests/integration/no-existence-disclosure.test.ts`: fremde und nicht vorhandene Kennung liefern denselben Statuscode und dieselbe Meldung (FR-004)
- [ ] T028 [P] [US1] Ablauftest in `tests/e2e/auth-and-notebooks.spec.ts`: registrieren, anmelden, Notebook anlegen, umbenennen, löschen mit Bestätigung, abmelden

### Implementation for User Story 1

- [ ] T029 [P] [US1] Anmeldeseite in `app/(auth)/sign-in/page.tsx` mit Fehlermeldungen, die ihrem Eingabefeld zugeordnet sind
- [ ] T030 [P] [US1] Registrierungsseite in `app/(auth)/sign-up/page.tsx`, ohne E-Mail-Bestätigung (A-01)
- [ ] T031 [US1] Sitzungsprüfung und Abmelden in `lib/auth.ts` und `app/(auth)/actions.ts`
- [ ] T032 [US1] Weiterleitung nicht angemeldeter Zugriffe auf geschützte Pfade in `middleware.ts` — ohne Preisgabe von Inhalten (FR-005)
- [ ] T033 [US1] Server Actions `createNotebook`, `renameNotebook`, `deleteNotebook` in `app/notebooks/actions.ts` nach contracts/http-api.md; Name 1–200 Zeichen, nach Trimmen nicht leer; `deleteNotebook` lehnt während einer laufenden Antwort mit `409` ab
- [ ] T034 [US1] Notebook-Übersicht in `app/notebooks/page.tsx` mit erklärendem Leerzustand und Aktion zum Anlegen (FR-008)
- [ ] T035 [P] [US1] Bestätigungsdialog für löschende Aktionen in `components/notebook/confirm-delete-dialog.tsx`, benennt was entfernt wird (FR-035)
- [ ] T036 [US1] Notebook-Detailseite als Gerüst in `app/notebooks/[notebookId]/page.tsx`, lädt serverseitig und liefert bei fremder Kennung `404`

**Checkpoint**: US1 ist eigenständig vorführbar und geprüft.

---

## Phase 4: User Story 2 — Quellen aufnehmen (Priority: P1)

**Goal**: Textbasierte PDFs hochladen, Verarbeitungszustand verstehen, Fehler nachvollziehen und Wiederholung auslösen.

**Independent Test**: Ein gültiges PDF, eine beschädigte Datei und eine Bilddatei hochladen und die angezeigten Zustände beobachten.

### Tests for User Story 2

- [ ] T037 [P] [US2] Test Dateiannahme in `tests/integration/ingestion-rejects.test.ts`: beschädigtes PDF, leeres PDF, Bilddatei, passwortgeschütztes PDF, Datei über 10 MB, Dokument über 50 Seiten und 31. Quelle im Notebook — jede landet sichtbar in Ablehnung oder Fehler, keine wird `ready` (SC-007, FR-036)
- [ ] T038 [P] [US2] Test reiner Scan in `tests/integration/ingestion-scan.test.ts`: PDF ohne extrahierbaren Text endet auf `unusable` mit Hinweis auf fehlende Texterkennung (FR-013)
- [ ] T039 [P] [US2] Test Idempotenz in `tests/integration/ingestion-idempotent.test.ts`: zweiter Lauf über dieselbe Quelle verändert die Anzahl der Abschnitte nicht (FR-014, SC-008)
- [ ] T040 [P] [US2] Test Wiederholungsgrenze in `tests/integration/ingestion-retries.test.ts`: nach drei gescheiterten Versuchen steht der Auftrag auf `failed` und die Quelle zeigt eine lesbare Ursache (FR-037)
- [ ] T041 [P] [US2] Test Wiederaufnahme und interner Zugang in `tests/integration/ingestion-jobs.test.ts`: ein Auftrag mit `running` und überschrittener Laufzeitgrenze wird eingesammelt; `/api/jobs/run` und `/api/jobs/sweep` akzeptieren das gültige `JOB_TRIGGER_SECRET`, fehlendes und ungültiges Geheimnis liefern `401`; ein Cross-User-Auftrag zeigt, dass der Dienstrollenlauf ausschließlich Daten des Auftragseigentümers liest und schreibt
- [ ] T042 [P] [US2] Test Dublettenerkennung in `tests/integration/upload-duplicate.test.ts`: inhaltsgleiche Datei unter anderem Namen liefert `duplicate`; nach `replace` existiert genau eine Quelle dieses Inhalts (FR-010a)
- [ ] T043 [P] [US2] Storage-Teil der Demo-Zugriffsmatrix in `tests/integration/rls-storage.test.ts`: Konto A lädt die eigene Datei; Konto B und anonymer Zugriff erhalten über denselben bekannten Pfad keinen Inhalt

### Implementation for User Story 2

- [ ] T044 [P] [US2] Textextraktion seitenweise in `lib/ingestion/extract.ts` mit pdf.js; liefert Seitenzahl und Text je Seite, erkennt beschädigte und passwortgeschützte Dateien (D-11)
- [ ] T045 [P] [US2] Zerlegung in Abschnitte in `lib/ingestion/chunk.ts` mit Seitenbezug; `page_start` und `page_end` weichen nur bei Abschnitten über einem Seitenumbruch voneinander ab
- [ ] T046 [P] [US2] Einbettungen in `lib/ingestion/embed.ts` über OpenAI `text-embedding-3-small` (D-04)
- [ ] T047 [US2] Server Action `prepareUpload` in `app/notebooks/[notebookId]/actions.ts`: höchstens 30 Quellen je Notebook erzwingen, Prüfsumme des Inhalts abgleichen, `ok` · `duplicate` · `rejected` nach contracts/http-api.md, bei `intent: replace` die bisherige Quelle nach FR-031 entfernen
- [ ] T048 [US2] Prüfsumme des Dateiinhalts im Browser berechnen in `lib/hash.ts`, Grundlage der Dublettenerkennung — **nicht der Dateiname** (FR-010a)
- [ ] T049 [US2] Server Action `confirmUpload` in `app/notebooks/[notebookId]/actions.ts`: legt den Verarbeitungsauftrag an und stößt den Arbeitsschritt an
- [ ] T050 [US2] Arbeitsschritt in `app/api/jobs/run/route.ts`: Auftrag atomar beanspruchen mit Sperre und Überspringen gesperrter Zeilen, Phasen `extract` → `chunk` → `embed` → `finalize` durchlaufen, Zugang nur mit `JOB_TRIGGER_SECRET`
- [ ] T051 [US2] Wiederaufnahme in `app/api/jobs/sweep/route.ts`: Aufträge mit `running` und Zeitstempel älter als 5 Minuten wie einen Fehlschlag behandeln; **jede Abfrage zusätzlich auf `user_id` des Auftrags einschränken**, weil die Dienstrolle die Zugriffsregeln umgeht (D-10)
- [ ] T052 [US2] Idempotentes Schreiben in `lib/ingestion/persist.ts`: vor dem Schreiben alle Abschnitte der Quelle in derselben Transaktion löschen und neu anlegen (FR-014)
- [ ] T053 [US2] Kommando `worker:sweep` in `scripts/sweep.ts`, einmalig und mit wiederkehrender Ausführung; kein Zeitplan auf Datenbankseite, weil die Cloud die lokale Anwendung nicht erreicht (D-14)
- [ ] T054 [US2] Zustandsabfrage in `app/api/jobs/status/route.ts`: je Quelle Zustand, Phase und Fehlerursache
- [ ] T055 [US2] Quellenliste in `components/notebook/source-list.tsx` mit den Zuständen `wird verarbeitet`, `bereit`, `fehlgeschlagen`, `nicht nutzbar` und lesbarer Fehlerursache; `uploading` und `processing` erscheinen beide als `wird verarbeitet` (FR-011, FR-012)
- [ ] T056 [US2] Abfrage in kurzen Abständen in `components/notebook/use-job-status.ts`, solange ein Auftrag offen ist, danach Ende (D-15)
- [ ] T057 [P] [US2] Hochladefeld in `components/notebook/source-upload.tsx` mit Lade-, Erfolgs- und Fehlerzustand sowie der Rückfrage bei erkannter Dublette; ein Verbindungsabbruch zeigt einen Fehler, legt keinen Verarbeitungsauftrag an und bietet den vollständigen erneuten Upload an
- [ ] T058 [US2] Server Action `retryIngestion` in `app/notebooks/[notebookId]/actions.ts`: neuer Auftrag, Versuchszähler zurückgesetzt (FR-012)

**Checkpoint**: Dokumente lassen sich aufnehmen, Zustände sind verständlich, Fehler wiederholbar.

---

## Phase 5: User Story 3 — Belegte Antwort erhalten und im Original prüfen (Priority: P1)

**Goal**: Frage stellen, Antwort schrittweise lesen, Verweis anklicken und die Passage im Dokument sehen. Der Kernnutzen.

**Independent Test**: Frage an ein Notebook mit bekanntem Inhalt stellen und jeden Verweis bis zur Originalstelle verfolgen.

### Tests for User Story 3

- [ ] T059 [P] [US3] Test der Belegprüfung in `tests/unit/verify-citations.test.ts`: erfundener Auszug wird verworfen, unbekannte Nummer wird verworfen, abweichender Leerraum besteht, fehlerhafte Marke wird verworfen (D-07)
- [ ] T060 [P] [US3] Test Kontextgrenze in `tests/unit/context-budget.test.ts`: die Summe der übergebenen Abschnittstexte überschreitet 60.000 Zeichen nicht (FR-036)
- [ ] T061 [P] [US3] Test der Vorbedingungen und Zugriffsmatrix in `tests/integration/chat-preconditions.test.ts`: keine Quelle ausgewählt, keine im Zustand `ready`, keine einschlägige Passage, Frage über 2.000 Zeichen — jeweils Erklärung statt Antwort mit Verweisen; Chat und Status funktionieren für den Eigentümer, liefern fremd `404` und anonym `401`, jeweils ohne Inhalt (FR-022, SC-002)
- [ ] T062 [P] [US3] Terminalzustände in `tests/integration/chat-terminal-states.test.ts`: Anbieterausfall endet auf `failed`; Client-Abbruch beendet die Modellanforderung und endet auf `aborted`; in beiden Fällen erscheint die Teilantwort nicht als fertig und die Notebook-Sperre wird frei; Quellen- und Notebook-Löschung liefern während `streaming` den Konflikt `409` (FR-020a, FR-025, FR-035)
- [ ] T063 [P] [US3] Ablauftest Kernablauf in `tests/e2e/core-flow.spec.ts`: anmelden, Notebook anlegen, PDF hochladen, fragen, Antwort lesen, Verweis öffnen und die hervorgehobene Passage oder den freigegebenen Wortlaut-Fallback sehen (FR-029, FR-032)

### Implementation for User Story 3

- [ ] T064 [P] [US3] Ähnlichkeitssuche in `lib/rag/retrieve.ts`: Abschnitte der **ausgewählten** Quellen im Zustand `ready`, Auswahl serverseitig aus der Sitzung gebildet, nie aus Modellausgabe (FR-021, D-09)
- [ ] T065 [US3] Zusammenstellung des Kontexts in `lib/rag/context.ts`: nummerierte Blöcke mit Quellennamen, Seitenbereich und Text, begrenzt auf `MAX_CONTEXT_CHARS`
- [ ] T066 [US3] Systemanweisung in `lib/rag/prompt.ts`: Blockinhalte sind Material und keine Anweisung, jede Aussage braucht eine Belegmarke, fehlende Beleglage wird gesagt statt gefüllt (FR-022, FR-024)
- [ ] T067 [US3] Marken zerlegen in `lib/rag/parse-citations.ts` nach dem Muster `[[cite:<nummer>|<wörtlicher Auszug>]]` aus contracts/answer-and-citations.md
- [ ] T068 [US3] Belegprüfung in `lib/rag/verify-citations.ts`: Auszug nach Vereinheitlichung von Leerraum wörtlich im genannten Abschnitt suchen; **jeder Zweifelsfall verwirft den Verweis**; bleibt keiner übrig, gilt die Antwort als unbelegt (D-07, FR-030)
- [ ] T069 [US3] Antwortstrom in `app/api/chat/route.ts` über das Vercel AI SDK mit Anthropic Claude (D-04); Client-Abbruch an den Modellaufruf weitergeben, Nachricht auf `aborted` setzen und Sperre freigeben; nach normalem Abschluss Antwort prüfen, Nachricht und geprüfte Verweise speichern
- [ ] T070 [US3] Sperre gegen gleichzeitige Antworten in `app/api/chat/route.ts`: läuft im Notebook bereits eine Nachricht auf `streaming`, antwortet der Aufruf mit `409` (FR-020a)
- [ ] T071 [P] [US3] Chatverlauf in `components/notebook/chat-thread.tsx` mit schrittweise erscheinender Antwort und nummerierten Belegmarken
- [ ] T072 [P] [US3] Fragefeld in `components/notebook/question-input.tsx`, gesperrt während der Erzeugung, mit Abbrechen (FR-020a)
- [ ] T073 [US3] Belegansicht in `components/notebook/source-viewer.tsx` mit pdf.js: Seite öffnen und den geprüften Wortlaut in der Textebene hervorheben; wird er nicht gefunden, nach der freigegebenen Demo-Abschwächung die Seite öffnen und den Wortlaut daneben zeigen (D-11, FR-029)
- [ ] T074 [US3] Erklärung statt Antwort in `components/notebook/unsupported-answer.tsx` für die Fälle aus FR-022

**Checkpoint**: Der Kernablauf trägt. Ab hier ist das Produkt vorführbar.

---

## Phase 6: User Story 4 — Quellenauswahl steuern und Quellen entfernen (Priority: P2)

**Goal**: Auswählen, welche Quellen für die nächste Frage gelten, und Quellen entfernen.

**Independent Test**: Eine Frage, die nur aus Quelle A beantwortbar ist, einmal mit A und einmal mit B ausgewählt stellen.

### Tests for User Story 4

- [ ] T075 [P] [US4] Test der Auswahlwirkung in `tests/integration/selection-scope.test.ts`: alle Verweise stammen ausschließlich aus der Auswahl (FR-021)
- [ ] T076 [P] [US4] Test entfernter Quelle in `tests/integration/source-removal.test.ts`: nach dem Entfernen sind Datei und Abschnitte weg, die Verweise früherer Antworten behalten Wortlaut, Quellenname und Seite, `chunk_id` ist `NULL` (FR-031, FR-028a)
- [ ] T077 [P] [US4] Ablauftest in `tests/e2e/source-selection.spec.ts`: abwählen, fragen, alle abwählen und die Erklärung sehen

### Implementation for User Story 4

- [ ] T078 [US4] Server Action `setSourceSelected` in `app/notebooks/[notebookId]/actions.ts`, begrenzt auf höchstens 10 ausgewählte Quellen je Frage (FR-036)
- [ ] T079 [US4] Server Action `deleteSource` in `app/notebooks/[notebookId]/actions.ts`: mit Bestätigung, entfernt Datei und Abschnitte, lässt Verweise nach FR-031 unangetastet und lehnt während einer laufenden Antwort mit `409` ab
- [ ] T080 [P] [US4] Auswahlbedienung in `components/notebook/source-list.tsx` mit Hinweis, wenn keine Quelle ausgewählt ist
- [ ] T081 [P] [US4] Darstellung entfernter Belege in `components/notebook/citation-chip.tsx`: Wortlaut, Quellenname und Seite mit dem Hinweis „Quelle entfernt", ohne Sprung ins Dokument (FR-031)

---

## Phase 7: User Story 5 — Widersprüche und Anweisungsversuche (Priority: P2)

**Goal**: Widersprüche zwischen herangezogenen Passagen benennen. Anweisungen in Dokumenten verändern nichts.

**Independent Test**: Zwei präparierte Quellen mit widersprüchlicher Angabe und eine Quelle mit eingebetteter Anweisung.

### Tests for User Story 5

- [ ] T082 [P] [US5] Test gegen Anweisungen im Dokument in `tests/integration/prompt-injection.test.ts`: präpariertes Dokument fordert das Offenlegen anderer Notebooks und das Behaupten ohne Beleg — Antwortverhalten und Zugriffsgrenzen bleiben unverändert (FR-024, SC-006)
- [ ] T083 [P] [US5] Test Widerspruch in `tests/integration/contradiction.test.ts`: die Antwort benennt den Widerspruch und verweist auf beide Stellen (FR-023)

### Implementation for User Story 5

- [ ] T084 [US5] Regel für Widersprüche in `lib/rag/prompt.ts` ergänzen: nur innerhalb der für die aktuelle Frage herangezogenen Passagen, keine Prüfung des Bestands (FR-023, Clarification vom 2026-09-14)
- [ ] T085 [P] [US5] Darstellung des Widerspruchs in `components/notebook/chat-thread.tsx` mit Verweis auf beide Stellen
- [ ] T086 [P] [US5] Präparierte Dokumente in `eval/dataset/`: ein widersprüchliches Paar und ein Dokument mit eingebetteter Anweisung

---

## Phase 8: User Story 6 — Gesprächsverlauf bleibt erhalten (Priority: P3)

**Goal**: Nach erneutem Öffnen sind Fragen, Antworten und Verweise vorhanden.

**Independent Test**: Fragen, abmelden, anmelden, Notebook öffnen.

### Tests for User Story 6

- [ ] T087 [P] [US6] Test Verlauf in `tests/integration/conversation-history.test.ts`: Reihenfolge erhalten, Verweise vorhanden, fremder Zugriff auf den Verlauf scheitert
- [ ] T088 [P] [US6] Ablauftest in `tests/e2e/history.spec.ts`: abmelden, anmelden, Verlauf wiederfinden

### Implementation for User Story 6

- [ ] T089 [US6] Verlauf serverseitig laden in `app/notebooks/[notebookId]/page.tsx`, Reihenfolge nach Anlagezeitpunkt
- [ ] T090 [US6] Gespeicherte Verweise darstellen in `components/notebook/chat-thread.tsx`, einschließlich der Fälle mit entfernter Quelle

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T091 [P] Bewertungslauf in `eval/run.ts`: Belegtreue als Berichtsmetrik und Anteil ehrlicher Einschränkungen nach SC-005 am Referenzdatensatz, Bericht als Ausgabe; **kein Freigabetor** (Prinzip VI, plan.md)
- [ ] T092 [P] Referenzdatensatz in `eval/dataset/` anlegen: vier selbst erstellte oder ausdrücklich freigegebene PDFs und zwölf Fragen gemäß spec.md, einschließlich erwarteter Belegstellen und dokumentierter Bewertungskriterien
- [ ] T093 [P] Tastaturlauf in `tests/e2e/keyboard.spec.ts`: Kernablauf ausschließlich per Tastatur, Fokus immer sichtbar, kein Bereich ohne Ausweg (SC-009, FR-034)
- [ ] T094 [P] Kontrast und Fokusring der Komponenten aus `components/ui/` prüfen und nachziehen; die kräftige Gestaltung darf den Fokus nicht verschlucken (D-13)
- [ ] T095 [P] Test der Diagnose in `tests/integration/diagnostics.test.ts`: ausgelöste Fehler tragen Korrelationsmerkmal, Phase und Ursache, und weder Dokumentinhalt noch personenbezogene Daten noch Geheimnisse (SC-013, FR-038)
- [ ] T096 [P] Prüfung auf Geheimnisse im Browser-Bündel in `tests/unit/no-server-secrets.test.ts`: keine Variable ohne Präfix `NEXT_PUBLIC_` erreicht den Client
- [ ] T097 `README.md` schreiben mit Voraussetzungen sowie Setup-, Start- und Prüfkommandos — Pflicht aus AGENTS.md mit der Stack-Festlegung
- [ ] T098 [P] Performance-Smoke-Test in `eval/performance.ts`: fünf Läufe in der vorbereiteten Demo-Umgebung, Zeit bis zum ersten sichtbaren Antwortteil einzeln berichten und SC-011 auswerten; **kein Freigabetor**
- [ ] T099 Alle Prüfkommandos aus plan.md einmal vollständig durchlaufen, den vorbereiteten Demo-Kernablauf mit Zeitmessung unter 10 Minuten proben und Ergebnisse im Handoff festhalten (Gate 3, Gate 6, SC-001)

---

## Dependencies

```text
Phase 1 Setup
   └─► Phase 2 Foundational  ⚠ blockiert alle Stories
          ├─► Phase 3  US1  (P1)  🎯 MVP
          │      └─► Phase 4  US2  (P1)   braucht Notebook + Sitzung
          │             └─► Phase 5  US3  (P1)   braucht verarbeitete Quellen
          │                    ├─► Phase 6  US4  (P2) ─┐
          │                    ├─► Phase 7  US5  (P2) ─┼─► Phase 9  Polish
          │                    └─► Phase 8  US6  (P3) ─┘
```

US4, US5 und US6 hängen jeweils an US3, aber **nicht aneinander** — nach Abschluss von US3 sind sie parallel bearbeitbar. Phase 9 beginnt erst, wenn US4, US5 und US6 abgeschlossen sind.

## Parallel Opportunities

| Phase | Parallel ausführbar |
|---|---|
| Setup | T003, T004, T005, T008, T009, T010, T011 |
| Foundational | T017, T021, T023 (T013–T016 und T018 bauen aufeinander auf, T019 braucht alle Tabellen) |
| US1 | Tests T025–T028; Umsetzung T029, T030, T035 |
| US2 | Tests T037–T043; Umsetzung T044, T045, T046, T057 |
| US3 | Tests T059–T063; Umsetzung T064, T071, T072 |
| US4 | Tests T075–T077; Umsetzung T080, T081 |
| US5 | Tests T082, T083; Umsetzung T085, T086 |
| US6 | T087, T088 |
| Polish | T091, T092, T094, T096, T098; T093 und T095 erst nach ihren vollständigen Ablauf- beziehungsweise Fehlerpfaden; T099 nach allen Prüfaufgaben |

## Implementation Strategy

**MVP**: Phase 1 + Phase 2 + Phase 3. Danach steht ein privater Arbeitsbereich mit nachgewiesener Zugriffsgrenze — das ist der Teil, dessen Fehlen den größten Schaden anrichtet.

**Erster vorführbarer Stand**: nach Phase 5. Der Kernablauf aus spec.md ist dann vollständig, einschließlich geprüfter Belege.

**Abschlussphase**: Phase 9 läuft nach den User Stories und enthält die vollständigen Nachweise, die Demo-Generalprobe und die nicht blockierenden Qualitäts- und Performanceberichte.

**Reihenfolge innerhalb einer Story**: Tests zuerst, dann Datenzugriff, dann Server Actions und Endpunkte, dann Oberfläche. Die Zugriffstests aus Phase 3 laufen ab dann bei jedem Gate-Durchlauf mit.

**Zwei Regeln, die nicht verhandelbar sind**: Ein fehlschlagender deterministischer Test wird nicht abgeschwächt, um eine Umsetzung durchzubringen (Prinzip I). Ein öffentlich erreichbarer Datenpfad ohne die zugehörigen Fälle der festgelegten Demo-Zugriffsmatrix gilt als unfertig (Prinzip II, Gate 4).
