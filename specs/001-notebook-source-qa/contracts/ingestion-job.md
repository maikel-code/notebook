# Vertrag — Verarbeitungsauftrag

**Feature**: 001-notebook-source-qa · **Datum**: 2026-09-14

Beschreibt, wie aus einer hochgeladenen Datei durchsuchbare Textabschnitte werden, und welche Zusagen dabei gelten. Zustände und Spalten siehe [data-model.md](../data-model.md).

## Phasen

| Phase | Tut | Bricht ab bei |
|---|---|---|
| `extract` | liest den Text seitenweise aus dem PDF | kein PDF, beschädigt, passwortgeschützt, über 300 Seiten |
| `chunk` | bildet Abschnitte mit Seitenbezug | kein extrahierbarer Text → Zustand `unusable` (FR-013) |
| `embed` | berechnet Einbettungen je Abschnitt | Anbieter nicht erreichbar → Wiederholung |
| `finalize` | setzt die Quelle auf `ready`, schließt den Auftrag | — |

Die Phase wird bei jedem Wechsel geschrieben. Sie beantwortet nach einem Fehlschlag die Frage, **wo** es gescheitert ist, ohne Dokumentinhalt zu protokollieren (FR-038).

## Zusagen

### Ein Auftrag wird höchstens einmal gleichzeitig ausgeführt

Der Arbeitsschritt beansprucht einen Auftrag atomar: ein Auftrag im Zustand `queued` wird unter Sperre mit Überspringen bereits gesperrter Zeilen ausgewählt, auf `running` gesetzt und mit einem Zeitstempel versehen. Zwei gleichzeitige Aufrufe greifen dadurch nie denselben Auftrag.

### Wiederholung erzeugt keine Duplikate

Vor dem Schreiben löscht die Phase `chunk` **alle** vorhandenen Abschnitte der Quelle und schreibt sie in derselben Transaktion neu. Damit führt ein zweiter Lauf zur selben Anzahl Abschnitte, auch wenn ein früherer Lauf mitten im Schreiben abgebrochen ist (FR-014, SC-008).

### Wiederholungen sind begrenzt und enden sichtbar

Scheitert ein Lauf, wird `attempt` erhöht. Unter 3 geht der Auftrag zurück auf `queued`. Bei 3 wird er `failed`, und die Quelle wechselt auf `failed` mit lesbarer Ursache. Der Benutzer kann dann von Hand wiederholen; das setzt den Zähler zurück (FR-012, FR-037).

### Hängengebliebene Läufe werden eingesammelt

`POST /api/jobs/sweep` sucht Aufträge mit `running` und einem Zeitstempel älter als die Laufzeitgrenze von 5 Minuten und behandelt sie wie einen Fehlschlag. Ohne diesen Weg bliebe eine Quelle nach einem Absturz dauerhaft auf `processing` — der Benutzer sähe nie einen Fehler und hätte nichts zum Wiederholen.

### Der Lauf bleibt im Kontext seines Eigentümers

Der Arbeitsschritt arbeitet mit erhöhten Rechten und umgeht damit die Zugriffsregeln der Datenbank. Jede Abfrage darin MUSS zusätzlich auf `user_id` des Auftrags eingeschränkt werden (D-10). Das ist keine Empfehlung: es ist die einzige verbleibende Grenze, wenn RLS umgangen wird, und der Integrationslauf prüft sie.

## Auslöser

| Auslöser | Wann | Zweck |
|---|---|---|
| nach `confirmUpload` | sofort | schnelle Rückmeldung im üblichen Fall |
| `POST /api/jobs/sweep` | wiederkehrend, lokal über `pnpm worker:sweep` ausgelöst | hängengebliebene und zur Wiederholung vorgemerkte Aufträge. Kein Zeitplan auf Datenbankseite: die Cloud-Instanz erreicht die lokale Anwendung nicht (D-14). |
| `retryIngestion` | Benutzeraktion | nach endgültigem Fehlschlag (FR-012) |

## Was der Auftrag nicht tut

- **Keine Texterkennung auf Scans.** Ohne extrahierbaren Text endet die Quelle auf `unusable` mit der Erklärung, dass gescannte Dokumente nicht unterstützt werden (FR-013). Kein Wiederholversuch, weil das Ergebnis dasselbe bliebe.
- **Kein Ableiten des Dateityps aus dem Dateinamen.** Geprüft wird der Inhalt.
- **Kein Fortschreiben auf `ready` bei Teilerfolg.** Entweder alle Abschnitte liegen mit Einbettung vor, oder die Quelle bleibt in einem Fehlerzustand (FR-013, SC-007).
