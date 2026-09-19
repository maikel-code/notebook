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

## Zwei Supabase-Instanzen

Der Entwurf arbeitet bewusst mit zwei getrennten Instanzen (D-14):

| Instanz | Wofür | Womit angesprochen |
|---|---|---|
| **Cloud-Projekt** | Entwicklung und Vorführung, Daten bleiben erhalten | `.env.local` |
| **Lokale Instanz** | automatisierte Prüfläufe, wird geleert und neu aufgebaut | `.env.test.local` |

> **Achtung, unwiderruflich.** `supabase db reset` leert eine Datenbank vollständig und spielt die Migrationen neu ein. Ohne weitere Angabe trifft der Befehl die **lokale** Instanz — das ist gewollt. Mit dem Zusatz für die verknüpfte Instanz würde er das **Cloud-Projekt leeren**. Dieser Zusatz darf in keinem Skript und in keinem `package.json`-Eintrag dieses Projekts vorkommen. Schemaänderungen gelangen ausschließlich über `supabase db push` in die Cloud.

## Umgebungsvariablen

`.env.example` liegt im Repository und wird versioniert; `.env.local` nie.

| Variable | Zweck | Sichtbarkeit |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse der Instanz | Browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Schlüssel für Zugriffe unter Zugriffsregeln | Browser |
| `SUPABASE_SERVICE_ROLE_KEY` | erhöhte Rechte für den Verarbeitungslauf | **nur Server** |
| `MODEL_PROVIDER_API_KEY` | Einbettungen und Antworten | **nur Server** |
| `JOB_TRIGGER_SECRET` | schützt `/api/jobs/run` und `/api/jobs/sweep` | **nur Server** |

`MODEL_PROVIDER_API_KEY` steht für **zwei** Schlüssel: einen für die Antworterzeugung, einen für die Einbettungen (D-04).

Die als „nur Server" markierten Werte dürfen weder im Browser-Bündel noch in Protokollen erscheinen (Prinzip II). Ein Name ohne das Präfix `NEXT_PUBLIC_` erreicht den Browser nicht — Variablen also nicht umbenennen.

## Erstes Aufsetzen

**Cloud-Projekt für die Entwicklung:**

```bash
pnpm install
supabase link --project-ref <projekt-kennung>
supabase db push                    # Migrationen in die Cloud
cp .env.example .env.local
# Adresse und Schlüssel aus den Projekteinstellungen eintragen, Modellschlüssel ergänzen
pnpm dev
```

**Lokale Instanz für die Prüfläufe:**

```bash
supabase start                      # startet Datenbank, Authentifizierung, Dateiablage
pnpm db:reset                       # Migrationen auf leerer Datenbank — zugleich Nachweis für Gate 3
cp .env.example .env.test.local
# Adresse und Schlüssel aus der Ausgabe von `supabase start` eintragen
```

**Wiederaufnahme hängender Aufträge:** Die Cloud-Datenbank kann die lokal laufende Anwendung nicht erreichen, deshalb gibt es keinen Zeitplan auf Datenbankseite (D-14). Ausgelöst wird lokal:

```bash
pnpm worker:sweep                   # einmalig
pnpm worker:sweep --watch           # wiederkehrend während der Entwicklung
```

## Prüfkommandos

Verbindlich, Herkunft und Torzuordnung in [plan.md](./plan.md#verification-commands).

```bash
pnpm typecheck          # Gate 3
pnpm lint               # Gate 3
pnpm test               # Gate 3 — reine Logik
pnpm test:integration   # Gate 3 und Gate 4 — braucht laufendes `supabase start`
pnpm test:e2e           # Gate 3 — braucht laufendes `pnpm dev`
pnpm db:reset           # Gate 3
pnpm eval               # KEIN Tor — Antwortqualität, Ergebnis wird berichtet
pnpm calibrate:retrieval # KEIN Tor — erzeugt einen Freigabevorschlag für die Abrufkonfiguration
pnpm perf               # KEIN Tor — fünf beobachtende Latenzläufe
```

`pnpm eval`, `pnpm calibrate:retrieval` und `pnpm perf` gehören bewusst nicht zu den Toren. Ihre Ergebnisse hängen von externen Modellen oder der Umgebung ab. Der Kalibrierlauf erzeugt nur einen Vorschlag; erst der vom Maintainer freigegebene Wert wird mit Modell-, Datensatz- und Chunk-Fingerprint in `eval/dataset/retrieval-calibration.json` versioniert. `pnpm test` prüft danach deterministisch Schema, Fingerprints sowie Scores unterhalb, auf und oberhalb dieses Werts (D-17).

Neu kalibriert wird nur bei Änderungen an Einbettungsmodell, Distanzmaß, Chunk-Konfiguration oder Referenzdatensatz. Die Laufzeit schreibt das Artefakt nie selbst um.

## Nachweisläufe

### 1 — Kernablauf (SC-001, FR-032)

In der vorbereiteten Demo-Umgebung eine Zeitmessung starten, dann registrieren, anmelden, Notebook anlegen, textbasiertes PDF hochladen, warten bis `bereit`, Frage stellen, Antwort lesen und einen Verweis anklicken.

**Erwartet**: Der Ablauf dauert weniger als 10 Minuten. Das Dokument öffnet sich auf der belegten Seite; die Passage ist hervorgehoben oder der geprüfte Wortlaut wird nach der freigegebenen Demo-Abschwächung daneben angezeigt.

### 2 — Zugriffsgrenzen (SC-002, FR-003, FR-004)

Zwei Konten anlegen, in jedem ein Notebook mit einer Quelle. Die feste Demo-Matrix für Notebook-Seite plus `renameNotebook`, Storage-Download, `POST /api/chat` und `GET /api/jobs/status` jeweils als Eigentümer, mit Konto B und ohne Anmeldung ausführen. Beim Chat zusätzlich eine fremde `retryOfMessageId`, beim Upload eine fremde `replaceSourceId` versuchen. Interne Job-Endpunkte außerdem mit gültigem, fehlendem und ungültigem `JOB_TRIGGER_SECRET` aufrufen und einen Cross-User-Auftrag verarbeiten lassen.

**Erwartet**: Berechtigte Zugriffe funktionieren. Fremd gibt es `404`, anonym `401`, jeweils ohne Inhaltsfragment oder Existenzauskunft. Interne Jobs akzeptieren nur das gültige Geheimnis und bleiben im Eigentümerkontext des Auftrags. Dieser Lauf ist als `pnpm test:integration` automatisiert; die Handprüfung dient der Gegenprobe.

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

Drei Teilläufe, weil zwei Anbieter zwei unabhängige Ausfallpfade haben (D-04):

1. Schlüssel des Antwortmodells ungültig setzen, dann fragen.
2. Schlüssel des Einbettungsanbieters ungültig setzen, dann ein PDF hochladen.
3. Den Verarbeitungslauf mitten im Upload abbrechen, danach `pnpm worker:sweep` ausführen.

**Erwartet**: (1) Nachricht endet auf `failed`. Danach „Erneut versuchen“ wählen: Der alte Versuch bleibt sichtbar, ein neuer Versuch wird an dieselbe Frage angehängt; nach Neuladen stehen beide in Reihenfolge. (2) Auftrag scheitert in Phase `embed`, bestehende Quellen bleiben nutzbar. (3) Die hängende Quelle wird eingesammelt und zeigt einen Fehlerzustand statt dauerhaft `wird verarbeitet`. In keinem Fall erscheint eine Teilausgabe als fertig.

### 10 — Entfernte Quelle (FR-031)

Frage mit Verweisen beantworten lassen, dann die belegende Quelle entfernen und die alte Antwort erneut öffnen.

**Erwartet**: Der Wortlaut des Belegs ist weiterhin sichtbar, gekennzeichnet als „Quelle entfernt", ohne Sprung ins Dokument.

### 11 — Parallele Frage (FR-020a)

Während eine Antwort läuft, eine weitere Frage stellen wollen; danach abbrechen.

**Erwartet**: Eingabe gesperrt, Abbrechen sichtbar. Quellen- und Notebook-Löschung werden währenddessen mit Konflikthinweis abgelehnt. Nach Abbruch endet die Modellanforderung, die Teilantwort ist als abgebrochen gekennzeichnet und die Eingabe wieder frei.

### 12 — Tastatur (SC-009, FR-034)

Den Kernablauf aus Lauf 1 ausschließlich mit der Tastatur durchführen.

**Erwartet**: Jeder Schritt erreichbar, Fokus immer sichtbar, kein Bereich, aus dem der Fokus nicht wieder herausführt. Bestätigungsdialoge lassen sich bedienen und schließen.

### 13 — Antwortqualität (SC-005)

```bash
pnpm eval
```

**Erwartet**: ein Bericht mit Belegtreue als Berichtsmetrik und Anteil ehrlicher Einschränkungen nach SC-005. Werte unterhalb des Zielwerts sind ein Befund zur Besprechung, **kein** fehlgeschlagenes Tor.

### 14 — Antwortlatenz (SC-011)

```bash
pnpm perf
```

**Erwartet**: fünf dokumentierte Einzelwerte aus der vorbereiteten Demo-Umgebung. In mindestens vier Läufen wird der erste Antwortteil innerhalb von 5 Sekunden sichtbar. Das Ergebnis ist **kein** Freigabetor.

### 15 — Claim- und Belegformat (FR-027, FR-030)

Mit festen Modell-Fixtures nacheinander erzeugen: gültige Mehrabsatzantwort; Claim ohne Verweis; unbekannte Abschnittsnummer; abweichender Wortlaut; eine Antwort mit einem gültigen und einem ungültigen Claim.

**Erwartet**: Die gültige Antwort erscheint mit genau einer Claim-Einheit pro Absatz und ausschließlich terminalen Verweisen. Jeder Negativfall ersetzt die gesamte provisorische Antwort durch den festen Einschränkungstext; es wird kein Verweis gespeichert und kein gültiger Teilabsatz als erfolgreiche Antwort gerettet.

## Referenzdatensatz

Liegt versioniert unter `eval/dataset/` und umfasst vier selbst erstellte oder vom Maintainer ausdrücklich freigegebene PDFs sowie zwölf Fragen: sechs beantwortbare, drei unbeantwortbare, zwei widersprüchliche und eine auf den eingebetteten Anweisungsversuch zielende Frage. Erwartete Belegstellen, Herkunft und Bewertungskriterien werden mitversioniert.
