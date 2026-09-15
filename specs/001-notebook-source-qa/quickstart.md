# Einrichtung und Prüfweg

**Feature**: 001-notebook-source-qa · **Datum**: 2026-09-14

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
```

`pnpm eval` gehört bewusst nicht zu den Toren. Sein Ergebnis schwankt zwischen Läufen; es als Freigabebedingung zu führen, würde entweder zu willkürlichen Wiederholungen oder zum Absenken der Messlatte führen (Prinzip VI).

## Nachweisläufe

### 1 — Kernablauf (SC-001, FR-032)

Registrieren, anmelden, Notebook anlegen, textbasiertes PDF hochladen, warten bis `bereit`, Frage stellen, Antwort lesen, einen Verweis anklicken.

**Erwartet**: Das Dokument öffnet sich auf der belegten Seite, die Passage ist hervorgehoben, und ihr Inhalt stützt die Aussage, der sie zugeordnet war.

### 2 — Zugriffsgrenzen (SC-002, FR-003, FR-004)

Zwei Konten anlegen, in jedem ein Notebook mit einer Quelle. Dann mit Konto B versuchen: Notebook von A über dessen Kennung öffnen, Quelle von A herunterladen, `/api/chat` gegen das Notebook von A aufrufen. Alles wiederholen ohne Anmeldung.

**Erwartet**: kein Inhaltsfragment, keine Auskunft darüber, ob das Objekt existiert. Angemeldet fremd → `404`, nicht angemeldet → `401`. Dieser Lauf ist als `pnpm test:integration` automatisiert; die Handprüfung dient der Gegenprobe.

### 3 — Dateien, die nicht funktionieren (SC-007, FR-010 bis FR-013)

Nacheinander hochladen: beschädigtes PDF, leeres PDF, Bilddatei, passwortgeschütztes PDF, reinen Scan, Datei über 25 MB.

**Erwartet**: jede landet in einem sichtbaren Ablehnungs- oder Fehlerzustand mit lesbarer Ursache. Keine erscheint als `bereit`. Der Scan endet auf `nicht nutzbar` mit dem Hinweis auf fehlende Texterkennung.

### 4 — Wiederholung ohne Duplikate (SC-008, FR-014)

Quelle im Fehlerzustand erzeugen, Abschnitte zählen, Verarbeitung erneut anstoßen, erneut zählen.

**Erwartet**: gleiche Anzahl, ein Eintrag in der Quellenliste.

### 5 — Dublette (FR-010a)

Dieselbe Datei unter anderem Namen ein zweites Mal in dasselbe Notebook laden.

**Erwartet**: Rückfrage mit Ersetzen, zusätzlich aufnehmen, Abbrechen. Nach Ersetzen genau eine Quelle dieses Inhalts.

### 6 — Ehrliche Grenzen (SC-005, FR-022)

Frage stellen, die keine Quelle beantwortet. Danach alle Quellen abwählen und erneut fragen.

**Erwartet**: Erklärung der Einschränkung, keine Antwort mit Verweisen.

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

**Erwartet**: (1) Nachricht endet auf `failed` mit erneutem Versuch, die Aufnahme bleibt davon unberührt. (2) Auftrag scheitert in Phase `embed`, bestehende Quellen bleiben nutzbar. (3) Die hängende Quelle wird eingesammelt und zeigt einen Fehlerzustand statt dauerhaft `wird verarbeitet`. In keinem Fall erscheint eine Teilausgabe als fertig.

### 10 — Entfernte Quelle (FR-031)

Frage mit Verweisen beantworten lassen, dann die belegende Quelle entfernen und die alte Antwort erneut öffnen.

**Erwartet**: Der Wortlaut des Belegs ist weiterhin sichtbar, gekennzeichnet als „Quelle entfernt", ohne Sprung ins Dokument.

### 11 — Parallele Frage (FR-020a)

Während eine Antwort läuft, eine weitere Frage stellen wollen; danach abbrechen.

**Erwartet**: Eingabe gesperrt, Abbrechen sichtbar. Nach Abbruch ist die Teilantwort als abgebrochen gekennzeichnet und die Eingabe wieder frei.

### 12 — Tastatur (SC-009, FR-034)

Den Kernablauf aus Lauf 1 ausschließlich mit der Tastatur durchführen.

**Erwartet**: Jeder Schritt erreichbar, Fokus immer sichtbar, kein Bereich, aus dem der Fokus nicht wieder herausführt. Bestätigungsdialoge lassen sich bedienen und schließen.

### 13 — Antwortqualität (SC-004, SC-005)

```bash
pnpm eval
```

**Erwartet**: ein Bericht mit Belegtreue und Anteil ehrlicher Einschränkungen, gemessen am Referenzdatensatz. Werte unterhalb der Zielwerte sind ein Befund zur Besprechung, **kein** fehlgeschlagenes Tor.

## Referenzdatensatz

Liegt versioniert unter `eval/dataset/` und enthält Dokumente mit bekannten Aussagen, ein widersprüchliches Paar, ein Dokument mit eingebetteter Anweisung sowie Fragen mit erwarteten Belegstellen und Fragen ohne Beleglage. Umfang und Herkunft sind noch offen (OD-03).
