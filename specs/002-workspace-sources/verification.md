# Verifikation: Phase 2

## Ausgangsfehler vor der Implementierung

`tests/integration/workspace-access.test.ts` wurde vor T006 mit Node 22 und
lokalen Supabase-Umgebungswerten ausgeführt. Der Lauf scheiterte erwartbar bei
der Modulladung: `@/lib/notebooks/workspace-service` existierte noch nicht.
Damit deckt die Suite die neue Service-Grenze vor ihrer Implementierung ab.

## Ausgeführt

```text
SUPABASE_TELEMETRY_ENABLED=false pnpm db:reset
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/workspace-schema-access.test.ts tests/integration/workspace-access.test.ts
pnpm typecheck
pnpm lint
```

## Ergebnis

- Der lokale Reset wendet `202609200001_initial_schema.sql` und
  `202609200002_workspace_sources.sql` erfolgreich an.
- Beide neuen Integrationsdateien bestehen mit 6 Tests.
- Typprüfung und Biome bestehen.

## Grenzen dieser Phase

- Die Services liefern nur eigentümergebundene Datenbasis und Notizpersistenz.
- Vollständiger Quelltext, Webimport, Orientierungs-Generierung sowie Studio-UI
  folgen in den jeweiligen Story-Phasen.

## Phase 5.1: Orientierungsqualität und Providerwahl

```text
pnpm test -- source-orientation.test.ts retrieval.test.ts chat-provider.test.ts
pnpm typecheck
pnpm lint
pnpm exec playwright test tests/e2e/workspace-orientation.spec.ts --workers=1
```

- Die fokussierten Unit-Suiten bestehen mit 34 Tests; Typprüfung und Biome bestehen.
- Der Chromium-Erstuploadtest besteht auf isoliertem Port mit lokaler Ingestion.
- Ein echter UI-Lauf mit `Mitgliedantrag.pdf`, `NOTEBOOK_CHAT_PROVIDER=openai`
  und `gpt-4.1-mini` erzeugte fünf KI-Fragen sowie eine 794 Zeichen lange,
  belegte Orientierung. Die Folgefrage „Kosten der Mitgliedschaft“ erhielt
  eine Antwort mit den Beitragswerten 90 € und 180 €.
- Die native PDF-Extraktion lieferte auf den drei Seiten Text; die erste Seite
  enthält die Beitragswerte. Der Parser verwendet dafür PDF.js, keine externe
  Modellübertragung. Anthropic oder OpenAI steuern Chat, Zusammenfassung und
  Fragen. OpenAI bleibt für Einbettungen und Websuche erforderlich, weil
  Anthropic keine Embedding-API anbietet.
