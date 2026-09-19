# Verifikation: 001-notebook-source-qa

## Phase 1–3 / US1 — 2026-09-19

**Umfang:** T001–T040. T041 und spätere Aufgaben wurden nicht bearbeitet.

**Test-first-Nachweis:** Die US1-Integrationssuite wurde vor der Implementierung der
Notebook-Services ausgeführt und schlug erwartungsgemäß wegen des fehlenden Moduls
`lib/notebooks/service` fehl. Nach der Implementierung und einem behobenen
Constraint-Trigger-Fehler liefen dieselben Tests grün.

| Prüfung | Ergebnis |
| --- | --- |
| `pnpm typecheck` | erfolgreich |
| `pnpm lint` | erfolgreich, 45 Dateien geprüft |
| `pnpm test` | erfolgreich; in Phase 1–3 sind keine Unit-Testdateien vorgesehen |
| `pnpm build` | erfolgreicher Next.js-Produktions-Build |
| `SUPABASE_TELEMETRY_ENABLED=false pnpm db:reset` | erfolgreich; acht Migrationen frisch angewendet |
| `pnpm test:integration` | erfolgreich; 5 Dateien, 25 Tests |
| `pnpm test:e2e` | erfolgreich; 1 Chromium-Ablauf |

Der Chromium-Ablauf deckt Registrierung, geschützte Route, Leerzustand, Anlegen,
Öffnen, Umbenennen, bestätigtes Löschen, Abmelden, den erneuten Zugriff auf die
alte geschützte URL und die erneute Anmeldung ab. Die Integrationssuite deckt die vollständige US1-
Zugriffsmatrix, neutrale `404`-Antworten, direkte RLS-Grenzen aller sechs Tabellen,
fremde Elternbeziehungen und die Löschkaskade ab.

## Korrekturschleife zu d72456f — 2026-09-19

**Umfang:** Review-Befunde F1–F10 ausschließlich innerhalb von T001–T040.
T041 und spätere Aufgaben blieben unverändert.

| Befund | Korrektur | Nachweis |
| --- | --- | --- |
| F1 | Notebook-Aktionen verwenden `useActionState`, behandeln erwartete HTTP-Fehler und haben eine App-Fehlergrenze. | `notebook-server-actions.test.ts` |
| F2 | Zitate behalten beim Chunk-Löschen die `source_id`; beim Source-Löschen werden beide Referenzen geleert. | `citation-reingestion.test.ts` |
| F3 | Echte Server-Aktionen prüfen anonyme, eigene und fremde Zugriffe; manipulierte `user_id`-Formfelder werden ignoriert. | `notebook-server-actions.test.ts` |
| F4 | `requireOwnedNotebook` ist die gemeinsame Eigentumsprüfung für Seite und Service. | `notebook-server-actions.test.ts` |
| F5 | Neue Tabellen und Funktionen des Projekt-Migrations-Grantors starten mit widerrufenen Browser-Privilegien. | `default-privileges.test.ts` |
| F6 | RLS-Schreibtests verwenden je Tabelle gültige, miteinander verknüpfte Datensätze. | `rls-write-boundaries.test.ts` |
| F7 | `next` ist auf `/notebooks` und Notebook-UUID-Routen beschränkt. | `auth-return-path.test.ts`, E2E-Ablauf |
| F8 | `agentRules: false` verhindert die AGENTS-Generierung durch `next dev`. | E2E-Lauf und leerer `git diff -- AGENTS.md` |
| F9 | Hydrationsmarker blockieren keine Aktionen; nur tatsächlich ausstehende Übermittlungen sperren Buttons. | E2E-Ablauf |
| F10 | Quickstart nennt `ANTHROPIC_API_KEY` und `OPENAI_API_KEY` getrennt. | Dokumentationsprüfung |

**Test-first-Nachweis F2:** Vor der Trigger-Änderung schlug
`pnpm test:integration -- tests/integration/citation-reingestion.test.ts` mit
`P0001: citation chunk and source must both be present or both be historical`
fehl. Nach der Änderung prüft derselbe Test den Chunk- und den anschließenden
Source-Löschpfad erfolgreich.

| Prüfung unter Node 22.14.0 | Ergebnis |
| --- | --- |
| `pnpm typecheck` | erfolgreich |
| `pnpm lint` | erfolgreich; 53 Dateien geprüft |
| `pnpm test` | erfolgreich; 1 Datei, 6 Tests |
| `SUPABASE_TELEMETRY_ENABLED=false pnpm db:reset` | erfolgreich; neun Migrationen frisch angewendet |
| `pnpm test:integration` | erfolgreich; 8 Dateien, 31 Tests |
| `pnpm test:e2e` | erfolgreich; 1 Chromium-Ablauf |
| `pnpm build` | erfolgreicher Next.js-Produktions-Build |
| Secret-Namen in `.next/static` | keine Treffer für Service-Role-, Modell- oder Job-Trigger-Variablen |

## Phase 4 — Zweite Review-Korrektur — 2026-09-19

`prepare_source_upload` erlaubt pro Altquelle nur einen Ersatz-Entwurf; der
Bestätigungsweg kann damit keinen per FK entkoppelten zweiten Entwurf als Zusatz
verarbeiten. `ingestion_jobs.created_at` bestimmt die sichtbare aktuelle Phase
explizit. Neue Integrationsfälle prüfen konkurrierenden Ersatz, textlosen Scan
(`unusable`), drei Worker-Fehler mit Retry bei Versuch 0 und die neueste
Jobphase. T041, T046, T047 und T050 sind wieder offen markiert, weil ihre
vollständigen ausdrücklich geforderten Fälle noch nicht vorliegen.

Passwortgeschützte und 51-seitige PDFs werden jetzt mit echten PDF-Strukturen
durch `pdfjs` abgelehnt. Storage prüft die exakte 10-MB-Grenze sowie fremde,
anonyme, fehlende, MIME-, Übergrößen-, Update- und Löschpfade. Beide Läufe
bestanden lokal unter Node 22.

**Offen / Plattformgrenze F5:** Die Migration kann die Default-ACLs des
Projekt-Migrations-Grantors `postgres` ändern. Supabase-interne Rollen wie
`supabase_admin` dürfen aus einer Projektmigration nicht verändert werden
(`must be member of role`). Tabellen oder Funktionen, die künftig unter solchen
Rollen erstellt würden, benötigen deshalb eine platformseitige Privilegienrichtlinie.

**Umgebungshinweise:** Next.js 16.3.5 warnt, dass `middleware.ts` künftig
`proxy.ts` heißt; T035 verlangt für diese Phase ausdrücklich `middleware.ts`.
Die Supabase-CLI warnt vor dem künftig umzubenennenden lokalen Abschnitt
`[inbucket]`. Keine der Warnungen hat einen Prüfablauf blockiert.

## Zweite Korrekturschleife zu 575ba8e — 2026-09-19

**Umfang:** Re-Review-Befunde ausschließlich in T001–T040. T041 und spätere
Aufgaben blieben unverändert.

| Befund | Korrektur | Nachweis |
| --- | --- | --- |
| P1 | Fremdbeziehungs-Tests verwenden eindeutige Ordinals und verlangen für jede Elternbeziehung `23503` mit dem jeweiligen Ownership-Constraint. | `rls-write-boundaries.test.ts` |
| P2 | Standardrechte für künftige Sequenzen widerrufen. | `default-privileges.test.ts` prüft `r`, `S`, `f` |
| P3 | Bestehende Funktion `enforce_citation_reference_consistency()` entzieht `public`, `anon` und `authenticated` explizit `EXECUTE`. | `default-privileges.test.ts` |
| P4 | Create- und Rename-Eingaben verknüpfen ihre Fehler-ID per `aria-describedby` und setzen `aria-invalid`. | Chromium-E2E für beide Formulare |
| P5 | ACL-Test leitet den lokalen Datenbankcontainer aus `supabase/config.toml` ab. | Docker-Label-Lookup im ACL-Test |
| P6 | Der Integrationslauf führt einmal `supabase db reset --local` aus und hält bis zum Suite-Ende einen lokalen Lock. | `global-setup.ts`; kompletter Integrationslauf |
| Node 22 | Tatsächlich ausgeführt mit `/opt/homebrew/opt/node@22/bin/node` (`v22.14.0`). | reproduzierbarer PATH-Befehl in Quickstart und README |

**Test-first-Nachweis P2/P3:** Vor der Migrationsergänzung schlugen die neuen
ACL-Tests fehl: Sequenzen enthielten `anon` und `authenticated`, die Trigger-
Funktion war für beide Rollen ausführbar (`true|true`). Nach dem frischen
lokalen Reset bestehen die erweiterten Tests.

| Prüfung unter Node 22.14.0 | Ergebnis |
| --- | --- |
| `pnpm typecheck` | erfolgreich |
| `pnpm lint` | erfolgreich; 54 Dateien geprüft |
| `pnpm test` | erfolgreich; 1 Datei, 6 Tests |
| `pnpm test:integration` | erfolgreich; lokaler Reset mit `--local`, 8 Dateien, 32 Tests |
| `pnpm test:e2e` | erfolgreich; 1 Chromium-Ablauf einschließlich Formfehler-Zugänglichkeit |
| `pnpm build` | erfolgreicher Next.js-Produktions-Build |
| Secret-Namen in `.next/static` | keine Treffer für Service-Role-, Modell- oder Job-Trigger-Variablen |
| `git diff -- AGENTS.md` nach E2E | leer |

**Offene Risiken:** Der Integrations-Reset löscht bewusst nur die lokale
Supabase-Datenbank und benötigt deshalb Docker CLI, lokale Supabase-Instanz und
`.env.local`. Die Default-ACLs der Supabase-internen Rollen bleiben unverändert,
weil Projektmigrationen diese Rollen nicht verwalten dürfen; dafür bleibt die
bereits genannte Plattformrichtlinie erforderlich.

## Dritte Korrekturschleife zu ec98f84 — 2026-09-19

**Umfang:** Re-Review-Befunde ausschließlich in T001–T040. T041 und spätere
Aufgaben blieben unverändert.

| Befund | Korrektur | Nachweis |
| --- | --- | --- |
| P1 | Bestehende Trigger-Funktion wird mit `has_function_privilege` für `public`, `anon` und `authenticated` geprüft. | transaktionaler simulierte-PUBLIC-Grant-Test |
| P2 | Default-ACLs erkennen auch die leere PUBLIC-Grantee-Schreibweise `=X/...`. | transaktionaler simulierte-PUBLIC-Default-Grant-Test |
| P3 | Veraltete Node-25-Abweichung im Plan entfernt; Vorabskript erzwingt Node 22 vor Installationen und Projektbefehlen. | Node 25 lehnt ab, Node 22.14.0 führt Gates aus |
| P4 | Reset-Lock übernimmt nur atomar umbenannte verwaiste Lock-Verzeichnisse; Warte- und Stale-Schwellen sind getrennt. API-URL, DB-Port und Projekt-ID werden vor und nach `--local` validiert. | vollständiger Integrationslauf |
| P5 | E2E prüft nur die Wirkung der Fehler-ID über `aria-describedby` und `aria-invalid`. | Chromium-E2E |

**Regressionsnachweis P1/P2:** Innerhalb zurückgerollter Transaktionen erzeugen
`GRANT ... TO PUBLIC` und ein PUBLIC-Default-Grant nachweisbar `true` für alle
drei Funktionsprüfungen beziehungsweise `=X/postgres` in der Funktions-ACL.
Ein Rückbau der zugehörigen REVOKEs lässt damit die produktiven ACL-Tests rot
werden, ohne die lokale Datenbank dauerhaft zu verändern.

| Prüfung unter Node 22.14.0 | Ergebnis |
| --- | --- |
| Node-22-Vorabskript unter System-Node 25.4.0 | erwartete Ablehnung |
| `pnpm typecheck` | erfolgreich |
| `pnpm lint` | erfolgreich; 55 Dateien geprüft |
| `pnpm test` | erfolgreich; 1 Datei, 6 Tests |
| `pnpm test:integration` | erfolgreich; lokaler Reset mit Projekt-/Port-/URL-Validierung, 8 Dateien, 34 Tests |
| `pnpm test:e2e` | erfolgreich; 1 Chromium-Ablauf |
| `pnpm build` | erfolgreicher Next.js-Produktions-Build |
| Secret-Namen in `.next/static` | keine Treffer für Service-Role-, Modell- oder Job-Trigger-Variablen |

**Offene Risiken:** Der Reset bleibt absichtlich auf die lokale Instanz
beschränkt und benötigt Docker CLI, lokale Supabase-Instanz und `.env.local`.
Die Default-ACLs Supabase-interner Rollen liegen weiterhin außerhalb des
Änderungsrechts von Projektmigrationen. Ein erster Chromium-Lauf unmittelbar
nach einem lokalen Dienst-Neustart erhielt eine transiente Registrierungs-
ablehnung; der unveränderte Wiederholungslauf bestand. Bei parallelen lokalen
Prüfungen sollte deshalb kein weiterer Supabase-Reset neben dem E2E-Lauf starten.

## Phase 4 — Quellenaufnahme und Verarbeitungszustand — 2026-09-19

**Umfang:** T041–T069. Die Aufnahme prüft serverseitig Signatur, Größe,
Lesbarkeit, Passwortschutz und Seitenzahl. `confirm_source_upload`,
`replace_source_chunks` und der Job-Claim laufen als versionierte,
dienstrollenexklusive Datenbankfunktionen; jede Verarbeitung bleibt auf die
`user_id` des beanspruchten Auftrags eingeschränkt. Diagnose protokolliert nur
Korrelationskennung, Phase und stabilen Fehlercode.

**Test-first:** Die zehn neuen Phase-4-Testdateien wurden vor den jeweiligen
Modulen angelegt. Der erste Lauf scheiterte erwartungsgemäß an fehlenden
Ingestion-Modulen; danach decken die Integrationstests die Zugriffsmatrix für
Upload, Jobstatus, Storage und interne Auslöser, Dubletten/Quellenlimit und
atomaren Chunk-Ersatz ab.

| Prüfung unter Node 22.14.0 | Ergebnis |
| --- | --- |
| `SUPABASE_TELEMETRY_ENABLED=false pnpm db:reset` | erfolgreich; zehn Migrationen frisch angewendet |
| `pnpm typecheck` | erfolgreich |
| `pnpm lint` | erfolgreich; 86 Dateien geprüft |
| `pnpm test` | erfolgreich; 1 Datei, 6 Tests |
| `pnpm test:integration` | erfolgreich; frischer lokaler Reset, 17 Dateien, 48 Tests |
| `pnpm test:e2e` | erfolgreich; 2 Chromium-Abläufe |
| `pnpm build` | erfolgreich; Next-16-Produktions-Build |
| Secret-Namen in `.next/static` | keine Treffer |
| `pnpm dev` | erfolgreich; keine `middleware`-Deprecation |

**Next 16:** `middleware.ts` wurde gemäß offiziellem Vertrag nach `proxy.ts`
migriert und exportiert nun `proxy`. TypeScript bleibt bei 5.9.x: Der
freigegebene Plan schreibt TypeScript 5.x vor; ein Upgrade auf TypeScript 7
wäre eine unfreigegebene Stackänderung und benötigt in Next 16.3 zusätzlich
den experimentellen TypeScript-CLI-Schalter.

## Phase 4 — Review-Korrekturen zu 2aa7c70 — 2026-09-19

**Umfang:** Ausschließlich die fünf Review-Befunde innerhalb T041–T069:
Ersatz bei laufender Antwort, sofortiger serverseitiger Jobstart,
eigentümergebundener Dienstrollenlauf, paralleles Quellenlimit und T049.
Keine Radix-, Base-UI- oder TypeScript-Änderung.

| Befund | Korrektur | Nachweis |
| --- | --- | --- |
| Ersatz während Streaming | `confirm_source_upload` sperrt den Ersatzpfad vor jeder Mutation; der Serverpfad übersetzt den Konflikt zu `409`. | `ingestion-review-regressions.test.ts` prüft Storage-bestätigten Ersatz, `409`, unveränderte Alt-/Entwurfsquelle und keinen Auftrag. |
| Unmittelbarer Start | `confirmUpload` beansprucht den gerade bestätigten Auftrag serverseitig nach dessen atomarer Anlage. | `upload-immediate-job.test.ts` prüft den Aufruf ohne Browser-Geheimnis. |
| Dienstrollen-Kontext | Der Worker lädt die Auftragsquelle immer mit `source_id` und beanspruchter `user_id`; der Integrationsfall führt einen echten Dienstrollenauftrag neben einer fremden Quelle aus. | `ingestion-job-access.test.ts` |
| Quellenlimit | `prepare_source_upload` sperrt das Notebook und entscheidet Dublette, Zusatz und Ersatz innerhalb einer Datenbanktransaktion. Ein Ersatz-Entwurf zählt nicht als weitere aktive Quelle. | parallele 29→30-Zusätze sowie Zusatz plus Ersatz bei 30 Quellen in `ingestion-review-regressions.test.ts` |
| T049 | Bestätigung prüft fehlendes Objekt, Größe und Hash; der erfolgreiche Ersatz prüft den atomaren Wechsel, `cleanup_storage_path` und genau einen Auftrag bei Wiederholung. | `upload-confirmation.test.ts` |

**Test-first-Nachweis:** Nach einem lokalen Reset bis `202609190010` (ohne
Review-Migration) schlugen die neuen T049-/Regressionstests erwartungsgemäß
fehl: 2 Dateien, 5 fehlgeschlagene Tests, weil `prepare_source_upload` fehlte.
Nach dem frischen Reset mit `202609190011_ingestion_review_hardening.sql`
bestehen die gezielten Fälle: 4 Dateien, 11 Tests. Damit würden das Fehlen der
atomaren Vorbereitungs- und Konfliktlogik sowie die T049-Sicherungen erkannt.

| Prüfung unter Node 22.14.0 | Ergebnis |
| --- | --- |
| `SUPABASE_TELEMETRY_ENABLED=false pnpm db:reset` | erfolgreich; elf Migrationen frisch angewendet |
| Frischer Integrationslauf | erfolgreich; 19 Dateien, 56 Tests |
| `pnpm typecheck` | erfolgreich |
| `pnpm lint` | erfolgreich |
| `pnpm test` | erfolgreich; 1 Datei, 6 Tests |
| `pnpm test:e2e` | erfolgreich; 2 Chromium-Abläufe |
| `pnpm build` | erfolgreicher Next-16-Produktions-Build |
| Secret-Namen in `.next/static` | keine Treffer für Service-Role-, Modell- oder Job-Trigger-Variablen |
