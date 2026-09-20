# Research: Quellenarbeitsbereich und Studio-Notizen

## Decision: Bestehenden serverseitigen OpenAI-Zugang für Webtreffer verwenden

**Rationale**: Der Bestand besitzt bereits einen serverseitigen OpenAI-Schlüssel. Die Responses-Schnittstelle unterstützt die Websuche und liefert Quellenadressen sowie URL-Zitate. Ein kleiner serverseitiger Adapter begrenzt das Ergebnis auf zehn normalisierte Treffer und kapselt Anbieterfehler. Dadurch entsteht kein zusätzlicher Schlüssel oder browserseitiger Anbieterzugriff.

**Alternatives considered**:

- Separater Suchanbieter: zusätzlicher Vertrag, Schlüssel und Fehlerfläche ohne Mehrwert für die Demo.
- HTML-Scraping allgemeiner Suchmaschinen: instabil, nicht als Schnittstelle zugesichert und nicht kontrollierbar.
- Freie URL-Eingabe: erweitert die Sicherheitsfläche und entspricht nicht dem angeforderten Auswahlablauf.

## Decision: Webseite erst nach bestätigter Übernahme abrufen

**Rationale**: Die Ergebnisvorschau nutzt nur vom Suchanbieter gelieferte Metadaten. Erst der bestätigte Import ruft die Zielseite ab, extrahiert lesbaren Text und startet die vorhandene Chunk-/Embedding-Verarbeitung. Das erfüllt die explizite Auswahl und verhindert Nebenwirkungen einer Suche oder Vorschau.

**Alternatives considered**:

- Volltext bereits bei der Suche laden: erzeugt unerwünschte externe Abrufe und kostet Zeit.
- Ergebnis-Snippet direkt als Quelle nutzen: zu kurz und nicht als prüfbare Quellenfassung geeignet.

## Decision: Öffentliche URL vor und nach jeder Weiterleitung prüfen

**Rationale**: Die Importlogik akzeptiert nur HTTPS, keine Zugangsdaten, keine IP-Literale und keine Namen oder aufgelösten Adressen aus lokalen, Loopback-, Link-local-, Multicast- oder privaten Netzen. Sie folgt höchstens drei Weiterleitungen, prüft jede neue Adresse erneut, verlangt HTML und begrenzt Antwortgröße und Laufzeit. Fehler enthalten keinen Zielinhalt.

**Alternatives considered**:

- Nur auf Suchanbieter vertrauen: verhindert keine unerwarteten Weiterleitungen beim späteren Abruf.
- Uneingeschränkter Server-Fetch: verletzt die Zugriffssicherheit und die Demo-Grenze.

## Decision: PDF und Website als eine Quelle mit Ursprungstyp behandeln

**Rationale**: Beide Quelltypen verwenden dieselbe Auswahl, denselben Status, dieselben Chunks und dieselbe Retrieval- und Zitierprüfung. Zusätzliche Felder zeichnen URL, kanonische Adresse, Übersicht und Textfassung einer Webquelle aus. PDF-Storage bleibt ausschließlich für PDFs gültig.

**Alternatives considered**:

- Separate Webquellen-Tabelle mit eigener Retrieval-Pipeline: dupliziert Kernlogik.
- Webtexte nur in der Sitzung halten: verhindert persistente Auswahl und Belege.

## Decision: Orientierung und Notiz als persistente, geprüfte Erweiterungen des Gesprächs behandeln

**Rationale**: Die Orientierung wird nach der ersten erfolgreichen Quelle durch dieselbe Claim- und Zitierprüfung erzeugt und als eigener Assistant-Beitrag mit Quelle und Fragen gespeichert. Eine Studio-Notiz referenziert genau eine vollständige Antwort und speichert Titel sowie Text-Schnappschuss; vorhandene Zitat-Schnappschüsse bleiben bei Quellenlöschung gültig.

**Alternatives considered**:

- Freier, nicht belegter Begrüßungstext: unterläuft Quellenbindung.
- Notiz nur als Verweis auf eine veränderliche UI-Antwort: ist kein stabiler Arbeitsstand.

## Decision: Drei Bereiche ohne neue UI-Bibliothek

**Rationale**: Das vorhandene Komponenten- und Dialogmuster reicht für Quellenliste, zentralen Chat/Detailbereich und Studio-Liste. Responsive CSS klappt Bereiche auf kleinen Ansichten untereinander; die Demo bleibt in Chromium nachvollziehbar.

**Alternatives considered**:

- Umstieg der vorhandenen UI-Bibliothek: fachfremder Umfang ohne Nutzen für die Nutzerabläufe.
