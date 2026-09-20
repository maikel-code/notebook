# Implementation Plan: Quellenarbeitsbereich und Studio-Notizen

**Branch**: `codex/002-workspace-sources` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

## Summary

Das bestehende Notebook wird zu einem dreispaltigen Arbeitsbereich erweitert. Eine bereitgestellte erste Quelle erhält eine einmalige, zitierbare Orientierung; Quellen lassen sich als vollständiger extrahierter Text lesen. Eine serverseitige Suche liefert öffentliche Webtreffer, die erst nach Bestätigung abgerufen und als reguläre Quellen verarbeitet werden. Vollständige, geprüfte Antworten lassen sich als unveränderliche Studio-Notizen sichern.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22, React 19, Next.js 16

**Primary Dependencies**: Bestehende Supabase-Clients, Zod, Vercel AI SDK, Anthropic für geprüfte Antworten, OpenAI für Einbettungen und Websuchzugriff; eine kleine HTML-Extraktionsbibliothek für bestätigte Webquellen.

**Storage**: Lokales Supabase/PostgreSQL mit privatem PDF-Storage; Webquelltexte, Metadaten, Orientierungen und Studio-Notizen in PostgreSQL.

**Testing**: Vitest Unit- und Supabase-Integrationstests, Playwright ausschließlich Chromium, Biome, TypeScript-Prüfung und frischer lokaler Datenbankreset.

**Target Platform**: Angemeldete Browser-Benutzer; Desktop-Demo mit responsiv zusammenklappenden Bereichen.

**Project Type**: Bestehende Next.js-Webanwendung mit serverseitigen Actions und Routen.

**Performance Goals**: Erste Quellenorientierung im dokumentierten Demo-Lauf nach erfolgreicher Verarbeitung; Websuche zeigt innerhalb von 8 Sekunden Treffer oder Zustand; gespeicherte Studio-Notiz erscheint ohne Seitenwechsel.

**Constraints**: Bestehende 10-MB-/50-Seiten-PDF- und 30-Quellen-Grenzen bleiben. Eine Websuche liefert höchstens zehn Treffer; bestätigte Webseiten werden mit maximal 1 MB Textantwort, höchstens drei Weiterleitungen und 10 Sekunden Laufzeit abgerufen. Es gibt keinen clientseitigen Anbieterzugriff, keine automatische Übernahme, keine privaten oder lokalen Zieladressen und keine Inhalts- oder Geheimnisprotokollierung.

**Scale/Scope**: Einzelbenutzer-Demo, ein bestehender privater Arbeitsbereich pro Notebook, keine Notizbearbeitung, Freigabe oder Export.

## Constitution Check

| Gate | Vor dem Design | Nach dem Design |
|------|----------------|-----------------|
| Zugriff | Neue geschützte Pfade benötigen Eigentümer-/Fremd-/Anonymtests. | Erweiterte Zugriffsmatrix und RLS für Studio-Notizen, serverseitige Such- und Importautorisation vorgesehen. |
| Quellenbindung | Orientierung, Webtext und Notizverweise dürfen die Belegregeln nicht umgehen. | Orientierung verwendet die vorhandene Claim-Prüfung; Webtext wird in reguläre Chunks überführt; Notiz verwendet unveränderliche Antwort- und Verweis-Schnappschüsse. |
| Vollständiger Ablauf | Neue Lade-, Leer-, Erfolgs- und Fehlerzustände sowie Tastaturbedienung erforderlich. | Drei Bereiche, Auswahl-/Vorschau-/Importzustände und Dialogfokus werden als eigene UI- und E2E-Aufgaben geplant. |
| Einfache Architektur | Kein zusätzlicher Suchdienst oder clientseitiges Geheimnis ohne Nutzen. | Der vorhandene serverseitige OpenAI-Zugang wird für höchstens zehn Ergebnisse genutzt; HTML wird erst nach Bestätigung serverseitig abgerufen. |
| Reproduzierbarkeit | Schema, Limits, Tests und Diagnose müssen dokumentiert sein. | Additive Migration, feste Limits, Tests mit gemockter Suche und Chromium-E2E sowie `db:reset` sind vorgesehen. |

**Gate result**: PASS. Keine Ausnahme erforderlich.

## Project Structure

### Documentation (this feature)

```text
specs/002-workspace-sources/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── workspace-http.md
└── tasks.md
```

### Source Code (repository root)

```text
app/notebooks/[notebookId]/page.tsx
app/notebooks/actions.ts
app/api/web/search/route.ts
components/notebook/{workspace,source-list,source-detail,source-search,chat-thread,studio-notes}.tsx
lib/{ingestion,rag,web,studio}/
supabase/migrations/202609200002_workspace_sources.sql
tests/{unit,integration,e2e}/
```

**Structure Decision**: Das vorhandene App-/Komponenten-/Lib-Muster bleibt bestehen. Domänenlogik für öffentliche Webseiten und Notizen bleibt serverseitig unter `lib/`; die Notebook-Seite lädt einen autorisierten Gesamt-Snapshot und komponiert daraus die drei Bereiche.

## Verification Gates

Vor Abschluss jeder Implementierungsphase laufen mindestens die für ihre Änderungen relevanten Tests. Vor Review und Übergabe laufen ohne Reduzierung:

```text
SUPABASE_TELEMETRY_ENABLED=false pnpm db:reset
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm build
pnpm exec playwright test --project=chromium --workers=1
```

Die Erweiterung der Zugriffsmatrix prüft Quellendetail, Suche, Vorschau, Webimport, Notiz speichern, Liste und Detail jeweils als Eigentümer, fremdes Konto und anonym. Ausgelieferte Websuche wird zusätzlich mit einem kontrollierten Suchadapter, einer privaten Zieladresse, einer Weiterleitung und einem teilweisen Sammelimport geprüft.

## Complexity Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| Einheitliche `sources` für PDF und Web | Retrieval, Auswahl und Verweise benötigen eine gemeinsame Quelle. | Eine parallele Webquellen-Pipeline würde Auswahl, Chunks und Belege duplizieren. |
| Einmalige Orientierung als spezieller Assistant-Beitrag | Sie muss wie Chat und Verweise dauerhaft und prüfbar sein. | Ein ungespeicherter UI-Text wäre nach Neuladen nicht reproduzierbar und könnte die Belegprüfung umgehen. |
