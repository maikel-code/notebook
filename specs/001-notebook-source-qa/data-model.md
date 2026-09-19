# Phase 1 — Datenmodell

**Feature**: 001-notebook-source-qa · **Datum**: 2026-09-19

Herleitung aus den Entitäten und Anforderungen in [spec.md](./spec.md). Namen sind englisch, weil sie im Code erscheinen; Erläuterungen deutsch.

## Grundsätze

1. **`user_id` auf jeder Tabelle**, auch wo sie über eine Beziehung herleitbar wäre. Die Zugriffsregel bleibt dadurch lesbar; zugleich MUSS eine Datenbank-Invariante erzwingen, dass Kind und Elternobjekt demselben Benutzer gehören. Ein eigener `user_id` darf nie mit einer fremden Elternkennung kombiniert werden (Prinzip II).
2. **Belege überdauern ihre Quelle.** `citations` trägt Wortlaut, Seitenbereich und Quellennamen als eigene Spalten. Fremdschlüssel auf Quelle und Abschnitt werden beim Löschen auf `NULL` gesetzt, nicht kaskadiert (FR-028a, FR-031).
3. **Lauf und Dokument sind getrennt.** Versuchszähler, Phase und Fehlerursache liegen bei `ingestion_jobs`, nicht bei `sources`.
4. **Ein Gesprächsverlauf je Notebook** (A-07). Es gibt keine Tabelle für Unterhaltungen; `messages` hängt direkt am Notebook.
5. **Upload-Ersatz und Antwort-Retry ergänzen bestehende Entitäten.** Ein Quellenentwurf verweist auf die zu ersetzende Quelle; Antwortversuche verweisen auf dieselbe Benutzerfrage. Zusätzliche Ablauf-Tabellen sind für die Demo nicht nötig (D-18, D-19).

## Tabellen

### `notebooks`

| Spalte | Typ | Regeln |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → `auth.users` | löschen kaskadiert |
| `name` | text | 1–200 Zeichen, nicht leer nach Trimmen |
| `created_at`, `updated_at` | timestamptz | |

Löschen entfernt Quellen, Abschnitte, Aufträge und Nachrichten des Notebooks (FR-007).

### `sources`

| Spalte | Typ | Regeln |
|---|---|---|
| `id` | uuid, PK | |
| `notebook_id` | uuid, FK → `notebooks` | kaskadiert |
| `user_id` | uuid, FK → `auth.users` | |
| `file_name` | text | Anzeigename aus dem Upload |
| `storage_path` | text | `{user_id}/{notebook_id}/{source_id}.pdf` |
| `content_hash` | text | Prüfsumme des Dateiinhalts, Grundlage der Dublettenerkennung (FR-010a) |
| `byte_size` | bigint | ≤ 10.485.760 Bytes (Anzeige: 10 MB; FR-010) |
| `page_count` | int | ≤ 50, erst nach der Extraktion bekannt |
| `status` | text | Zustandsmaschine unten |
| `error_reason` | text, null | benutzerlesbare Ursache (FR-012) |
| `is_selected` | boolean | für Fragen ausgewählt (FR-015) |
| `replaces_source_id` | uuid, FK → `sources`, null | **ON DELETE SET NULL**; nur bei einem Ersatz-Entwurf im Zustand `uploading` (D-18) |
| `cleanup_storage_path` | text, null | alter, vor der Verarbeitung idempotent zu löschender Storage-Pfad; nie an den Browser geben |
| `created_at` | timestamptz | |

**Index auf `(notebook_id, content_hash)` — bewusst nicht eindeutig.** FR-010a erlaubt dem Benutzer die zusätzliche Aufnahme einer inhaltsgleichen Datei. Eine Eindeutigkeitsregel würde diese Wahl technisch verhindern; die Erkennung ist eine Abfrage vor dem Upload, keine Beschränkung.

`is_selected` ist persistent. Beim erneuten Öffnen eines Notebooks wird der gespeicherte Auswahlzustand wiederhergestellt (A-10).

Ein Ersatz-Entwurf zählt für `MAX_SOURCES_PER_NOTEBOOK` nicht zusätzlich, solange `replaces_source_id` auf eine vorhandene Quelle desselben Notebooks zeigt. `confirmUpload` prüft das neue Storage-Objekt serverseitig und führt danach in einer Transaktion den Quellenwechsel und die Auftragserzeugung aus. Vor dieser Bestätigung bleiben alte Quelle, Datei und Abschnitte unverändert (D-18).

### `ingestion_jobs`

| Spalte | Typ | Regeln |
|---|---|---|
| `id` | uuid, PK | |
| `source_id` | uuid, FK → `sources` | kaskadiert |
| `user_id` | uuid, FK → `auth.users` | trägt den autorisierten Verarbeitungskontext (D-10) |
| `status` | text | `queued` · `running` · `succeeded` · `failed` |
| `phase` | text, null | `cleanup` · `extract` · `chunk` · `embed` · `finalize` — für FR-038 |
| `attempt` | int | Start 0, Höchstwert 3 (FR-037) |
| `last_error` | text, null | Ursache ohne Dokumentinhalt (FR-038) |
| `correlation_id` | uuid | Merkmal für die Fehlersuche (FR-038, SC-013) |
| `locked_at` | timestamptz, null | erkennt hängengebliebene Läufe |
| `started_at`, `finished_at` | timestamptz, null | Laufzeitgrenze 5 Minuten |

### `chunks`

| Spalte | Typ | Regeln |
|---|---|---|
| `id` | uuid, PK | |
| `source_id` | uuid, FK → `sources` | kaskadiert |
| `user_id` | uuid, FK → `auth.users` | |
| `ordinal` | int | Reihenfolge innerhalb der Quelle |
| `page_start`, `page_end` | int | Seitenbezug (FR-028); gleich, außer der Abschnitt überschreitet einen Seitenumbruch |
| `content` | text | Text des Abschnitts, Grundlage der Zitatprüfung (D-07) |
| `char_count` | int | speist die Grenze von 60.000 Zeichen je Antwort (FR-036) |
| `embedding` | vector | Dimension folgt dem Einbettungsmodell aus D-04 |

Ähnlichkeitsindex auf `embedding`. Eindeutig über `(source_id, ordinal)`.

### `messages`

| Spalte | Typ | Regeln |
|---|---|---|
| `id` | uuid, PK | |
| `notebook_id` | uuid, FK → `notebooks` | kaskadiert |
| `user_id` | uuid, FK → `auth.users` | |
| `role` | text | `user` · `assistant` |
| `content` | text | bei `user` Frage ≤ 2.000 Zeichen; bei `assistant` Antwort, als unbelegt gekennzeichneter Entwurf oder fester Einschränkungs-/Statustext |
| `status` | text | `streaming` · `complete` · `invalid` · `aborted` · `failed` (FR-020a, FR-025, FR-027a) |
| `unsupported_reason` | text, null | `no_selection` · `no_ready_source` · `below_similarity_threshold` · `invalid_citations` |
| `selected_sources_snapshot` | jsonb, null | nur bei `user`: Liste aus Kennung und Name der zum Fragezeitpunkt ausgewählten Quellen |
| `question_message_id` | uuid, FK → `messages`, null | bei `assistant` gesetzt; **ON DELETE CASCADE** auf die zugehörige Benutzerfrage |
| `attempt_no` | int, null | bei `assistant` ≥ 1 und je Frage fortlaufend |
| `created_at` | timestamptz | |

Der Abzug der Auswahl ist bewusst eine Kopie, kein Verbund: er muss das Entfernen einer Quelle überdauern, damit später nachvollziehbar bleibt, worauf die Frage zielte.

Benutzerfragen haben `status = complete`, `question_message_id = NULL` und `attempt_no = NULL`. Assistant-Nachrichten haben eine Frage und einen Versuchszähler; `(question_message_id, attempt_no)` ist eindeutig. Ein partieller eindeutiger Index erlaubt je Notebook höchstens eine Assistant-Nachricht im Zustand `streaming`. Ein Retry legt nur eine neue Assistant-Nachricht an und verändert weder Frage noch frühere Versuche (D-19).

### `citations`

| Spalte | Typ | Regeln |
|---|---|---|
| `id` | uuid, PK | |
| `message_id` | uuid, FK → `messages` | kaskadiert |
| `user_id` | uuid, FK → `auth.users` | |
| `chunk_id` | uuid, FK → `chunks`, null | **ON DELETE SET NULL** |
| `source_id` | uuid, FK → `sources`, null | **ON DELETE SET NULL** |
| `source_name` | text | Kopie zum Anzeigezeitpunkt |
| `quote` | text | geprüfter Wortlaut (FR-028a, D-07) |
| `page_start`, `page_end` | int | Seitenbezug |
| `ordinal` | int | Reihenfolge im Antworttext |

Ist `chunk_id` gleich `NULL`, wurde die Quelle entfernt: die Oberfläche zeigt `quote`, `source_name` und Seite mit dem Hinweis „Quelle entfernt" und bietet keinen Sprung an (FR-031).

## Zustandsmaschinen

### `sources.status`

```text
uploading ──► processing ──► ready
                  │
                  ├──► failed      (Fehler, Wiederholung möglich — FR-012)
                  └──► unusable    (kein Text extrahierbar — FR-013)
```

`uploading` und `processing` werden in der Oberfläche einheitlich als „wird verarbeitet“ angezeigt (FR-011).

`ready` ist die einzige Voraussetzung dafür, dass eine Quelle für Antworten herangezogen wird (FR-018). `failed` erlaubt einen neuen Auftrag; `unusable` ist endgültig, weil ein erneuter Lauf am selben Dokument dasselbe Ergebnis liefert.

### `ingestion_jobs.status`

```text
queued ──► running ──► succeeded
             │
             ├──► queued    (Fehler, attempt < 3 — automatische Wiederholung)
             └──► failed    (attempt = 3 oder Laufzeitgrenze — FR-037)
```

Ein Lauf mit `running` und überschrittener Laufzeitgrenze gilt als hängengeblieben und wird vom wiederholenden Aufruf zurückgesetzt. Ohne diesen Weg bliebe die Quelle dauerhaft auf `processing` stehen.

### `messages.status`

```text
streaming ──► complete
     ├──────► invalid   (Gesamtprüfung scheitert — FR-027a)
     ├──────► aborted   (Benutzer bricht ab — FR-020a)
     └──────► failed    (Anbieter fällt aus — FR-025)
```

`invalid` speichert den vollständigen Entwurf mit `unsupported_reason = invalid_citations`, aber ohne Citations. Die Oberfläche zeigt ihn dauerhaft und nicht nur farblich als ungeprüft und nicht belegt an. `aborted` und `failed` sind sichtbare Endzustände mit festem Hinweis; provisorische Antwortinhalte und Citations werden dafür nicht gespeichert. Keine dieser Nachrichten DARF als `complete` erscheinen.

Ein bestandener Modellentwurf, alle seine Verweise und `complete` werden atomar gespeichert. Bei `invalid_citations` werden Entwurf, `invalid` und der Grund ohne Verweise atomar gespeichert (D-20).

## Zugriffsregeln

Row-Level-Security ist auf **allen** genannten Tabellen eingeschaltet. Für Benutzer- und anonyme Tokens existiert keine freigebende Policy: direkte `SELECT`-, `INSERT`-, `UPDATE`- und `DELETE`-Operationen auf den sechs Anwendungstabellen sind vollständig gesperrt. Damit können interne Spalten wie `cleanup_storage_path`, Einbettungen und Auftragsdetails nicht über die öffentliche Datenbankschnittstelle gelesen oder verändert werden.

Sämtliche Datenbankzugriffe erfolgen in Server Components, Server Actions, Route Handlers oder Verarbeitungsaufträgen über den serverseitigen Service-Client, nachdem Sitzung, Eigentümer und bei Mutationen das Elternobjekt zentral geprüft wurden. `user_id` wird aus der Sitzung oder dem bereits geprüften Auftrag gesetzt und nie aus einer Benutzereingabe übernommen. Ohne Sitzung endet die Autorisierung vor jedem Datenbankzugriff (FR-005).

**Relationale Eigentümerbindung**: Erforderliche Elternbeziehungen werden über `(parent_id, user_id)` gebunden. Das betrifft Quelle → Notebook, Auftrag/Abschnitt → Quelle, Nachricht → Notebook, Assistant-Versuch → Benutzerfrage im selben Notebook und Citation → Nachricht. Die nullable historischen Citation-Verweise auf Quelle und Abschnitt behalten `ON DELETE SET NULL`; solange sie gesetzt sind, erzwingt ein Constraint-Trigger denselben `user_id`. Dieselbe Prüfung gilt für `replaces_source_id` einschließlich identischem Notebook. Integrationsprüfungen versuchen jede dieser Beziehungen mit fremder Elternkennung und müssen scheitern.

**Dateiablage**: privater Bucket, keine öffentlichen Adressen. Der Bucket begrenzt jedes Objekt auf exakt 10.485.760 Bytes und akzeptiert als MIME-Art nur `application/pdf`; die serverseitige Signaturprüfung bleibt zusätzlich verbindlich. Upload und Abruf erfolgen über den authentifizierten Supabase-Browser-Client. Storage-RLS erlaubt ausschließlich `INSERT` und `SELECT`, wenn der erste Pfadabschnitt `auth.uid()` entspricht. Direkte Browser-Updates und -Löschungen sowie anonyme oder fremde Zugriffe bleiben gesperrt; serverseitige Löschpfade laufen nach Autorisierung über die Dienstrolle. Kurzlebige signierte Adressen sind für das Demo nicht vorgesehen.

**Erhöhte Rechte**: Der serverseitige Service-Client umgeht RLS. Jeder Zugriff MUSS deshalb zuvor die Sitzung und das Zielobjekt zentral autorisieren und zusätzlich auf deren `user_id` eingeschränkt bleiben; bei Mutationen wird außerdem die Elternbeziehung geprüft. Für Verarbeitungsaufträge ist der Eigentümer des Auftrags der verbindliche Kontext (D-10). Integrationsläufe prüfen sowohl verweigerte direkte Browser-Datenbankzugriffe als auch Cross-User-Versuche über die Serverpfade.

**Keine Existenzauskunft**: Zugriff auf ein fremdes Notebook antwortet wie bei einem nicht vorhandenen — gleicher Statuscode, gleiche Meldung (FR-004).

## Grenzwerte

Alle Anwendungswerte aus spec.md liegen in `lib/limits.ts` und werden sowohl beim Eingeben als auch vor dem Schreiben geprüft. Die 10-MB-Grenze wird zusätzlich in der versionierten Storage-Migration gespiegelt, weil der Bucket sie vor dem Anwendungscode durchsetzen muss; T047 prüft die Übereinstimmung. Weitere unkontrollierte Kopien derselben Werte sind zu vermeiden, damit Oberfläche und Server nicht auseinanderlaufen.

| Bezeichner | Wert | Anforderung |
|---|---|---|
| `MAX_FILE_BYTES` | 10.485.760 Bytes; Anzeige 10 MB | FR-010 |
| `MAX_PAGES` | 50 | FR-010 |
| `MAX_SOURCES_PER_NOTEBOOK` | 30 | FR-036 |
| `MAX_SELECTED_SOURCES` | 10 | FR-036 |
| `MAX_QUESTION_CHARS` | 2.000 | FR-036 |
| `MAX_CONTEXT_CHARS` | 60.000 | FR-036 |
| `MAX_JOB_ATTEMPTS` | 3 | FR-037 |
| `JOB_TIMEOUT_MS` | 5 Minuten | FR-037 |

## Versionierte Abrufkonfiguration

Der Abrufgrenzwert ist keine Datenbankeinstellung. `eval/dataset/retrieval-calibration.json` enthält `topK = 8`, Mindestähnlichkeit, Distanzmaß, Einbettungsmodell, Algorithmusversion sowie Fingerprints von Referenzdatensatz und Chunk-Konfiguration (D-17). Die Laufzeit liest dieses freigegebene Artefakt unverändert; bei einem Fingerprint-Konflikt schlägt die Konfigurationsprüfung fehl, statt still einen anderen Wert zu verwenden.
