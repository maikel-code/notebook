# Vertrag — Server-Schnittstellen

**Feature**: 001-notebook-source-qa · **Datum**: 2026-09-14

Zwei Arten von Schnittstellen. **Server Actions** für alles, was ein Formular auslöst — typisiert, ohne eigenen Endpunkt. **Route Handlers** nur dort, wo ein Datenstrom oder ein Aufruf von außen nötig ist. Weniger Endpunkte heißt weniger Stellen, an denen die Zugriffsprüfung fehlen kann (Prinzip IV und II).

## Gemeinsame Regeln

- Jede Schnittstelle ermittelt den Benutzer serverseitig aus der Sitzung. Eine Benutzerkennung aus dem Anfragekörper wird **nie** ausgewertet.
- Zugriff auf fremde oder nicht vorhandene Objekte liefert **denselben** Fehler: `404` mit unspezifischer Meldung. Kein Unterschied zwischen „gibt es nicht" und „gehört dir nicht" (FR-004).
- Ohne Sitzung: `401`, keine Inhalte (FR-005).
- Grenzwertverletzung: `422` mit Nennung der verletzten Bedingung (FR-010).
- Fehlermeldungen enthalten niemals Dokumentinhalt, Zugangsdaten oder personenbezogene Daten (FR-038).

## Server Actions

| Aktion | Eingabe | Ergebnis | Anforderung |
|---|---|---|---|
| `createNotebook` | `name` | Notebook-Kennung | FR-006 |
| `renameNotebook` | `id`, `name` | — | FR-006 |
| `deleteNotebook` | `id` | — | FR-006, FR-007 |
| `prepareUpload` | `notebookId`, `fileName`, `contentHash`, `byteSize` | `{ decision, existingSourceId?, uploadTarget?, sourceId? }` | FR-009, FR-010, FR-010a |
| `confirmUpload` | `sourceId` | — legt Verarbeitungsauftrag an | FR-011 |
| `setSourceSelected` | `sourceId`, `selected` | — | FR-015 |
| `deleteSource` | `sourceId` | — | FR-016, FR-017, FR-031 |
| `retryIngestion` | `sourceId` | — neuer Auftrag, Zähler zurückgesetzt | FR-012 |

### `prepareUpload` — Dublettenerkennung

Wird **vor** dem Übertragen der Datei aufgerufen. Der Client berechnet die Prüfsumme des Dateiinhalts.

`decision` nimmt einen von drei Werten an:

| Wert | Bedeutung | Folge in der Oberfläche |
|---|---|---|
| `ok` | keine inhaltsgleiche Quelle im Notebook | Übertragung startet |
| `duplicate` | inhaltsgleiche Quelle vorhanden | Rückfrage: ersetzen, zusätzlich aufnehmen, abbrechen (FR-010a) |
| `rejected` | Grenzwert verletzt | Meldung mit der verletzten Bedingung, keine Übertragung |

Bei `duplicate` ruft die Oberfläche `prepareUpload` erneut mit `intent: 'replace' | 'add'` auf. `replace` entfernt die bisherige Quelle nach FR-031, bevor die neue angelegt wird.

## Route Handlers

### `POST /api/chat`

Erzeugt eine Antwort und liefert sie als Strom (FR-019, FR-020).

**Eingabe**: `notebookId`, `question`

**Ablauf**: Sitzung prüfen → ausgewählte Quellen im Zustand `ready` serverseitig ermitteln → passende Abschnitte suchen → Antwort erzeugen → Belege nach [answer-and-citations.md](./answer-and-citations.md) prüfen → Nachricht und Verweise speichern.

**Vorbedingungen mit eigener Antwort** — in diesen Fällen entsteht **keine** Antwort mit Verweisen (FR-022):

| Lage | Antwort |
|---|---|
| keine Quelle ausgewählt | Hinweis, dass mindestens eine Quelle ausgewählt sein muss |
| keine ausgewählte Quelle im Zustand `ready` | Hinweis auf die Voraussetzung |
| keine einschlägige Passage gefunden | Erklärung, dass die Quellen dazu nichts hergeben |
| Frage über 2.000 Zeichen | `422` mit Nennung der Grenze |

**Abbruch**: Bricht der Client die Verbindung ab, endet die Erzeugung und die Nachricht erhält den Zustand `aborted` (FR-020a). Fällt der Anbieter aus, wird `failed` gesetzt und ein erneuter Versuch angeboten (FR-025). In beiden Fällen bleibt die Teilantwort sichtbar, aber als unvollständig gekennzeichnet.

**Sperre**: Solange eine Nachricht des Notebooks im Zustand `streaming` ist, weist ein weiterer Aufruf mit `409` ab. Die Oberfläche sperrt die Eingabe bereits vorher; die Prüfung im Server ist die verbindliche (FR-020a).

### `GET /api/jobs/status`

**Eingabe**: `notebookId` · **Ergebnis**: je Quelle Zustand, Phase, Fehlerursache.

Wird von der Oberfläche in kurzen Abständen abgefragt, solange mindestens ein Auftrag offen ist, und danach nicht mehr (D-15, FR-011).

### `POST /api/jobs/run` und `POST /api/jobs/sweep`

Interne Endpunkte für die Verarbeitung. Vertrag siehe [ingestion-job.md](./ingestion-job.md).

**Zugang**: nur mit einem gemeinsamen Geheimnis im Kopf der Anfrage. Dieses Geheimnis wird ausschließlich serverseitig gelesen und erscheint **nie** im Browser-Bündel (Prinzip II). Ohne gültiges Geheimnis: `401`.

## Statuscodes

| Code | Bedeutung |
|---|---|
| `401` | keine gültige Sitzung, oder internes Geheimnis fehlt |
| `404` | Objekt nicht vorhanden **oder** nicht im eigenen Bestand |
| `409` | im Notebook läuft bereits eine Antwort |
| `422` | Grenzwert oder Eingabeprüfung verletzt |
| `502` | Modellanbieter nicht erreichbar |
