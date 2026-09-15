# Implementation Plan: Quellengebundenes Notebook-Frage-Antwort-System

**Branch**: `001-notebook-source-qa` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-notebook-source-qa/spec.md`

## Summary

Eine Next.js-Anwendung, in der angemeldete Benutzer private Notebooks anlegen, textbasierte PDFs hochladen und Fragen dazu stellen. Antworten werden aus den ausgewählten Quellen erzeugt und tragen Verweise, die zur Originalstelle mit Seitenbezug führen.

Der technische Kern besteht aus vier Teilen: **Supabase** als Datenbank, Authentifizierung und Dateiablage mit durchgängiger Row-Level-Security; eine **Aufnahmestrecke**, die PDFs seitenweise in Textabschnitte zerlegt und einbettet; eine **Abrufstrecke**, die zur Frage passende Abschnitte über Vektorähnlichkeit sucht; und eine **Belegprüfung**, die jedes vom Modell gelieferte Zitat wörtlich gegen den zitierten Abschnitt abgleicht, bevor es als Verweis erscheint. Der letzte Schritt macht FR-030 maschinell prüfbar statt zur Frage des Vertrauens.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22 LTS (gepinnt über `.nvmrc` und `engines`; lokal installiert ist v25.4.0 — siehe research.md D-12)

**Primary Dependencies**: Next.js (App Router), React, Tailwind CSS v4, Komponenten von neobrutalism.com (über shadcn-CLI ins Repo kopiert, Primitive von Radix UI / Base UI / React Aria), Supabase JS Client, Vercel AI SDK, pdf.js für Textextraktion und Anzeige, Zod

**Storage**: Supabase Postgres mit `pgvector` für Einbettungen; Supabase Storage (privater Bucket) für die PDF-Dateien. Gehostetes Cloud-Projekt für Entwicklung und Vorführung, eigene lokale Instanz für die Prüfläufe (D-14).

**Testing**: Vitest für reine Logik, Playwright für Abläufe im Browser, ein eigener Integrationslauf für Zugriffsgrenzen gegen eine lokale Supabase-Instanz, ein getrennter Bewertungslauf für Antwortqualität

**Target Platform**: Browser (aktuelle Chromium-, Firefox- und WebKit-Versionen); Serverteil als Next.js-Anwendung

**Project Type**: Web-Anwendung, ein Next.js-Projekt mit Server- und Clientanteil im selben Repository

**Performance Goals**: Erster Teil einer Antwort binnen 3 Sekunden sichtbar (SC-011); Dokument mit bis zu 50 Seiten binnen 60 Sekunden bereit (SC-012)

**Constraints**: Grenzwerte aus spec.md (25 MB und 300 Seiten je PDF, 50 Quellen je Notebook, 10 ausgewählte Quellen je Frage, 2.000 Zeichen Fragelänge, 60.000 Zeichen herangezogene Textmenge je Antwort, 3 automatische Wiederholungen, 5 Minuten Laufzeit je Verarbeitungsauftrag)

**Scale/Scope**: Demonstrationsumgebung mit einzelnen Benutzern (A-09); sechs User Stories, 41 funktionale Anforderungen, rund 12 Oberflächen

## Constitution Check

*GATE: Muss vor Phase 0 bestehen. Nach Phase 1 erneut geprüft.*

| Prinzip | Bewertung | Wie der Plan es einlöst |
|---|---|---|
| I Technische Verantwortung | bestanden | Jede Architekturentscheidung steht in research.md mit Begründung und verworfener Alternative. Prüfkommandos siehe unten. |
| II Sichere Zugriffsgrenzen | bestanden | RLS auf jeder Tabelle, privater Storage-Bucket mit pfadgebundener Regel, Abruf ausschließlich über RLS-gebundene Verbindungen. Der Hintergrundlauf nutzt erhöhte Rechte und MUSS jede Abfrage zusätzlich auf den Eigentümer des Auftrags einschränken (research.md D-10). |
| III Quellengebundene Antworten | bestanden | Zitatprüfung vor Anzeige (D-07), Dokumenttext in abgegrenzten Blöcken als Daten (D-09), Abruf immer auf die ausgewählten Quellen des Benutzers beschränkt. |
| IV Einfache Architektur | bestanden mit Anmerkung | Ein Next.js-Projekt, eine Datenbank, keine zusätzliche Laufzeit. Drei Abhängigkeiten über den Rahmen hinaus sind in research.md einzeln begründet. Der Hintergrundlauf hat drei Auslöser — begründet unter Complexity Tracking. |
| V Vollständige Nutzerabläufe | bestanden | Zustände je Ablauf in data-model.md als Zustandsmaschine; Barrierefreiheit über die Primitive der Komponentenbibliothek, Prüfung in Playwright. |
| VI Verifikation | bestanden | Deterministische und probabilistische Prüfungen sind getrennte Kommandos. Der Bewertungslauf ist **kein** Freigabetor. |
| VII Reproduzierbarkeit | bestanden | Node-Version gepinnt, Migrationen versioniert, Grenzwerte zentral, Wiederholbarkeit über einen stabilen Schlüssel (D-05). |
| VIII Zusammenarbeit | bestanden | Entscheidungen in research.md, Verträge in contracts/, Prüfweg in quickstart.md. |

**Gate 3 Vorbedingung**: Die Prüfkommandos sind unten festgelegt. Damit ist die Bedingung aus der Constitution erfüllt, dass sie **vor** Implementierungsbeginn feststehen und vom implementierenden Agenten nicht eigenständig verkleinert werden dürfen.

## Verification Commands

Verbindlich für Gate 3. Codex führt diese Kommandos aus und weist ihr Ergebnis im Handoff nach.

| Zweck | Kommando | Tor |
|---|---|---|
| Typprüfung | `pnpm typecheck` | Gate 3 |
| Linting und Format | `pnpm lint` | Gate 3 |
| Reine Logik | `pnpm test` | Gate 3 |
| Zugriffsgrenzen und Aufnahmestrecke | `pnpm test:integration` | Gate 3 und Gate 4 |
| Abläufe im Browser | `pnpm test:e2e` | Gate 3 |
| Migrationen auf frischer Datenbank | `pnpm db:reset` (**lokale Instanz**, nie gegen die Cloud) | Gate 3 |
| Antwortqualität am Referenzdatensatz | `pnpm eval` | **kein Tor** — probabilistisch, Ergebnis wird berichtet, nicht bestanden |

Regeln dazu:

- `pnpm eval` DARF NICHT als Nachweis für Gate 3 herangezogen werden (Prinzip VI: getrennte Ausweisung).
- Schlägt ein Gate-Kommando fehl, wird die Ursache behoben. Der Prüfumfang wird nicht verkleinert und kein Test übersprungen (Prinzip I).
- `pnpm test:integration` setzt eine laufende lokale Supabase-Instanz voraus (siehe quickstart.md).

## Project Structure

### Documentation (this feature)

```text
specs/001-notebook-source-qa/
├── plan.md              # Diese Datei
├── research.md          # Phase 0 — Entscheidungen mit Begründung
├── data-model.md        # Phase 1 — Tabellen, Zustände, Zugriffsregeln
├── quickstart.md        # Phase 1 — Einrichtung und Prüfweg
├── contracts/           # Phase 1 — Schnittstellenverträge
│   ├── http-api.md
│   ├── ingestion-job.md
│   └── answer-and-citations.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — erzeugt von /speckit-tasks
```

### Source Code (repository root)

```text
app/
├── (auth)/
│   ├── sign-in/page.tsx
│   └── sign-up/page.tsx
├── notebooks/
│   ├── page.tsx                      # Übersicht mit Leerzustand
│   └── [notebookId]/
│       ├── page.tsx                  # Quellenliste, Chat, Belegansicht
│       └── sources/[sourceId]/page.tsx
├── api/
│   ├── chat/route.ts                 # Antwort im Strom
│   ├── jobs/run/route.ts             # Arbeitsschritt eines Verarbeitungsauftrags
│   └── jobs/sweep/route.ts           # Wiederaufnahme hängender Aufträge
└── layout.tsx

components/
├── ui/                               # von neobrutalism.com kopiert
└── notebook/                         # Quellenliste, Chatverlauf, Belegansicht

lib/
├── supabase/                         # Verbindungen: Server, Browser, erhöhte Rechte
├── ingestion/                        # Textextraktion, Zerlegung, Einbettung
├── rag/                              # Abruf, Aufforderungstext, Zitatprüfung
└── limits.ts                         # Grenzwerte aus spec.md an einer Stelle

supabase/
└── migrations/                       # versionierte Schemaänderungen inklusive Zugriffsregeln

tests/
├── unit/                             # Vitest
├── integration/                      # Zugriffsgrenzen, Aufnahmestrecke
└── e2e/                              # Playwright

eval/
├── dataset/                          # Referenzdatensatz, versioniert
└── run.ts                            # Bewertungslauf
```

**Structure Decision**: Ein einzelnes Next.js-Projekt im Repository-Wurzelverzeichnis. Eine Trennung in getrennte Frontend- und Backend-Verzeichnisse wäre künstlich, weil Next.js beide Seiten trägt und die Typen geteilt werden. Die Trennlinien verlaufen stattdessen innerhalb von `lib/`: Aufnahme, Abruf und Datenzugriff sind eigenständige Bereiche und ohne Oberfläche prüfbar. `eval/` liegt bewusst außerhalb von `tests/`, damit die probabilistische Bewertung nicht versehentlich in einen Gate-Lauf gerät.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Drei Auslöser für den Verarbeitungsauftrag (nach Upload, wiederholender Aufruf, manueller Wiederholversuch) statt eines | FR-011 verlangt sichtbaren Fortschritt, FR-012 einen manuellen Wiederholversuch, FR-037 begrenzte automatische Wiederholungen mit sichtbarem Fehlerzustand. Ein einziger Auslöser erfüllt höchstens zwei davon. | Nur der Aufruf nach dem Upload lässt einen abgestürzten Lauf dauerhaft im Zustand „wird verarbeitet" stehen — der Benutzer sieht nie einen Fehler und kann nichts wiederholen. Damit fällt FR-037. |
| Eigene Tabelle für Verarbeitungsaufträge neben der Quellentabelle | Versuchszähler, Phase und Fehlerursache gehören zum Lauf, nicht zum Dokument. FR-014 verlangt Wiederholung ohne Duplikate, das braucht einen Lauf mit eigenem Schlüssel. | Zustandsfelder direkt auf der Quelle vermischen Dokument und Lauf; ein zweiter Versuch überschreibt die Vorgeschichte, und FR-038 verliert seine Datengrundlage. |
| Zitatprüfung als eigener Schritt nach der Antworterzeugung | FR-030 verlangt, dass die verwiesene Passage die Aussage stützt. Ohne mechanische Prüfung bleibt das eine Behauptung des Modells über sich selbst. | Dem Modell zu vertrauen ist die einfachere Variante und genau die, die FR-030 ausschließt. |

## Constitution Re-Check nach Phase 1

Erneut geprüft gegen den fertigen Entwurf. Kein Prinzip ist im Entwurf verletzt worden; drei Stellen haben sich verschärft statt gelockert.

| Prüfpunkt | Befund |
|---|---|
| Prinzip II — Zugriffsgrenzen | Der Entwurf hat eine Grenze **hinzugewonnen**: `/api/jobs/run` und `/api/jobs/sweep` sind von außen erreichbar und daher durch ein serverseitiges Geheimnis geschützt. Damit ist die Zahl der Stellen mit erhöhten Rechten auf eine Datei begrenzt (D-10). |
| Prinzip III — Belege | Die Zitatprüfung aus D-07 ist im Entwurf nicht nur beschrieben, sondern als fail-closed festgelegt: jeder Zweifelsfall verwirft den Verweis. Das ist strenger als die Anforderung und bewusst so. |
| Prinzip IV — Einfachheit | Der Entwurf fügt gegenüber Phase 0 keine Abhängigkeit hinzu. Die Aufteilung in Server Actions und Route Handlers senkt die Zahl eigener Endpunkte auf vier. |
| Prinzip VI — Verifikation | `pnpm eval` ist an drei Stellen ausdrücklich als Nicht-Tor markiert (plan.md, quickstart.md, research.md D-16). Die Trennung ist damit schwer versehentlich aufzuheben. |
| Prinzip VII — Reproduzierbarkeit | Zwei Abweichungen der Arbeitsumgebung sind benannt statt übergangen: Node v25 statt 22 LTS, fehlende Supabase-Befehlszeile. Beide stehen in quickstart.md als zu erledigen. |

**Am 2026-09-15 vom Maintainer entschieden**: D-04 — Antworten über Anthropic Claude, Einbettungen über OpenAI; beide Konten liegen vor. D-14 — Supabase als Cloud-Projekt, Anwendung vorerst lokal, Prüfläufe gegen eine eigene lokale Instanz. Aus D-14 folgt eine Vereinfachung: der Zeitplandienst auf Datenbankseite entfällt, weil die Cloud die lokale Anwendung nicht erreichen kann.
