# Data Model: Quellenarbeitsbereich und Studio-Notizen

## Existing entity extensions

### Source

Eine Quelle bleibt die gemeinsame Retrieval- und Auswahlgrenze. Sie erhält `source_kind` (`pdf` oder `web`), optionalen `origin_url` und `canonical_url` sowie die Textumfangsangabe. Die Detailansicht leitet ihren neutralen Überblick aus gespeicherten Metadaten und einer begrenzten Textvorschau ab; sie erzeugt keine zusätzliche unbelegte Behauptung. PDFs behalten privaten Storage-Pfad, Dateihash, Bytegröße und Seitenzahl. Webquellen haben keinen Storage-Pfad; ihr Hash bezieht sich auf die gespeicherte Textfassung, ihre Seitenangabe ist `1`.

**Validation**:

- PDF: gültiger bestehender Storage-Pfad, keine URL, 1–50 Seiten, maximal 10 MB.
- Web: HTTPS-Original- und kanonische Adresse, kein Storage-Pfad, lesbarer Text, maximal 1 MB Antwortgröße, eine logische Seite.
- Pro Notebook höchstens eine Webquelle je kanonischer Adresse.
- Nur `ready` wird für Antworten ausgewählt.

### Ingestion job

Der bestehende Auftrag erhält für Webquellen die Phase `fetch` vor `extract`, `chunk`, `embed`, `finalize`. PDF-Aufträge behalten ihren bisherigen Ablauf. Wiederholung, Besitzkontext, Korrelation und Endzustand bleiben unverändert.

### Message

Assistant-Nachrichten erhalten einen unterscheidbaren Beitragszweck: `answer` oder `source_orientation`. Eine Orientierung gehört zu genau einer Quelle, ist nur möglich, wenn es noch keinen Verlauf gab, und speichert drei bis fünf vorgeschlagene Fragen. Ihre Zitate verwenden den bestehenden Zitatdatensatz.

## New entities

### Studio note

| Field | Rule |
|-------|------|
| id | Primärkennung |
| notebook_id, user_id | Eigentumsgebundene Notebook-Beziehung |
| message_id | Genau eine vollständige Assistant-Antwort, einmalig je Notiz |
| title | Nicht leerer, begrenzter Titel aus der beantworteten Frage |
| content_snapshot | Nicht leerer Antwort-Schnappschuss |
| created_at | Erstellzeitpunkt |

Die Notiz ist unveränderlich. Antwort, Notebook oder Benutzerlöschung löscht sie kaskadierend. Die vorhandenen Zitate bewahren Wortlaut und überdauern Quellenlöschung.

### Web search result

Kurzlebiges, nicht gespeichertes Serverantwortmodell: `title`, `domain`, `description`, `url`. Es ist erst nach der bestätigten Übernahme eine Quelle und besitzt keine Retrieval- oder Zugriffsrechte.

## Relationships

```text
Notebook 1 ── * Source 1 ── * Chunk
Notebook 1 ── * Message 1 ── * Citation
Source 1 ── 0..1 source-orientation Message
Notebook 1 ── * StudioNote * ── 1 complete assistant Message
```

## State transitions

```text
Web source: confirmed → processing → ready | unusable | failed
PDF source: existing upload flow remains unchanged
Orientation: absent → complete | invalid | failed
Studio note: absent → saved (idempotent) → deleted only with parent
```
