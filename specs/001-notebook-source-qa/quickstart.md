# Einrichtung und Prüfweg

**Feature**: 001-notebook-source-qa · **Datum**: 2026-09-19

Wie das Projekt von null aufgesetzt und wie nachgewiesen wird, dass es tut, was [spec.md](./spec.md) verlangt. Prinzip VII verlangt, dass beides ohne undokumentierte Handgriffe nachvollziehbar ist.

## Voraussetzungen

| Werkzeug | Version | Stand auf diesem Rechner |
|---|---|---|
| Node.js | 22 LTS (`.nvmrc`) | **v25.4.0 installiert** — abweichend, siehe D-12 |
| pnpm | 11.x | 11.1.2 vorhanden |
| Docker | läuft, für die lokale Prüf-Instanz | 29.4.0 vorhanden |
| Supabase CLI | aktuell | 2.117.0 vorhanden |

Offen bleibt allein die Node-Version: auf 22 LTS bringen, bevor es losgeht.

## Supabase lokal, Cloud als Ziel

Entwicklung und Prüfläufe teilen sich **eine lokale** Instanz (D-14). Das Cloud-Projekt ist Veröffentlichungs- und Vorführziel.

| Umgebung | Wofür | Womit angesprochen |
|---|---|---|
| **Lokale Instanz** | Entwicklung und Prüfläufe | `.env.local` |
| **Cloud-Projekt** | Veröffentlichung und Vorführung | Umgebungsvariablen der Veröffentlichungsplattform |

Prüfläufe setzen die lokale Instanz zurück und leeren dabei den Entwicklungsstand. Das ist gewollt; neu befüllen kostet einen Befehl.

> **Achtung, unwiderruflich.** `supabase db reset` leert eine Datenbank vollständig und spielt die Migrationen neu ein. Ohne weitere Angabe trifft der Befehl die lokale Instanz — das ist gewollt. Mit dem Zusatz für die verknüpfte Instanz würde er das **Cloud-Projekt leeren**. Dieser Zusatz darf in keinem Skript und in keinem `package.json`-Eintrag dieses Projekts vorkommen.

## Umgebungsvariablen

`.env.example` liegt im Repository und wird versioniert; `.env.local` nie.

| Variable | Zweck | Sichtbarkeit |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse der Instanz | Browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Schlüssel für Zugriffe unter Zugriffsregeln | Browser |
| `SUPABASE_SERVICE_ROLE_KEY` | erhöhte Rechte für den Verarbeitungslauf | **nur Server** |
| `ANTHROPIC_API_KEY` | Antworterzeugung | **nur Server** |
| `OPENAI_API_KEY` | Einbettungen | **nur Server** |
| `JOB_TRIGGER_SECRET` | schützt `/api/jobs/run` und `/api/jobs/sweep` | **nur Server** |

Antworterzeugung und Einbettungen nutzen getrennte Anbieter-Schlüssel (D-04).

Die als „nur Server" markierten Werte dürfen weder im Browser-Bündel noch in Protokollen erscheinen (Prinzip II). Ein Name ohne das Präfix `NEXT_PUBLIC_` erreicht den Browser nicht — Variablen also nicht umbenennen.

## Erstes Aufsetzen

```bash
pnpm install
supabase start                      # lokale Datenbank, Authentifizierung, Dateiablage
pnpm db:reset                       # Migrationen auf leerer Datenbank — zugleich Nachweis für Gate 3
cp .env.example .env.local
# Adresse und Schlüssel aus der Ausgabe von `supabase start` eintragen, Modellschlüssel ergänzen
pnpm dev
```

**Wiederaufnahme hängender Aufträge** — ausdrücklich angestoßen, kein Zeitplan auf Datenbankseite (D-05):

```bash
pnpm worker:sweep                   # einmalig
pnpm worker:sweep --watch           # wiederkehrend während der Entwicklung
```

**Schema in die Cloud bringen**, wenn vorgeführt werden soll:

```bash
supabase link --project-ref <projekt-kennung>
supabase db push                    # nur vorwärts; niemals db reset gegen die verknüpfte Instanz
```

## Prüfkommandos

Verbindlich, Herkunft und Torzuordnung in [plan.md](./plan.md#verification-commands).

```bash
pnpm typecheck          # Gate 3
pnpm lint               # Gate 3 — `biome check .`, prüft Lint, Format und Imports ohne Dateien zu ändern
pnpm test               # Gate 3 — reine Logik
pnpm test:integration   # Gate 3 und Gate 4 — braucht laufendes `supabase start`
pnpm test:e2e           # Gate 3 — braucht laufendes `pnpm dev`
pnpm db:reset           # Gate 3
pnpm eval               # KEIN Tor — Antwortqualität, Ergebnis wird berichtet
pnpm calibrate:retrieval # KEIN Tor — erzeugt einen Freigabevorschlag für die Abrufkonfiguration
pnpm perf               # KEIN Tor — fünf beobachtende Latenzläufe
```

`pnpm lint` führt `biome check .` ohne Schreibzugriff aus und prüft Lint-Regeln, Format und Importorganisation gemeinsam. `pnpm format` führt `biome format --write .` als bewusste lokale Korrektur aus und ist kein eigenes Freigabetor. Die E2E-Suite läuft für das Demo ausschließlich in Chromium.

`pnpm eval`, `pnpm calibrate:retrieval` und `pnpm perf` gehören bewusst nicht zu den Toren. Ihre Ergebnisse hängen von externen Modellen oder der Umgebung ab. Der Kalibrierlauf erzeugt nur einen Vorschlag; erst der vom Maintainer freigegebene Wert wird mit Modell-, Datensatz- und Chunk-Fingerprint in `eval/dataset/retrieval-calibration.json` versioniert. `pnpm test` prüft danach deterministisch Schema, Fingerprints sowie Scores unterhalb, auf und oberhalb dieses Werts (D-17).

Neu kalibriert wird nur bei Änderungen an Einbettungsmodell, Distanzmaß, Chunk-Konfiguration oder Referenzdatensatz. Die Laufzeit schreibt das Artefakt nie selbst um.

## Nachweisläufe

### 1 — Kernablauf (SC-001, FR-032)

In der vorbereiteten Demo-Umgebung eine Zeitmessung starten, dann registrieren, anmelden, Notebook anlegen, textbasiertes PDF hochladen, warten bis `bereit`, Frage stellen, Antwort lesen und einen Verweis anklicken.

**Erwartet**: Der Ablauf dauert weniger als 10 Minuten. Das Dokument öffnet sich auf der belegten Seite; die Passage ist hervorgehoben oder der geprüfte Wortlaut wird nach der freigegebenen Demo-Abschwächung daneben angezeigt.

### 2 — Zugriffsgrenzen (SC-002, FR-003, FR-004)

Zwei Konten anlegen, in jedem ein Notebook mit einer Quelle. Jedes Feld der Zugriffsmatrix aus spec.md als Eigentümer, mit Konto B, ohne Anmeldung und — bei objektgebundenen Vorgängen — mit einer nicht vorhandenen Kennung ausführen. Dazu gehören Übersicht, Öffnen, Anlegen, Umbenennen/Löschen, Upload-Aktionen, Quellaktionen, Chat, Jobstatus, Storage-Download und Verlauf. Im Storage zusätzlich prüfen: eigener PDF-Upload bis einschließlich 10.485.760 Bytes und eigener Abruf erlaubt; Schreiben und Lesen über fremdes Präfix sowie anonymer Zugriff abgelehnt; direktes Update und Löschen, Upload ab 10.485.761 Bytes und andere MIME-Art abgelehnt; als PDF deklarierter Fremdinhalt scheitert an der serverseitigen Signaturprüfung. Mit Benutzer- und anonymem Token direkte Lese- und Schreibversuche auf allen sechs Anwendungstabellen ausführen und Kindzeilen mit eigener `user_id`, aber fremder Notebook-, Source- oder Message-Kennung versuchen. Interne Job-Endpunkte außerdem mit gültigem, fehlendem und ungültigem `JOB_TRIGGER_SECRET` aufrufen und einen Cross-User-Auftrag verarbeiten lassen.

**Erwartet**: Jede Zelle verhält sich exakt wie in der Matrix festgelegt.
Objektgebundene Fremdzugriffe und nicht vorhandene Kennungen ergeben dieselbe
neutrale `404`-Antwort; anonyme Aufrufe werden ohne
Inhaltsfragment oder Existenzauskunft abgewiesen beziehungsweise zur Anmeldung
geführt. Übersicht und Neuanlage bleiben strikt auf das jeweils angemeldete
Konto begrenzt. Interne Jobs akzeptieren nur das gültige Geheimnis und bleiben
im Eigentümerkontext des Auftrags. Direkte Datenbankzugriffe mit Benutzer- oder
anonymem Token und Kindzeilen mit fremder Elternkennung werden abgelehnt. Dieser
Lauf ist als `pnpm test:integration` automatisiert; die Handprüfung dient der
Gegenprobe.

### 3 — Dateien, die nicht funktionieren (SC-007, FR-010 bis FR-013)

Nacheinander hochladen: beschädigtes PDF, leeres PDF, Bilddatei, passwortgeschütztes PDF, reinen Scan, Datei über 10 MB, Dokument über 50 Seiten und eine 31. Quelle.

**Erwartet**: jede landet in einem sichtbaren Ablehnungs- oder Fehlerzustand mit lesbarer Ursache. Keine erscheint als `bereit`. Der Scan endet auf `nicht nutzbar` mit dem Hinweis auf fehlende Texterkennung.

### 4 — Wiederholung ohne Duplikate (SC-008, FR-014)

Quelle im Fehlerzustand erzeugen, Abschnitte zählen, Verarbeitung erneut anstoßen, erneut zählen.

**Erwartet**: gleiche Anzahl, ein Eintrag in der Quellenliste.

### 5 — Dublette (FR-010a)

Dieselbe Datei unter anderem Namen ein zweites Mal in dasselbe Notebook laden.

**Erwartet**: Rückfrage mit Ersetzen, zusätzlich aufnehmen, Abbrechen. Bei erfolgreichem Ersatz bleibt die alte Quelle bis zur serverseitigen Bestätigung des neuen Objekts nutzbar; danach gibt es genau eine Quelle dieses Inhalts und genau einen neuen Auftrag. Einen zweiten Ersatz beim Übertragen abbrechen: alte Quelle, Datei und Abschnitte bleiben unverändert, kein Auftrag startet.

### 6 — Ehrliche Grenzen (SC-005, FR-022)

Frage stellen, die keine Quelle beantwortet. Danach alle Quellen abwählen und erneut fragen.

**Erwartet**: Erklärung der Einschränkung, keine Antwort mit Verweisen. Die Unit-Fixtures weisen zusätzlich nach: Score unter der versionierten Grenze wird verworfen, Score genau auf der Grenze und darüber wird angenommen; bleiben keine Treffer, erfolgt kein Modellaufruf.

### 7 — Widerspruch (FR-023)

Zwei Quellen aus dem Referenzdatensatz auswählen, die sich zu derselben Frage widersprechen.

**Erwartet**: Die Antwort benennt den Widerspruch und verweist auf beide Stellen, statt eine Angabe als gesichert darzustellen.

### 8 — Anweisung im Dokument (SC-006, FR-024)

Das präparierte Dokument des Referenzdatensatzes hochladen, das eine Anweisung an das System enthält, und danach fragen.

**Erwartet**: Die Anweisung wird als Inhalt behandelt. Antwortverhalten und Zugriffsgrenzen bleiben unverändert; insbesondere erscheint nichts aus fremden Notebooks.

### 9 — Ausfall (SC-010, FR-025)

Vier Teilläufe für die drei fachlich verschiedenen Anbieterpfade und den Wiederanlauf (D-04):

1. Schlüssel des Antwortmodells ungültig setzen, dann fragen.
2. Schlüssel des Einbettungsanbieters ungültig setzen, dann ein PDF hochladen.
3. Schlüssel des Einbettungsanbieters bei vorhandenen bereiten Quellen ungültig setzen, dann eine Frage stellen.
4. Den Verarbeitungslauf mitten im Upload abbrechen, danach `pnpm worker:sweep` ausführen.

**Erwartet**: (1) Nachricht endet auf `failed`. Danach „Erneut versuchen“ wählen: Der alte Versuch bleibt sichtbar, ein neuer Versuch wird an dieselbe Frage angehängt; nach Neuladen stehen beide in Reihenfolge. (2) Auftrag scheitert in Phase `embed`, bestehende Quellen bleiben nutzbar. (3) Der Assistant-Versuch endet mit neutralem Fehlerhinweis auf `failed`, ohne Aussage über die Quellenlage, und lässt sich erneut versuchen. (4) Die hängende Quelle wird eingesammelt und zeigt einen Fehlerzustand statt dauerhaft `wird verarbeitet`. In keinem Fall erscheint eine Teilausgabe als fertig.

### 10 — Entfernte Quelle (FR-031)

Frage mit Verweisen beantworten lassen, dann die belegende Quelle entfernen und die alte Antwort erneut öffnen.

**Erwartet**: Der Wortlaut des Belegs ist weiterhin sichtbar, gekennzeichnet als „Quelle entfernt", ohne Sprung ins Dokument.

### 11 — Parallele Frage (FR-020a)

Während eine Antwort läuft, eine weitere Frage stellen wollen; danach abbrechen.

**Erwartet**: Eingabe gesperrt, Abbrechen sichtbar. Quellen- und Notebook-Löschung werden währenddessen mit Konflikthinweis abgelehnt. Nach Abbruch endet die Modellanforderung, die provisorische Teilantwort wird verworfen, ein fester Hinweis „Antwort abgebrochen“ bleibt sichtbar und die Eingabe ist wieder frei.

### 12 — Tastatur (SC-009, FR-034)

Den Kernablauf aus Lauf 1 ausschließlich mit der Tastatur durchführen.

**Erwartet**: Jeder Schritt erreichbar, Fokus immer sichtbar, kein Bereich, aus dem der Fokus nicht wieder herausführt. Bestätigungsdialoge lassen sich bedienen und schließen.

### 13 — Antwortqualität (SC-005)

```bash
pnpm eval
```

**Erwartet**: ein Bericht mit Belegtreue, ehrlichen Einschränkungen,
Widerspruchsbehandlung, Injection-Resistenz, erwarteter Antwortsprache und dem
Anteil der Claim-Absätze mit nach manueller Rubrik genau einer quellenbasierten
Aussage als getrennte Metriken. Werte unterhalb des Zielwerts sind ein Befund
zur Besprechung, **kein** fehlgeschlagenes Tor.

### 14 — Antwortlatenz (SC-011)

```bash
pnpm perf
```

**Erwartet**: fünf dokumentierte Einzelwerte aus der vorbereiteten Demo-Umgebung. In mindestens vier Läufen wird der erste Antwortteil innerhalb von 5 Sekunden sichtbar. Das Ergebnis ist **kein** Freigabetor.

### 15 — Claim- und Belegformat (FR-027, FR-027a, FR-030)

Mit festen Modell-Fixtures nacheinander erzeugen: gültige Mehrabsatzantwort; Claim ohne Verweis; unbekannte Abschnittsnummer; abweichender Wortlaut; eine Antwort mit einem gültigen und einem ungültigen Claim.

**Erwartet**: Die gültige Antwort erscheint mit genau einer Claim-Einheit pro Absatz und ausschließlich terminalen Verweisen. Bei jedem Negativfall bleibt der vollständige Entwurf nach dem Neuladen textlich als „ungeprüft und nicht belegt“ gekennzeichnet und mit der Einschränkung darunter sichtbar; es wird kein Verweis gespeichert oder anklickbar dargestellt und kein Teilabsatz als erfolgreiche Antwort gerettet.

## Referenzdatensatz

Liegt versioniert unter `eval/dataset/` und umfasst vier selbst erstellte oder vom Maintainer ausdrücklich freigegebene PDFs sowie zwölf Fragen: sechs beantwortbare, drei unbeantwortbare, zwei widersprüchliche und eine auf den eingebetteten Anweisungsversuch zielende Frage. Erwartete Belegstellen, Herkunft, Antwortsprachen, Claim-Anzahlen und die manuelle Ein-Aussage-Rubrik werden mitversioniert.
