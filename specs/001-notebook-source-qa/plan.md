# Implementation Plan: Quellengebundenes Notebook-Frage-Antwort-System

**Branch**: `001-notebook-source-qa` | **Stand**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

## Summary

Next.js-Anwendung mit privaten Notebooks, PDF-Aufnahme und quellengebundenem Chat. Vier Teile: **Supabase** (Datenbank, Authentifizierung, Dateiablage, durchgängige RLS), eine **Aufnahmestrecke** mit zweiphasigem Quellenersatz, eine **Abrufstrecke** mit Top-8 und versioniert kalibriertem Mindestwert sowie eine **Belegprüfung** strukturierter Claim-Absätze. Fehlgeschlagene Antworten bleiben als Versuch erhalten; ein Retry hängt einen neuen Versuch an dieselbe Frage.

Die Belegprüfung ist der tragende Teil: Sie prüft Herkunft, Auswahl, Wortlaut und vollständige Claim-Struktur deterministisch. Scheitert eine Einheit, wird die gesamte Antwort durch eine feste Einschränkung ersetzt. Ob die Passage die zugeordnete Aussage inhaltlich stützt, bleibt eine getrennte Qualitätsmetrik des Referenzdatensatzes (research.md D-07, D-20).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22 LTS gepinnt (D-12)

**Primary Dependencies**: Next.js App Router, React, Tailwind CSS v4, Komponenten von neobrutalism.com (D-13), Supabase JS, Vercel AI SDK, pdf.js, Zod

**Storage**: Supabase Postgres mit `pgvector`, privater Storage-Bucket. Cloud-Projekt für Entwicklung und Vorführung, eigene lokale Instanz für Prüfläufe (D-14)

**Testing**: Vitest, Playwright, Integrationslauf für Zugriffsgrenzen, getrennter Bewertungslauf (D-16)

**Target Platform**: Browser (aktuelle Chromium-, Firefox-, WebKit-Versionen)

**Project Type**: Ein Next.js-Projekt mit Server- und Clientanteil

**Performance Goals**: SC-011 erster Antwortteil in mindestens vier von fünf dokumentierten Demo-Läufen ≤ 5 s; beobachtender Smoke-Wert, kein Freigabetor

**Constraints**: Grenzwerte aus spec.md zentral in `lib/limits.ts`; Abrufwert aus dem freigegebenen, fingerprint-gebundenen Kalibrierartefakt (D-17)

**Scale/Scope**: Demonstrationsumgebung, einzelne Benutzer (A-09)

## Constitution Check

*Gate vor Phase 0, nach Phase 1 erneut geprüft — kein Prinzip verletzt.*

| Prinzip | Einlösung |
|---|---|
| I Technische Verantwortung | Entscheidungen mit Alternative in research.md; Prüfkommandos unten |
| II Sichere Zugriffsgrenzen | Feste Demo-Matrix für Notebook-Seite plus `renameNotebook`, Storage-Download, Chat und Status; interne Jobs mit Geheimnisprüfung und Cross-User-Worker-Test; Dienstrolle auf den Auftragseigentümer eingeschränkt (D-10) |
| III Quellengebundene Antworten | Claim-Einheiten vollständig fail-closed geprüft und bei einem Fehler insgesamt verworfen (D-07, D-20); semantische Belegtreue separat berichtet, Dokumenttext als Daten (D-09), Abruf auf ausgewählte Quellen begrenzt |
| IV Einfache Architektur | Ein Projekt, eine Datenbank, keine zusätzliche Laufzeit. Drei Abhängigkeiten in research.md begründet; drei Auslöser des Verarbeitungsauftrags unter Complexity Tracking |
| V Vollständige Nutzerabläufe | Zustände als Zustandsmaschinen in data-model.md; Upload-Abbruch lässt die alte Quelle bestehen, Retry zeigt alle Versuche; Barrierefreiheit über die Primitive, geprüft in Playwright |
| VI Verifikation | Deterministische Grenz-, Claim- und Zitatprüfungen sind von Kalibrierung und Qualitätsbewertung getrennt; beide externen Läufe sind kein Tor |
| VII Reproduzierbarkeit | Node gepinnt, Migrationen versioniert, Grenzwerte zentral, Abrufkonfiguration mit Fingerprints versioniert, Aufnahme und Quellenersatz idempotent (D-06, D-17, D-18) |
| VIII Zusammenarbeit | Entscheidungen in research.md, Verträge in contracts/, Prüfweg in quickstart.md |

**Nach Phase 1 erneut geprüft**: Der Entwurf ergänzt keine Abhängigkeit und keinen öffentlichen Endpunkt. Retry nutzt `/api/chat`, Quellenersatz bestehende Server Actions; beide laufen über denselben zentralen Autorisierungsweg. Die neue `cleanup`-Phase nutzt den vorhandenen Auftrags- und Wiederholungsmechanismus. Kalibrierung bleibt ausdrücklich außerhalb des Gates, ihr freigegebenes Ergebnis wird zur festen, deterministisch geprüften Laufzeitkonfiguration. Die Abweichungen Node v25 statt 22 LTS und zwei getrennte Supabase-Instanzen sind in quickstart.md benannt.

## Verification Commands

Verbindlich für Gate 3. Codex führt sie aus und weist das Ergebnis im Handoff nach.

| Zweck | Kommando | Tor |
|---|---|---|
| Typprüfung | `pnpm typecheck` | Gate 3 |
| Linting und Format | `pnpm lint` | Gate 3 |
| Reine Logik einschließlich Abrufgrenze und Claim-Gesamtverwerfung | `pnpm test` | Gate 3 |
| Zugriffsgrenzen, Aufnahme, Quellenersatz und Retry-Persistenz | `pnpm test:integration` | Gate 3 + Gate 4 |
| Abläufe einschließlich Retry-Historie | `pnpm test:e2e` | Gate 3 |
| Migrationen auf frischer Datenbank | `pnpm db:reset` (lokale Instanz) | Gate 3 |
| Antwortqualität | `pnpm eval` | **kein Tor** — probabilistisch |
| Abruf neu kalibrieren | `pnpm calibrate:retrieval` | **kein Tor** — Ergebnis braucht Maintainer-Freigabe |
| Antwortlatenz | `pnpm perf` | **kein Tor** — beobachtender Demo-Smoke-Test |

- `pnpm eval` DARF NICHT als Nachweis für Gate 3 dienen (Prinzip VI).
- `pnpm calibrate:retrieval` DARF den Laufzeitwert nicht automatisch freigeben; Gate-Tests verwenden nur das versionierte Artefakt (D-17).
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
├── ingestion/              # Upload-Ersatz, Cleanup, Extraktion, Zerlegung, Einbettung
├── rag/                    # Abrufkonfiguration, Claim-Erzeugung und Gesamtprüfung
└── limits.ts               # Grenzwerte an einer Stelle

supabase/migrations/        # Schema inklusive Zugriffsregeln
tests/{unit,integration,e2e}/
eval/
├── dataset/{documents,questions,retrieval-calibration.json}
├── calibrate-retrieval.ts
└── run.ts                  # Qualitätsbewertung, bewusst außerhalb tests/
```

**Structure Decision**: Ein Next.js-Projekt im Wurzelverzeichnis. Getrennte Frontend- und Backend-Verzeichnisse wären künstlich, weil Next.js beide Seiten trägt und Typen geteilt werden. Die Trennlinien verlaufen in `lib/`: Aufnahme, Abruf und Datenzugriff sind ohne Oberfläche prüfbar. `eval/` liegt außerhalb `tests/`, damit die probabilistische Bewertung nicht in einen Gate-Lauf gerät.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Drei Auslöser des Verarbeitungsauftrags statt eines | FR-011 sichtbarer Fortschritt, FR-012 manueller Wiederholversuch, FR-037 begrenzte automatische Wiederholung mit sichtbarem Fehlerzustand | Nur der Aufruf nach dem Upload lässt einen abgestürzten Lauf dauerhaft auf `processing` stehen — der Benutzer sieht nie einen Fehler. FR-037 fällt damit |
| Eigene Tabelle für Verarbeitungsaufträge | Versuchszähler, Phase und Ursache gehören zum Lauf, nicht zum Dokument; FR-014 braucht einen Lauf mit eigenem Schlüssel | Zustandsfelder auf der Quelle vermischen Dokument und Lauf; ein zweiter Versuch überschreibt die Vorgeschichte und FR-038 verliert die Datengrundlage |
| Zitatprüfung als eigener Schritt | FR-030 verlangt eine deterministisch prüfbare Herkunft und einen wörtlich vorhandenen Auszug | Nur der Modellmarke zu vertrauen würde Herkunft und Wortlaut ungeprüft lassen; die semantische Belegtreue wird separat berichtet |
| Persistenter Ersatz-Entwurf und `cleanup`-Phase | FR-010a verlangt, dass die alte Quelle einen Upload-Abbruch unverändert übersteht; Storage und Datenbank haben keine gemeinsame Transaktion | Löschen vor Upload verletzt FR-010a; eine weitere Ablauf-Tabelle wäre komplexer als zwei Felder auf `sources` und die vorhandene Auftragsmaschine |
| Mehrere Assistant-Versuche je Frage | FR-025 verlangt sichtbaren fehlgeschlagenen Versuch und einen angehängten Retry | Überschreiben verliert die Historie; duplizierte Benutzerfragen verfälschen den Gesprächsverlauf |

## Demo-Ausnahme: Storage-Bereinigung

**Entscheidung des Maintainers vom 2026-09-19**: Die physische Bereinigung möglicher verwaister Storage-Objekte nach Upload-Abbruch oder vollständiger Notebook-Löschung ist nicht Teil der Demo-Abnahme. Datenbankobjekte werden weiterhin gelöscht; die Quelllöschung nach FR-031 entfernt weiterhin ihre Datei und Abschnitte.

**Grund**: Eine robuste transaktionale Bereinigung über Datenbank und Storage würde einen zusätzlichen Wiederholungs- und Reparaturmechanismus erfordern, der für den Interview-Demoablauf keinen sichtbaren Kernnutzen liefert.

**Auswirkung**: Private, nicht mehr referenzierte Objekte können bis zum Zurücksetzen des Demo-Projekts im Bucket verbleiben. Dieser Stand ist nicht produktionsreif.

**Rückweg**: Vor einer produktiven Nutzung werden ein idempotenter Storage-Cleanup und ein Integrationstest für Notebook-Löschung ergänzt.
