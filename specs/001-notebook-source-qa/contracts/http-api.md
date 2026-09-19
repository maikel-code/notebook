# Vertrag — Server-Schnittstellen

**Feature**: 001-notebook-source-qa · **Datum**: 2026-09-19

Zwei Arten von Schnittstellen. **Server Actions** für alles, was ein Formular auslöst — typisiert, ohne eigenen Endpunkt. **Route Handlers** nur dort, wo ein Datenstrom oder ein Aufruf von außen nötig ist. Weniger Endpunkte heißt weniger Stellen, an denen die Zugriffsprüfung fehlen kann (Prinzip IV und II).

## Gemeinsame Regeln

- Jede Schnittstelle ermittelt den Benutzer serverseitig aus der Sitzung. Eine Benutzerkennung aus dem Anfragekörper wird **nie** ausgewertet.
- Benutzer- und anonyme Clients dürfen auf keine der sechs Anwendungstabellen direkt zugreifen. Jeder Datenbankzugriff nutzt den ausschließlich serverseitigen Service-Client erst nach zentraler Sitzungs- und Eigentümerprüfung, bei Mutationen zusätzlich nach Elternprüfung. Im privaten Storage-Bucket darf der authentifizierte Browser-Client unter Storage-RLS ausschließlich PDF-Objekte bis einschließlich 10.485.760 Bytes im eigenen `{user_id}/…`-Präfix neu anlegen und lesen; direkte Updates und Löschungen sowie anonyme oder fremde Zugriffe bleiben gesperrt (D-10).
- Zugriff auf fremde oder nicht vorhandene Objekte liefert **denselben** Fehler: `404` mit unspezifischer Meldung. Kein Unterschied zwischen „gibt es nicht" und „gehört dir nicht" (FR-004).
- Ohne Sitzung: `401`, keine Inhalte (FR-005).
- Grenzwertverletzung: `422` mit Nennung der verletzten Bedingung (FR-010).
- Fehlermeldungen enthalten niemals Dokumentinhalt, Zugangsdaten oder personenbezogene Daten (FR-038).
- Solange im betroffenen Notebook eine Nachricht auf `streaming` steht, lehnen `deleteNotebook` und `deleteSource` mit `409` und einem verständlichen Konflikthinweis ab (FR-035).

## Server Actions

| Aktion | Eingabe | Ergebnis | Anforderung |
|---|---|---|---|
| `createNotebook` | `name` | Notebook-Kennung | FR-006 |
| `renameNotebook` | `id`, `name` | — | FR-006 |
| `deleteNotebook` | `id` | — | FR-006, FR-007 |
| `prepareUpload` | `notebookId`, `fileName`, `contentHash`, `byteSize`, optional `intent`, `replaceSourceId` | `{ decision, existingSourceId?, storagePath?, sourceId? }`; Upload über authentifizierten Browser-Client unter Storage-RLS | FR-009, FR-010, FR-010a |
| `confirmUpload` | `sourceId` | — bestätigt Objekt, vollzieht Ersatz und legt genau einen Auftrag an | FR-010a, FR-011 |
| `cancelUpload` | `sourceId` | — entfernt nur eigenen Entwurf im Zustand `uploading` | FR-010a |
| `setSourceSelected` | `sourceId`, `selected` | — | FR-015 |
| `deleteSource` | `sourceId` | — | FR-016, FR-017, FR-031 |
| `retryIngestion` | `sourceId` | — neuer Auftrag, Zähler zurückgesetzt | FR-012 |

### `prepareUpload` — Dublettenerkennung

Wird **vor** dem Übertragen der Datei aufgerufen. Der Client berechnet die Prüfsumme des Dateiinhalts. Bei bereits 30 Quellen im Notebook antwortet `add` mit `rejected` und nennt die verletzte Grenze. Ein gültiger Ersatz-Entwurf darf vorübergehend die 31. Zeile sein, weil er nach der Bestätigung genau eine vorhandene Quelle ersetzt.

`decision` nimmt einen von drei Werten an:

| Wert | Bedeutung | Folge in der Oberfläche |
|---|---|---|
| `ok` | keine inhaltsgleiche Quelle im Notebook | Übertragung startet |
| `duplicate` | inhaltsgleiche Quelle vorhanden | Rückfrage: ersetzen, zusätzlich aufnehmen, abbrechen (FR-010a) |
| `rejected` | Grenzwert verletzt | Meldung mit der verletzten Bedingung, keine Übertragung |

Bei `duplicate` ruft die Oberfläche `prepareUpload` erneut mit `intent: 'replace' | 'add'` auf. `replace` verlangt `replaceSourceId`, prüft Eigentümer, Notebook und identischen Hash und legt nur einen neuen Entwurf mit `status = uploading` und `replaces_source_id` an. Die alte Quelle bleibt unverändert und nutzbar.

`confirmUpload` prüft das neue Objekt serverseitig auf Existenz, Größe und Hash. Erst danach sperrt eine Datenbanktransaktion alte und neue Quelle, lehnt eine laufende Antwort mit `409` ab, übernimmt den alten Storage-Pfad als `cleanup_storage_path`, entfernt die alte Datenbankquelle, setzt die neue auf `processing` und erzeugt genau einen Auftrag. Wiederholte Bestätigung erzeugt keinen zweiten Auftrag. Der Auftrag löscht den alten Storage-Pfad in seiner Phase `cleanup` vor der Extraktion (D-18).

Bei Upload-Abbruch ruft der Client `cancelUpload` auf. Die Aktion löscht ausschließlich den neuen Entwurf, startet keinen Auftrag und versucht, dessen Storage-Objekt zu entfernen. Ein wegen Verbindungsabbruch verbleibendes Objekt fällt unter die Demo-Ausnahme; die alte Quelle bleibt in jedem Fall unverändert.

## Route Handlers

### `POST /api/chat`

Erzeugt eine Antwort und liefert sie als Strom (FR-019, FR-020).

**Eingabe**: genau eine Variante:

```text
{ notebookId, question }
{ notebookId, retryOfMessageId }
```

**Ablauf bei neuer Frage**: Sitzung prüfen → Benutzerfrage samt Auswahl-Snapshot speichern → Assistant-Versuch 1 anlegen → ausgewählte Quellen im Zustand `ready` serverseitig ermitteln → Top-8 suchen und Mindestwert anwenden → strukturierte Claim-Einheiten erzeugen → Belege nach [answer-and-citations.md](./answer-and-citations.md) prüfen → Nachricht und Verweise atomar speichern.

**Ablauf bei Retry**: Die bezeichnete Assistant-Nachricht MUSS dem Benutzer und Notebook gehören und `failed` sein. Fremd oder nicht vorhanden liefert `404`, ein anderer Zustand `422`. Der Server lädt Fragetext und Auswahl-Snapshot der zugehörigen Benutzerfrage, ermittelt unter Sperre die nächste `attempt_no` und hängt einen neuen Assistant-Versuch an. Der frühere Versuch bleibt unverändert. Aktuell entfernte oder nicht bereite Quellen führen zur erklärten Einschränkung. Es gibt keinen zusätzlichen Endpunkt und keinen vom Client gelieferten Fragetext für den Retry (D-19).

**Vorbedingungen mit eigener Antwort** — in diesen Fällen entsteht **keine** Antwort mit Verweisen (FR-022):

| Lage | Antwort |
|---|---|
| keine Quelle ausgewählt | Hinweis, dass mindestens eine Quelle ausgewählt sein muss |
| keine ausgewählte Quelle im Zustand `ready` | Hinweis auf die Voraussetzung |
| kein Top-8-Treffer erreicht den versionierten Mindestwert | Erklärung, dass die Quellen dazu nichts hergeben; kein Modellaufruf |
| Frage über 2.000 Zeichen | `422` mit Nennung der Grenze |

Kann die Frage wegen eines Ausfalls der Einbettung oder Suche nicht verarbeitet werden, wird der Assistant-Versuch mit einem neutralen Hinweis als `failed` gespeichert. Dieser Pfad DARF NICHT als `below_similarity_threshold` oder andere Aussage über die Quellenlage behandelt werden und darf über `retryOfMessageId` erneut versucht werden (FR-025).

**Abbruch**: Bricht der Client die Verbindung ab, wird die Modellanforderung beendet und die Nachricht erhält den Zustand `aborted` (FR-020a). Fällt der Anbieter aus, wird `failed` gesetzt und ein erneuter Versuch angeboten (FR-025). In beiden Fällen werden provisorische Antwortinhalte und Citations verworfen und nur ein fester terminaler Hinweis gespeichert; die Sperre des Notebooks endet mit dem Zustandswechsel. Nur `failed` darf über `retryOfMessageId` erneut versucht werden.

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
