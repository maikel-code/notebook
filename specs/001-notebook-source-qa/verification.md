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
