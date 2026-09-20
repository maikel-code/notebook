# Feature Specification: Quellenarbeitsbereich und Studio-Notizen

**Feature Branch**: `codex/002-workspace-sources`

**Created**: 2026-09-20

**Status**: Draft

**Input**: Nach dem ersten Dokument-Upload erhalten Benutzer eine kurze, belegte Orientierung im Chat. Sie arbeiten danach mit Quellen, Chat und Studio: Quellen lassen sich lesen, aus einer Websuche gezielt übernehmen und fertige KI-Antworten als Studio-Notiz sichern.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Erstes Dokument verstehen (Priority: P1)

Ein Benutzer lädt in ein leeres Notebook eine erste geeignete Datei hoch. Sobald sie bereit ist, sieht er sie links in der Quellenliste und im Chat eine kurze, belegte Zusammenfassung mit passenden ersten Fragen.

**Why this priority**: Der Upload wird sofort in einen verständlichen Einstieg in die Quellenarbeit überführt.

**Independent Test**: Ein Benutzer lädt ein lesbares Dokument in ein leeres Notebook und prüft Quellenliste, Zusammenfassung, Verweise und Vorschläge.

**Acceptance Scenarios**:

1. **Given** ein leeres Notebook, **When** die erste gültige Datei bereit wird, **Then** erscheint sie links mit Name, Typ und Status und der Chat zeigt genau eine kurze, quellengebundene Orientierung mit drei bis fünf anklickbaren ersten Fragen.
2. **Given** diese Orientierung, **When** der Benutzer einen Verweis öffnet, **Then** gelangt er nach den bestehenden Belegregeln zur belegten Originalstelle.
3. **Given** eine erste Datei, die fehlschlägt oder nicht nutzbar ist, **When** die Verarbeitung endet, **Then** zeigt der Chat keine scheinbar erfolgreiche Orientierung, sondern den verständlichen Quellenstatus mit Wiederholung, soweit möglich.
4. **Given** ein vorhandener Gesprächsverlauf, **When** eine weitere Datei bereit wird, **Then** wird keine weitere automatische Orientierung eingefügt.

---

### User Story 2 - Quelle lesen und einordnen (Priority: P1)

Ein Benutzer klickt eine Quelle in der linken Spalte an und kann ihren lesbaren Text sowie einen kurzen Überblick zu Inhalt und Herkunft ansehen, ohne den Notebook-Kontext zu verlieren.

**Why this priority**: Der Benutzer muss prüfen können, worauf Antworten und Notizen beruhen.

**Independent Test**: Ein Benutzer mit einer bereiten Datei öffnet sie aus der Quellenliste und prüft Überblick, Text, Seitenbezug und Rückkehr zum Chat.

**Acceptance Scenarios**:

1. **Given** eine bereite Datei, **When** der Benutzer sie auswählt, **Then** sieht er Name, Typ, Aufnahmezeitpunkt, Umfang, Herkunft, Verarbeitungszustand, kurzen Überblick und den extrahierten Text mit Seitenbezug.
2. **Given** eine Quelle ohne extrahierbaren Text oder mit Fehler, **When** der Benutzer sie auswählt, **Then** sieht er Ursache und zulässige nächste Aktion, aber keinen erfundenen Überblick oder Text.
3. **Given** ein Benutzer mit einer fremden Quellenkennung, **When** er sie direkt aufruft, **Then** erhält er weder Überblick noch Text noch einen Existenzhinweis.

---

### User Story 3 - Webquellen finden und gezielt aufnehmen (Priority: P2)

Ein Benutzer sucht im Quellenbereich nach einem Begriff, vergleicht öffentliche Webseiten, öffnet ihre Vorschau und übernimmt nur die Quellen, die er für sein Notebook verwenden will — einzeln oder gesammelt.

**Why this priority**: Recherche ergänzt eigene Dateien, ohne unkontrolliert Inhalte in Antworten einfließen zu lassen.

**Independent Test**: Ein Benutzer sucht, öffnet eine Vorschau, wählt eine Quelle und importiert sie. Erst nach erfolgreicher Verarbeitung ist sie für Fragen wählbar.

**Acceptance Scenarios**:

1. **Given** ein angemeldeter Benutzer, **When** er nach einem Begriff sucht, **Then** sieht er höchstens zehn unterscheidbare öffentliche Webseiten mit Titel, Domain und Kurzbeschreibung oder einen verständlichen Leer- beziehungsweise Fehlerzustand.
2. **Given** angezeigte Ergebnisse, **When** der Benutzer ein Ergebnis ansieht, **Then** sieht er dessen Vorschau, vollständige Zieladresse und einen eindeutig beschrifteten Link zur Originalwebseite, bevor er es übernimmt.
3. **Given** angezeigte Ergebnisse, **When** der Benutzer einzelne oder „alle angezeigten“ auswählt und die Übernahme bestätigt, **Then** werden ausschließlich diese Quellen in das Notebook aufgenommen und mit ihrem Status links gezeigt.
4. **Given** ein nur angesehenes oder ausgewähltes Ergebnis, **When** der Benutzer nicht bestätigt, **Then** wird es weder gespeichert noch für Antworten verwendet.
5. **Given** eine Webquelle mit derselben kanonischen Adresse im Notebook, **When** der Benutzer sie nochmals übernehmen will, **Then** bleibt sie einmalig und der Grund wird erklärt.

---

### User Story 4 - Antwort im Studio sichern (Priority: P2)

Ein Benutzer speichert eine fertige, belegte KI-Antwort als Notiz. Sie erscheint sofort als Eintrag in der rechten Studio-Spalte und bleibt beim erneuten Öffnen erhalten.

**Why this priority**: Relevante Ergebnisse werden aus dem Gesprächsverlauf in einen nutzbaren Arbeitsvorrat überführt.

**Independent Test**: Ein Benutzer erzeugt eine belegte Antwort, speichert sie, öffnet die Notiz und ruft das Notebook erneut auf.

**Acceptance Scenarios**:

1. **Given** eine fertig geprüfte Antwort, **When** der Benutzer „In Notiz speichern“ auswählt, **Then** erscheint genau eine Notiz mit verständlichem Titel und Vorschau im Studio.
2. **Given** eine gespeicherte Notiz, **When** der Benutzer sie öffnet, **Then** sieht er gespeicherten Antworttext, Erstellzeitpunkt und zugehörige Verweise.
3. **Given** eine Notiz mit später entfernter Quelle, **When** der Benutzer ihren Verweis öffnet, **Then** sieht er gespeicherten Wortlaut und „Quelle entfernt“ ohne Dokumentsprung.
4. **Given** eine laufende, abgebrochene, fehlgeschlagene oder ungeprüfte Antwort, **When** der Benutzer sie betrachtet, **Then** kann sie nicht als Notiz gespeichert werden.
5. **Given** eine bereits gespeicherte Antwort, **When** die Aktion erneut ausgelöst wird, **Then** entsteht keine doppelte Notiz und der vorhandene Eintrag bleibt unverändert.

### Edge Cases

- Wird die erste Datei während der Vorbereitung der Orientierung entfernt, erscheint keine erfolgreiche Orientierung und kein aktiver Verweis bleibt zurück.
- Bei langem Text kann der Benutzer alle verfügbaren Teile über nachvollziehbare Seiten- oder Abschnittsnavigation lesen.
- Eine Websuche kann leer sein, fehlschlagen oder zu lange dauern; der Quellenbestand bleibt unverändert und Leer- und Fehlerzustand sind unterscheidbar.
- Eine gewählte Webseite kann nicht gelesen werden, verlangt Anmeldung, ist nicht öffentlich erreichbar oder liefert keinen Text; sie wird nicht als bereit gezeigt und die Ursache wird erklärt.
- Leitet eine Webseite auf eine nicht zulässige oder nicht öffentliche Adresse weiter, wird ihr Inhalt nicht abgerufen und keine Quelle angelegt.
- Bei einer Sammelübernahme können einzelne Quellen scheitern; erfolgreiche Quellen bleiben nutzbar und jeder Endzustand ist sichtbar.
- Schlägt das Speichern einer Notiz wegen einer gelöschten Antwort oder ungültiger Verweise fehl, entsteht keine unvollständige Notiz und der Konflikt wird erklärt.

## Requirements *(mandatory)*

### Functional Requirements

**Arbeitsbereich und erste Orientierung**

- **FR-001**: Das System MUSS im Notebook die drei dauerhaft beschrifteten und per Tastatur erreichbaren Arbeitsbereiche Quellen, Chat und Studio anzeigen.
- **FR-002**: Jede bestätigte hochgeladene oder übernommene Quelle MUSS unmittelbar mit Name, Quelltyp und aktuellem Verarbeitungszustand in der Quellenliste erscheinen.
- **FR-003**: Wird die erste Quelle eines Notebooks bereit und enthält es noch keinen Gesprächsverlauf, MUSS genau eine kurze, KI-generierte Zusammenfassung im Chat erscheinen. Sie DARF keinen ungekürzten Rohtext als Zusammenfassung ausgeben; jede inhaltliche Aussage muss belegt sein und sie enthält drei bis fünf passende, KI-generierte erste Fragen.
- **FR-004**: Die automatische Orientierung DARF erst nach erfolgreicher Verarbeitung erscheinen. Für fehlgeschlagene, nicht nutzbare, entfernte oder unzugreifbare Quellen DARF sie keinen Erfolg, Vorschlag oder aktiven Verweis zeigen.
- **FR-005**: Ein Klick auf einen Vorschlag aus der Orientierung MUSS ihn sofort absenden und alle Vorschläge ausblenden. Eine noch nicht gesendete Eingabe bleibt frei bearbeitbar oder verwerfbar.

**Quellendetailansicht**

- **FR-006**: Benutzer MÜSSEN eigene Quellen aus der Liste auswählen und zum bisherigen Notebook-Kontext zurückkehren können.
- **FR-007**: Eine bereite Quelle MUSS in der Detailansicht mindestens Titel, Typ, Aufnahmezeitpunkt, Status, Umfang, Herkunft, kurzen Überblick und vollständigen verfügbaren extrahierten Text mit Seiten- oder Abschnittsbezug zeigen.
- **FR-008**: Bei großem Textumfang MUSS der Benutzer jeden verfügbaren Teil über nachvollziehbare Navigation erreichen.
- **FR-009**: Bei fehlendem Text MUSS die Detailansicht Ursache und zulässige nächste Aktion statt erfundenem Text oder Überblick zeigen.
- **FR-010**: Quellendetail, Text und Überblick MÜSSEN dieselben Eigentums- und Löschregeln wie Quelle und Originaldatei einhalten; entfernte Quellen dürfen nicht als lesbar erscheinen.

**Websuche und Übernahme**

- **FR-011**: Angemeldete Benutzer MÜSSEN im Quellenbereich nach einem nicht leeren Begriff suchen können.
- **FR-012**: Das System MUSS pro Suche höchstens zehn Ergebnisse öffentlicher Webseiten mit Titel, Domain, Kurzbeschreibung und Auswahlzustand anzeigen; Lade-, Leer- und Fehlerzustand müssen unterscheidbar sein.
- **FR-013**: Jedes Ergebnis MUSS vor der Übernahme eine Vorschau, vollständige Zieladresse und einen eindeutig beschrifteten Link zur Originalwebseite anbieten.
- **FR-014**: Benutzer MÜSSEN Ergebnisse einzeln und gesammelt über „alle angezeigten“ auswählen und die Übernahme ausdrücklich bestätigen können.
- **FR-015**: Webseiten DÜRFEN erst nach ausdrücklicher Bestätigung gespeichert oder für die Verarbeitung abgerufen werden. Suchbegriff, Liste und Vorschau allein dürfen keine Quelle erzeugen.
- **FR-016**: Jede bestätigte Webquelle MUSS einen eigenen Verarbeitungszustand haben und darf erst nach erfolgreicher Verarbeitung für Fragen wählbar sein.
- **FR-017**: Eine bereits vorhandene Webquelle mit derselben kanonischen Zieladresse MUSS pro Notebook erkannt, ohne Duplikat abgelehnt und verständlich erklärt werden.
- **FR-018**: Nicht öffentliche, lokale, anmeldepflichtige, weitergeleitete oder nicht lesbare Zieladressen MÜSSEN abgelehnt werden, ohne dass privater oder lokaler Inhalt sichtbar wird.
- **FR-019**: Jede übernommene Webquelle MUSS Originaladresse und gespeicherte Fassung nachvollziehbar ausweisen. Ihr Verweis muss Quelle, relevante Stelle und Link zur Originalwebseite enthalten.
- **FR-020**: Bei teilweise gescheiterter Sammelübernahme MUSS der Endzustand je Quelle sichtbar sein; erfolgreiche Quellen dürfen nicht zurückgenommen werden.

**Studio-Notizen**

- **FR-021**: Benutzer MÜSSEN jede fertig geprüfte Antwort über eine klar beschriftete Aktion als Notiz speichern können.
- **FR-022**: Eine Notiz MUSS Antworttext, verständlichen Titel, Erstellzeitpunkt und zugehörige Verweise als unveränderlichen Stand bewahren.
- **FR-023**: Eine gespeicherte Notiz MUSS unmittelbar mit Titel und Vorschau im Studio erscheinen und nach erneutem Öffnen des Notebooks vorhanden sein.
- **FR-024**: Benutzer MÜSSEN eigene Notizen öffnen und vollständigen Text sowie Verweise lesen können.
- **FR-025**: Laufende, abgebrochene, fehlgeschlagene oder ungeprüfte Antworten DÜRFEN nicht als Notiz speicherbar sein.
- **FR-026**: Das wiederholte Speichern derselben Antwort MUSS idempotent sein: Es darf höchstens eine zugehörige Notiz geben und sie darf nicht verändert werden.
- **FR-027**: Verweise in Notizen MÜSSEN die bestehenden Regeln für Quelle, Originalwortlaut und entfernte Quellen unverändert einhalten.

**Zugriff, Verständlichkeit und Grenzen**

- **FR-028**: Nur der Notebook-Eigentümer darf dessen Details, Websuche, Vorschauen, Übernahmen, Studio-Notizen und Notizdetails lesen oder verändern. Fremde und anonyme Zugriffe dürfen weder Inhalt noch Existenzhinweis erhalten.
- **FR-029**: Vor Auslieferung MUSS die bestehende Zugriffsmatrix um Quellendetail, Websuche, Vorschau, Übernahme sowie Notiz speichern, auflisten und öffnen erweitert und für Eigentümer, fremdes Konto und anonym geprüft werden.
- **FR-030**: Alle neuen Abläufe MÜSSEN verständliche Lade-, Leer-, Erfolgs- und Fehlerzustände, sichtbaren Fokus, Tastaturbedienung, beschriftete Bedienelemente und zugeordnete Fehlermeldungen bieten.
- **FR-031**: Die neuen Quellen und Notizen MÜSSEN alle bestehenden Grenzen für Quellen, Auswahl, Kontext, Diagnose und Quellenlöschung einhalten.
- **FR-032**: Chat-Antworten und Quellenorientierungen MÜSSEN über `NOTEBOOK_CHAT_PROVIDER=anthropic|openai` und optional `NOTEBOOK_CHAT_MODEL` serverseitig auf Anthropic oder OpenAI umstellbar sein. Der gewählte Anbieter und Schlüssel dürfen nicht an den Client gelangen.

### Key Entities

- **Quellenorientierung**: Einmaliger, belegter Startbeitrag zum ersten bereitgestellten Dokument eines neuen Notebook-Verlaufs mit Zusammenfassung und Fragen.
- **Quellendetail**: Nutzeransicht einer Quelle mit Herkunft, Status, Überblick und lesbarem Text.
- **Websuchergebnis**: Noch nicht gespeicherter Treffer mit Titel, Domain, Kurzbeschreibung, Zieladresse und Auswahlzustand.
- **Webquelle**: Vom Benutzer bestätigte öffentliche Webseite mit kanonischer Adresse, gespeicherter Fassung, Herkunft und Verarbeitungszustand.
- **Studio-Notiz**: Eigentümergebundener, unveränderlicher Schnappschuss einer fertig geprüften Antwort mit Verweisen; gehört zu einem Notebook und einer Antwort.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100 % von zehn dokumentierten Demo-Läufen erscheint nach der ersten erfolgreichen Datei genau eine belegte Orientierung mit drei bis fünf Fragen und ein Quellenlisteneintrag.
- **SC-002**: Ein Benutzer kann in der Demo eine bereite Quelle auswählen, Überblick und jeden verfügbaren Textteil lesen und zum Chat zurückkehren, ohne Notebook-Kontext zu verlieren.
- **SC-003**: In mindestens acht von zehn dokumentierten Demo-Läufen zeigt eine Websuche innerhalb von 8 Sekunden höchstens zehn Ergebnisse oder einen eindeutigen Leer- beziehungsweise Fehlerzustand.
- **SC-004**: In 100 % der dokumentierten Einzel- und Sammelübernahmen werden nur bestätigte Ergebnisse als Quellen angelegt; nicht bestätigte Ergebnisse sind nicht für Fragen wählbar.
- **SC-005**: Ein Benutzer kann eine fertig geprüfte Antwort in unter 30 Sekunden als Notiz speichern, öffnen und nach erneutem Öffnen unverändert wiederfinden.
- **SC-006**: In 100 % der erweiterten Zugriffsmatrixfälle erhalten fremde und anonyme Zugriffe keinen Detailtext, keine Ergebnisse, keine Vorschau, keine Übernahmemöglichkeit und keine Notizinhalte.
- **SC-007**: In 100 % der geprüften Notizen bleiben Verweise bei vorhandenen Quellen auflösbar; nach Quellenlöschung zeigen sie Wortlaut und „Quelle entfernt“ ohne Dokumentsprung.
- **SC-008**: Der Ablauf erste Datei → Orientierung → Quelle prüfen → Webquelle auswählen → Antwort sichern ist per Tastatur ausführbar und zeigt in jedem Schritt einen verständlichen Zustand.

## Assumptions

- Die privaten Notebooks, PDF-Verarbeitung, Belegregeln und der Gesprächsverlauf aus Feature 001 bleiben verbindliche Voraussetzungen.
- Nur das erste erfolgreich bereite Dokument eines Notebook-Verlaufs löst eine automatische Orientierung aus.
- Die Demo-Webrecherche umfasst nur frei zugängliche öffentliche Webseiten mit lesbarem Text; anmeldepflichtige, bezahlte, nicht öffentliche und nicht lesbare Seiten sind ausgenommen.
- „Alle Quellen hinzufügen“ betrifft nur die maximal zehn aktuell angezeigten Ergebnisse; die bestehende Grenze von 30 Quellen pro Notebook bleibt bestehen.
- Studio-Notizen werden im Demo nicht bearbeitet, geteilt oder exportiert.
- Die drei Referenzbilder sind Interaktions- und Layoutvorbild; Audio, Präsentationen, Karten, Quiz und andere Studio-Artefakte gehören nicht zum Umfang.

## Dependencies

- Feature 001 „Quellengebundenes Notebook-Frage-Antwort-System“, insbesondere Zugriffsschutz, Quellenverarbeitung, Verweise und Gesprächsverlauf.
- Ein Suchdienst für öffentliche Webseiten und Zugriff auf vom Benutzer bestätigte öffentliche Webseiten. Auswahl und Ausfallbehandlung werden im Plan begründet.
