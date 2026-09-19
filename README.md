# Notebook Source QA

Quellengebundenes Notebook-Frage-Antwort-System als Next.js-App mit Supabase.
Der freigegebene Umfang und der vollständige Prüfweg stehen unter
[`specs/001-notebook-source-qa/`](specs/001-notebook-source-qa/).

## Voraussetzungen

- Node.js 22 LTS (`.nvmrc`; auf diesem Rechner: `/opt/homebrew/opt/node@22/bin/node`)
- pnpm 11.x
- Docker
- Supabase CLI

## Lokales Setup

```bash
pnpm install
supabase start
cp .env.example .env.local
pnpm db:reset
pnpm dev
```

`supabase status -o env` liefert URL und lokale Schlüssel. In `.env.local`
gehören zusätzlich getrennte Anthropic- und OpenAI-Schlüssel sowie ein
mindestens 32 Zeichen langes `JOB_TRIGGER_SECRET`. `.env.local` wird nie
versioniert.

## Lokale Datenbank und Cloud

Entwicklung und Tests verwenden ausschließlich die lokale Supabase-Instanz.
`pnpm db:reset` ruft ohne Remote-Option `supabase db reset` auf und leert nur
diese lokale Instanz.

Die Cloud ist ausschließlich Veröffentlichungsziel:

```bash
supabase link --project-ref <projekt-kennung>
supabase db push
```

`supabase db reset --linked` oder andere Reset-Befehle gegen das verknüpfte
Projekt sind verboten. Kein Projekt-Skript enthält eine Remote-Reset-Option.

## Start und Prüfung

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm db:reset
```

`test:integration` führt vor den Tests einmal `supabase db reset --local` aus.
Der Reset-Lock hält parallele Integrationsläufe bis zum jeweiligen Suite-Ende
zurück. Die lokale Supabase-Instanz, Docker CLI und `.env.local` bleiben
Voraussetzungen; die ACL-Prüfung leitet den Datenbankcontainer aus
`supabase/config.toml` ab. `test:e2e` startet den lokalen Next.js-Webserver
selbst.

Die folgenden Läufe sind Berichte und keine Freigabetore:

```bash
pnpm eval
pnpm calibrate:retrieval
pnpm perf
```
