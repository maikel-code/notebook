# Notebook Constitution

Kontext: NotebookLM-Klon als Senior-Fullstack-Interviewprojekt. Die Implementierung
erfolgt überwiegend durch KI-Agenten (Claude Code, Codex); der Maintainer verantwortet
die technische Steuerung, die Architekturentscheidungen und die überprüfbare Qualität
des Ergebnisses. Diese Datei regelt, wie gearbeitet und wie geprüft wird.

## Core Principles

### I. Technische Verantwortung

- Agenten-generierter Code MUSS dieselben Review-, Test- und Lesbarkeitsanforderungen
  erfüllen wie handgeschriebener Code. Die Herkunft einer Änderung ist kein
  Qualitätsargument und kein Entschuldigungsgrund.
- Jede Fertigmeldung MUSS einen Nachweis mitliefern: ausgeführter Befehl mit Ergebnis,
  Testlauf oder reproduzierbare manuelle Schritte. "Fertig" ohne Nachweis gilt als offen.
- Wesentliche Entscheidungen (Datenmodell, Zugriffsmodell, Retrieval-Strategie,
  Fehlerbehandlung) MÜSSEN mit Begründung und verworfener Alternative festgehalten
  werden — knapp, aber nachlesbar.
- Anforderungen, Akzeptanzkriterien und Tests DÜRFEN NICHT abgeschwächt, übersprungen
  oder umgeschrieben werden, um eine fehlerhafte Implementierung zu rechtfertigen.
  Passt eine Anforderung nicht, wird sie als Änderung entschieden (siehe Governance),
  nicht stillschweigend angepasst.
- Wiederkehrende Fehlannahmen eines Agenten SOLLTEN in die Agentenanweisungen
  zurückgespielt werden, statt nur lokal korrigiert zu werden.

Prüfkriterium: Jeder Änderungssatz nennt die ausgeführte Verifikation und ihr Ergebnis.
Eine geänderte oder entfernte Prüfung trägt eine Begründung.

### II. Sichere Zugriffsgrenzen (NICHT VERHANDELBAR)

- Notebooks, Dokumente, Textabschnitte, Einbettungen, Chats und Nachrichten MÜSSEN
  ausschließlich für berechtigte Benutzer lesbar und schreibbar sein.
- Die Grenze MUSS auf jeder Ebene durchgesetzt werden, die Daten berührt: Datenbank
  (RLS), Objekt-Storage, Retrieval und Hintergrundverarbeitung. Eine Grenze, die nur
  im UI oder nur in einer Route durchgesetzt wird, gilt als nicht durchgesetzt.
- Privilegierte Zugriffe (Service-Rolle, Admin-Client, Job-Runner) MÜSSEN auf
  serverseitige Pfade beschränkt sein, den effektiven Benutzerkontext explizit führen
  und begründet sein.
- Jede Zugriffsgrenze MUSS positiv (Berechtigter erreicht die eigenen Daten) und negativ
  (fremder Benutzer und anonymer Zugriff scheitern) getestet sein. Ein neuer Datenpfad
  ohne Negativtest gilt als unfertig.
- Geheimnisse MÜSSEN außerhalb von Client-Bundles, Repository und Logs bleiben. Zugriff
  ausschließlich über serverseitig gelesene Umgebungsvariablen.

Prüfkriterium: Für jede zugriffsgeschützte Ressource existiert mindestens ein
Negativtest, der ohne die Schutzmaßnahme nachweislich fehlschlägt.

### III. Quellengebundene, ehrliche Antworten

- Eine Quellenangabe MUSS auf eine real gespeicherte Originalstelle auflösbar sein
  (existierendes Dokument, existierender Abschnitt, abrufbare Position). Nicht
  auflösbare Angaben MÜSSEN als Fehler behandelt werden, nicht als Darstellungsdetail.
- Eine Quellenangabe MUSS die Aussage inhaltlich stützen, der sie zugeordnet ist.
  Formal korrekte, inhaltlich unpassende Belege gelten als Fehler.
- Fehlende Belege, unzureichender Kontext und Widersprüche zwischen Quellen MÜSSEN für
  den Benutzer erkennbar sein. Eine unbelegte Antwort DARF NICHT aussehen wie eine
  belegte.
- Dokumentinhalte, Dateinamen und Metadaten sind nicht vertrauenswürdige Daten. Sie
  MÜSSEN als Daten behandelt werden und DÜRFEN NICHT Systemanweisungen, Werkzeugauswahl
  oder Zugriffsregeln verändern.
- Antworten SOLLTEN erkennbar machen, worauf sie sich stützen, bevor sie ausführlich
  werden.

Prüfkriterium: Zitatauflösung und Zitattreue sind gegen den Referenzdatensatz
(Prinzip VI) geprüft. Mindestens ein Prüffall deckt Anweisungen ab, die aus
Dokumentinhalt stammen.

### IV. Einfache, begründete Architektur

- Die Aufgabenstellung der Interviewaufgabe und der vereinbarte Stack sind verbindlich.
  Fehlende Vorgaben DÜRFEN NICHT erfunden werden; sie werden als offene Frage markiert
  und entschieden.
- Bevorzugt werden klare Verantwortlichkeiten und bewährte Mittel des vereinbarten
  Stacks. Zusätzliche Abstraktionsschichten, Dienste, Laufzeiten oder Abhängigkeiten
  MÜSSEN einen konkreten, benannten Nutzen für diese Aufgabe haben.
- Wesentliche Trade-offs und bewusst akzeptierte Grenzen MÜSSEN dokumentiert sein,
  statt implizit zu bleiben.
- Bestehende Muster im Repository führen. Ein zweites Muster für dieselbe Aufgabe DARF
  NICHT ohne Begründung eingeführt werden.
- Struktur SOLLTE dem tatsächlichen Umfang folgen; Generalisierung auf Vorrat ist zu
  vermeiden.

Prüfkriterium: Jede neue Abhängigkeit und jede neue Schicht ist in `plan.md` mit Nutzen
und verworfener Alternative begründet.

### V. Vollständige Nutzerabläufe

- Gearbeitet wird in kleinen, durchgängigen Schritten: ein Ablauf reicht von der
  Benutzeraktion bis zum sichtbaren, persistierten Ergebnis.
- Ein Ablauf gilt erst als fertig, wenn Lade-, Leer-, Erfolgs- und Fehlerzustand
  vorhanden und verständlich sind.
- Fehlgeschlagene oder unvollständige Verarbeitung DARF NICHT als Erfolg dargestellt
  werden. Der tatsächliche Zustand MUSS sichtbar sein und, wo sinnvoll, eine
  Wiederholung erlauben.
- Grundlegende Barrierefreiheit MUSS gegeben sein: Tastaturbedienbarkeit, sichtbarer
  Fokus, beschriftete Bedienelemente, programmatisch zugeordnete Fehlermeldungen.
- Fehlermeldungen SOLLTEN benennen, was passiert ist und was der Benutzer tun kann.

Prüfkriterium: Zu jedem gelieferten Ablauf sind alle vier Zustände demonstrierbar —
einschließlich des Fehlerpfads.

### VI. Verifikation anhand von Anforderungen

- Tests MÜSSEN aus Akzeptanzkriterien und benannten Risiken abgeleitet werden, nicht
  aus der vorhandenen Implementierung. Abdeckungsquoten sind kein Abnahmekriterium.
- Drei Bereiche MÜSSEN abgedeckt sein: Zugriffsisolation (Prinzip II),
  Dokumentverarbeitung einschließlich Fehlerfällen, und Quellenqualität (Prinzip III).
- Deterministische Softwaretests und probabilistische Antwortbewertungen MÜSSEN getrennt
  geführt und getrennt bewertet werden. Eine schwankende Antwortbewertung DARF NICHT als
  bestandener Softwaretest gelten.
- Antwortqualität MUSS gegen einen kleinen, manuell geprüften Referenzdatensatz mit
  erwarteten Belegstellen bewertet werden.
- Agenten-Reviews ergänzen ausführbare Prüfungen; sie ersetzen sie NICHT.
- Ein reproduzierter Fehler SOLLTE zuerst eine fehlschlagende Prüfung bekommen.

Prüfkriterium: Referenzdatensatz und Bewertungslauf sind im Repository versioniert und
ohne Zusatzwissen ausführbar.

### VII. Reproduzierbarkeit und begrenzter Ressourcenverbrauch

- Setup, Migrationen und Verifikation MÜSSEN aus dem Repository heraus nachvollziehbar
  ausführbar sein — mit benannten Voraussetzungen und ohne undokumentierte Handgriffe.
- Schemaänderungen MÜSSEN als versionierte Migrationen vorliegen. Manuelle Eingriffe in
  einer Umgebung sind kein Ersatz.
- Grenzen für Dateigröße, Kontextumfang, Laufzeiten und Wiederholungen MÜSSEN explizit
  gesetzt und durchgesetzt werden; unbegrenzte Schleifen und unbegrenzte Wiederholung
  sind unzulässig. Die konkreten Werte gehören in `spec.md`.
- Wiederholte oder erneut angestoßene Verarbeitung DARF KEINE unbeabsichtigten Duplikate
  erzeugen. Wiederholbarkeit MUSS über einen stabilen Schlüssel abgesichert sein.
- Fehler MÜSSEN diagnostizierbar sein (Korrelationsmerkmal, Phase, Ursache), OHNE
  Dokumentinhalte, personenbezogene Daten oder Geheimnisse offenzulegen.

Prüfkriterium: Ein zweiter Lauf derselben Eingabe verändert den Datenbestand nicht
unbeabsichtigt. Das Setup ist mindestens einmal auf einer frischen Umgebung durchlaufen.

### VIII. Verständliche Zusammenarbeit

- Code, Änderungssätze und Dokumentation MÜSSEN so beschaffen sein, dass ein anderer
  Entwickler die Arbeit ohne Rückfragen an den Autor übernehmen kann.
- Knapp und an auffindbarer Stelle festgehalten werden MÜSSEN: wesentliche Entscheidungen
  mit Begründung, Korrekturen an Agentenanweisungen, und bekannte Einschränkungen.
- Dokumentation MUSS Verständnis und Nachprüfbarkeit ermöglichen — Zweck, Grenzen,
  Prüfweg. Sie DARF NICHT die Implementierung Zeile für Zeile nacherzählen.
- Namen, Fehlermeldungen und Commit-Texte SOLLTEN den fachlichen Vorgang benennen, nicht
  den technischen Mechanismus.
- Bekannte Einschränkungen SOLLTEN offen benannt werden; unbenannte Lücken wirken wie
  Versehen.

Prüfkriterium: Entscheidungen, Agentenkorrekturen und Einschränkungen sind an der dafür
vorgesehenen Stelle nachlesbar und aktuell.

## Geltungsbereich und Dokumentgrenzen

Diese Constitution enthält keine Features, keine Messgrenzen, keine Technologieversionen
und keine Agentenorganisation. Verletzt ein Dokument seine Grenze, wird der Inhalt
verschoben — nicht dupliziert.

| Dokument | Inhalt |
|---|---|
| `constitution.md` | Prinzipien, Prüfkriterien, Ausnahmeverfahren |
| `spec.md` | Features, Akzeptanzkriterien, konkrete Messgrenzen und Limits |
| `plan.md` | Architektur, Stack, Versionen, Datenmodell, Trade-off-Begründungen |
| `AGENTS.md` | Agentenrollen, Worktree-Zuständigkeiten, Handoffs, Arbeitsanweisungen |

Die Stellenbeschreibung ist Kontext für Anspruchsniveau und Schwerpunkte. Sie ist keine
Quelle für zusätzliche Features. Vorgaben, welche die Interviewaufgabe nicht macht,
werden als offene Frage markiert und entschieden — nicht erfunden.

## Entwicklungsworkflow und Qualitätsgates

Arbeitsrichtung: Anforderung → Prüfkriterium → Implementierung → Nachweis. Jeder
Änderungssatz durchläuft die folgenden Gates.

1. **Abgrenzung.** Die Änderung ist auf einen durchgängigen Ablauf oder eine benannte
   Korrektur begrenzt. Nicht zugehörige Änderungen werden getrennt.
2. **Prüfkriterien vorab.** Akzeptanzkriterien und Risiken stehen fest, bevor
   implementiert wird (Prinzip VI).
3. **Automatisierte Prüfung.** Typprüfung, Linting, Tests und Migrationen laufen
   fehlerfrei.
4. **Zugriffsprüfung.** Berührt die Änderung Daten, Storage, Retrieval oder
   Hintergrundverarbeitung, liegt ein Negativtest vor (Prinzip II).
5. **Review.** Mindestens ein Review gegen diese Prinzipien — bei agentengenerierten
   Änderungen durch den Maintainer oder eine getrennte Agenteninstanz. Der Autor einer
   Änderung ist nicht ihr alleiniger Prüfer.
6. **Nachweis.** Der Änderungssatz nennt die ausgeführte Verifikation und ihr Ergebnis
   (Prinzip I).

Ein Gate DARF NICHT durch Abschwächen seines Kriteriums passiert werden.

## Governance

Diese Constitution steht über Gewohnheit, Agentenvorschlag und Bequemlichkeit. Bei
Widerspruch zwischen dieser Datei und einer Agentenanweisung, einem Werkzeug-Default
oder einem früheren Muster gilt diese Datei.

**Ausnahmen.** Eine Ausnahme von einer MUSS-Regel ist zulässig, wenn drei Dinge
vorliegen: (a) eine dokumentierte Begründung, (b) die benannte Auswirkung samt Rückweg,
(c) die ausdrückliche Entscheidung des Maintainers. Fehlt eines davon, ist die Regel
einzuhalten. Ausnahmen werden dort festgehalten, wo sie wirken, und gelten nur für den
benannten Fall — nicht als neues Muster.

**SOLLTE-Regeln** sind Empfehlungen. Eine begründete Abweichung ist zulässig und braucht
kein Ausnahmeverfahren, aber eine kurze Notiz, sobald sie wiederkehrt.

**Änderungen.** Eine Änderung dieser Constitution braucht die vorgeschlagene Fassung, die
Begründung, die Auswirkung auf bestehende Artefakte und die Entscheidung des Maintainers.
Änderungen werden versioniert, nicht stillschweigend eingearbeitet.

**Versionierung** (semantisch):

- MAJOR — Prinzip entfernt, neu definiert oder in seiner Wirkung aufgehoben.
- MINOR — Prinzip oder Abschnitt ergänzt, Geltungsbereich wesentlich erweitert.
- PATCH — Klarstellung, Formulierung, Korrektur ohne Bedeutungsänderung.

**Einhaltung.** Die Prüfkriterien der Prinzipien sind die Abnahmegrundlage. Werden
Prinzipien wiederholt auf dieselbe Weise verletzt, ist zu entscheiden: Verhalten
korrigieren oder Regel ändern — die Verletzung wird nicht normalisiert.

**Version**: 1.0.0 | **Ratified**: 2026-09-14 | **Last Amended**: 2026-09-14
