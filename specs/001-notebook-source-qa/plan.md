# Implementation Plan: Quellengebundenes Notebook-Frage-Antwort-System

**Branch**: `001-notebook-source-qa` | **Stand**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

## Summary

Next.js-Anwendung mit privaten Notebooks, PDF-Aufnahme und quellengebundenem Chat. Vier Teile: **Supabase** (Datenbank, Authentifizierung, Dateiablage, durchgängige RLS), eine **Aufnahmestrecke** (seitenweise Zerlegung und Einbettung), eine **Abrufstrecke** (Vektorähnlichkeit über die ausgewählten Quellen) und eine **Belegprüfung**, die jedes Zitat wörtlich gegen den zitierten Abschnitt abgleicht.

Die Belegprüfung ist der tragende Teil: sie prüft Herkunft, Auswahl und Wortlaut jedes angezeigten Verweises deterministisch. Ob die Passage die zugeordnete Aussage inhaltlich stützt, bleibt eine getrennte Qualitätsmetrik des Referenzdatensatzes (research.md D-07).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22 LTS gepinnt (D-12)

**Primary Dependencies**: Next.js App Router, React, Tailwind CSS v4, Komponenten von neobrutalism.com (D-13), Supabase JS, Vercel AI SDK, pdf.js, Zod

**Storage**: Supabase Postgres mit `pgvector`, privater Storage-Bucket. Cloud-Projekt für Entwicklung und Vorführung, eigene lokale Instanz für Prüfläufe (D-14)

**Testing**: Vitest, Playwright, Integrationslauf für Zugriffsgrenzen, getrennter Bewertungslauf (D-16)

**Target Platform**: Browser (aktuelle Chromium-, Firefox-, WebKit-Versionen)

**Project Type**: Ein Next.js-Projekt mit Server- und Clientanteil

**Performance Goals**: SC-011 erster Antwortteil in mindestens vier von fünf dokumentierten Demo-Läufen ≤ 5 s; beobachtender Smoke-Wert, kein Freigabetor

**Constraints**: Grenzwerte aus spec.md, zentral in `lib/limits.ts`

**Scale/Scope**: Demonstrationsumgebung, einzelne Benutzer (A-09)

## Constitution Check

*Gate vor Phase 0, nach Phase 1 erneut geprüft — kein Prinzip verletzt.*

| Prinzip | Einlösung |
|---|---|
| I Technische Verantwortung | Entscheidungen mit Alternative in research.md; Prüfkommandos unten |
| II Sichere Zugriffsgrenzen | Feste Demo-Matrix für Notebook-Seite plus `renameNotebook`, Storage-Download, Chat und Status; interne Jobs mit Geheimnisprüfung und Cross-User-Worker-Test; Dienstrolle auf den Auftragseigentümer eingeschränkt (D-10) |
| III Quellengebundene Antworten | Herkunft und Wortlaut fail-closed geprüft (D-07), semantische Belegtreue separat berichtet, Dokumenttext als Daten (D-09), Abruf auf ausgewählte Quellen begrenzt |
| IV Einfache Architektur | Ein Projekt, eine Datenbank, keine zusätzliche Laufzeit. Drei Abhängigkeiten in research.md begründet; drei Auslöser des Verarbeitungsauftrags unter Complexity Tracking |
| V Vollständige Nutzerabläufe | Zustände als Zustandsmaschinen in data-model.md; Barrierefreiheit über die Primitive, geprüft in Playwright |
| VI Verifikation | Deterministisch und probabilistisch als getrennte Kommandos; der Bewertungslauf ist kein Tor |
| VII Reproduzierbarkeit | Node gepinnt, Migrationen versioniert, Grenzwerte zentral, Idempotenz über stabilen Schlüssel (D-06) |
| VIII Zusammenarbeit | Entscheidungen in research.md, Verträge in contracts/, Prüfweg in quickstart.md |

**Nach Phase 1**: Der Entwurf hat eine Grenze hinzugewonnen (interne Endpunkte hinter einem serverseitigen Geheimnis), keine Abhängigkeit ergänzt und die Zahl eigener Endpunkte auf vier gesenkt. Zwei Abweichungen der Arbeitsumgebung sind in quickstart.md benannt statt übergangen: Node v25 statt 22 LTS, und die Notwendigkeit zweier getrennter Supabase-Instanzen.

## Verification Commands

Verbindlich für Gate 3. Codex führt sie aus und weist das Ergebnis im Handoff nach.

| Zweck | Kommando | Tor |
|---|---|---|
| Typprüfung | `pnpm typecheck` | Gate 3 |
| Linting und Format | `pnpm lint` | Gate 3 |
| Reine Logik | `pnpm test` | Gate 3 |
| Zugriffsgrenzen und Aufnahme | `pnpm test:integration` | Gate 3 + Gate 4 |
| Abläufe im Browser | `pnpm test:e2e` | Gate 3 |
| Migrationen auf frischer Datenbank | `pnpm db:reset` (lokale Instanz) | Gate 3 |
| Antwortqualität | `pnpm eval` | **kein Tor** — probabilistisch |
| Antwortlatenz | `pnpm perf` | **kein Tor** — beobachtender Demo-Smoke-Test |

- `pnpm eval` DARF NICHT als Nachweis für Gate 3 dienen (Prinzip VI).
- `pnpm perf` DARF NICHT als Nachweis für Gate 3 dienen; Umgebung und fünf Einzelwerte werden berichtet.
- Bei Fehlschlag wird die Ursache behoben, nicht der Prüfumfang verkleinert (Prinzip I).
- `pnpm test:integration` setzt die laufende lokale Instanz voraus (quickstart.md).

## Project Structure

### Documentation

```text
specs/001-notebook-source-qa/
├── plan.md · research.md · data-model.md · quickstart.md · spec.md · tasks.md
├── contracts/{http-api,ingestion-job,answer-and-citations}.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
app/
├── (auth)/{sign-in,sign-up}/page.tsx
├── notebooks/page.tsx
├── notebooks/[notebookId]/page.tsx
└── api/{chat,jobs/run,jobs/sweep,jobs/status}/route.ts

components/
├── ui/                     # von neobrutalism.com kopiert
└── notebook/               # Quellenliste, Chatverlauf, Belegansicht

lib/
├── supabase/               # Server, Browser, Dienstrolle
├── ingestion/              # Extraktion, Zerlegung, Einbettung
├── rag/                    # Abruf, Aufforderungstext, Zitatprüfung
└── limits.ts               # Grenzwerte an einer Stelle

supabase/migrations/        # Schema inklusive Zugriffsregeln
tests/{unit,integration,e2e}/
eval/{dataset,run.ts}       # bewusst außerhalb tests/
```

**Structure Decision**: Ein Next.js-Projekt im Wurzelverzeichnis. Getrennte Frontend- und Backend-Verzeichnisse wären künstlich, weil Next.js beide Seiten trägt und Typen geteilt werden. Die Trennlinien verlaufen in `lib/`: Aufnahme, Abruf und Datenzugriff sind ohne Oberfläche prüfbar. `eval/` liegt außerhalb `tests/`, damit die probabilistische Bewertung nicht in einen Gate-Lauf gerät.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Drei Auslöser des Verarbeitungsauftrags statt eines | FR-011 sichtbarer Fortschritt, FR-012 manueller Wiederholversuch, FR-037 begrenzte automatische Wiederholung mit sichtbarem Fehlerzustand | Nur der Aufruf nach dem Upload lässt einen abgestürzten Lauf dauerhaft auf `processing` stehen — der Benutzer sieht nie einen Fehler. FR-037 fällt damit |
| Eigene Tabelle für Verarbeitungsaufträge | Versuchszähler, Phase und Ursache gehören zum Lauf, nicht zum Dokument; FR-014 braucht einen Lauf mit eigenem Schlüssel | Zustandsfelder auf der Quelle vermischen Dokument und Lauf; ein zweiter Versuch überschreibt die Vorgeschichte und FR-038 verliert die Datengrundlage |
| Zitatprüfung als eigener Schritt | FR-030 verlangt eine deterministisch prüfbare Herkunft und einen wörtlich vorhandenen Auszug | Nur der Modellmarke zu vertrauen würde Herkunft und Wortlaut ungeprüft lassen; die semantische Belegtreue wird separat berichtet |

## Demo-Ausnahme: Storage-Bereinigung

**Entscheidung des Maintainers vom 2026-09-19**: Die physische Bereinigung möglicher verwaister Storage-Objekte nach Upload-Abbruch oder vollständiger Notebook-Löschung ist nicht Teil der Demo-Abnahme. Datenbankobjekte werden weiterhin gelöscht; die Quelllöschung nach FR-031 entfernt weiterhin ihre Datei und Abschnitte.

**Grund**: Eine robuste transaktionale Bereinigung über Datenbank und Storage würde einen zusätzlichen Wiederholungs- und Reparaturmechanismus erfordern, der für den Interview-Demoablauf keinen sichtbaren Kernnutzen liefert.

**Auswirkung**: Private, nicht mehr referenzierte Objekte können bis zum Zurücksetzen des Demo-Projekts im Bucket verbleiben. Dieser Stand ist nicht produktionsreif.

**Rückweg**: Vor einer produktiven Nutzung werden ein idempotenter Storage-Cleanup und ein Integrationstest für Notebook-Löschung ergänzt.
