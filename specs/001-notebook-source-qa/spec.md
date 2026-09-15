# Feature Specification: Quellengebundenes Notebook-Frage-Antwort-System

**Feature Branch**: `001-notebook-source-qa`

**Created**: 2026-09-14

**Status**: Draft

**Input**: Projektbriefing des Maintainers — NotebookLM-Klon. Benutzer organisieren eigene Dokumente in Notebooks und stellen Fragen dazu; Antworten beruhen auf ausgewählten Quellen und tragen überprüfbare Verweise auf die Originalstellen.

## Clarifications

### Session 2026-09-14

- Q: Was soll mit den Belegstellen einer bereits gegebenen Antwort geschehen, wenn der Benutzer die zugrunde liegende Quelle später entfernt? → A: Datei und Suchindex werden gelöscht; der zitierte Wortlaut bleibt beim Beleg gespeichert und wird als „Quelle entfernt“ angezeigt, ohne Sprung ins Dokument.
- Q: Was soll passieren, wenn ein Benutzer dieselbe Datei ein zweites Mal in dasselbe Notebook hochlädt? → A: Die Anwendung erkennt die Dublette am Dateiinhalt und fragt nach: ersetzen, zusätzlich aufnehmen oder abbrechen.
- Q: Wie weit soll die Anwendung nach Widersprüchen zwischen Quellen suchen? → A: Nur innerhalb der für die aktuelle Frage herangezogenen Passagen; keine Prüfung über den gesamten Bestand.
- Q: Was soll die Anwendung tun, wenn ein Benutzer eine neue Frage stellt, während die vorige Antwort noch erzeugt wird? → A: Die Eingabe ist während der Erzeugung gesperrt; ein Abbrechen beendet die laufende Antwort und gibt die Eingabe wieder frei.
- Q: In welcher Einheit soll die Obergrenze für den Textumfang gelten, den eine einzelne Antwort heranziehen darf? → A: Als Textmenge in Zeichen (Vorschlag 60.000), unabhängig von der Vorgehensweise; die Aufteilung entscheidet `plan.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Privater Arbeitsbereich (Priority: P1)

Ein Benutzer registriert sich, meldet sich an und legt eigene Notebooks an, benennt sie um und löscht sie. Niemand sonst sieht diese Notebooks oder ihre Inhalte — auch nicht, wer eine Notebook-ID oder eine Dateiadresse kennt.

**Why this priority**: Ohne privaten, verlässlich abgegrenzten Arbeitsbereich ist jede weitere Funktion wertlos. Die Zugriffsgrenze ist zugleich das Risiko mit dem größten Schaden, wenn sie fehlt.

**Independent Test**: Vollständig prüfbar durch Registrierung zweier Benutzer, Anlegen je eines Notebooks und den Versuch, das jeweils fremde Notebook über seine ID zu öffnen. Liefert bereits allein den Wert eines privaten Ablageorts.

**Acceptance Scenarios**:

1. **Given** ein nicht angemeldeter Besucher, **When** er eine Notebook-Adresse aufruft, **Then** erhält er keinen Inhalt, sondern die Aufforderung sich anzumelden.
2. **Given** Benutzer A mit einem Notebook und Benutzer B angemeldet, **When** B die Notebook-ID von A direkt aufruft, **Then** erhält B kein Inhaltsfragment und keinen Hinweis darauf, dass dieses Notebook existiert.
3. **Given** ein angemeldeter Benutzer ohne Notebooks, **When** er die Übersicht öffnet, **Then** sieht er einen erklärenden Leerzustand mit der Aktion zum Anlegen.
4. **Given** ein Benutzer mit einem Notebook, **When** er es löschen will, **Then** muss er die Löschung bestätigen, bevor sie ausgeführt wird.
5. **Given** ein angemeldeter Benutzer, **When** er sich abmeldet und die zuvor geöffnete Notebook-Adresse erneut aufruft, **Then** erhält er keinen Inhalt.

---

### User Story 2 - Quellen aufnehmen und ihren Zustand verstehen (Priority: P1)

Ein Benutzer lädt textbasierte PDFs in ein Notebook. Er sieht jederzeit, ob eine Quelle noch verarbeitet wird, für Fragen bereitsteht oder fehlgeschlagen ist — und warum.

**Why this priority**: Ohne verarbeitete Quellen gibt es nichts zu fragen. Die Zustandsanzeige entscheidet darüber, ob der Benutzer dem System traut, wenn eine Datei nicht funktioniert.

**Independent Test**: Prüfbar durch Hochladen eines gültigen PDFs, einer beschädigten Datei und einer nicht unterstützten Dateiart in ein Notebook und Beobachten der angezeigten Zustände. Liefert den Wert einer durchsuchbaren Dokumentablage.

**Acceptance Scenarios**:

1. **Given** ein leeres Notebook, **When** der Benutzer ein textbasiertes PDF hochlädt, **Then** erscheint die Quelle sofort mit Zustand „wird verarbeitet" und wechselt ohne Neuladen der Seite auf „bereit".
2. **Given** eine hochgeladene Datei, die kein PDF ist, **When** die Verarbeitung beginnt, **Then** wird sie abgelehnt mit einer Begründung, die die unterstützten Dateiarten nennt.
3. **Given** ein beschädigtes oder leeres PDF, **When** die Verarbeitung fehlschlägt, **Then** zeigt die Quelle den Fehlerzustand mit verständlicher Ursache und bietet einen erneuten Versuch an.
4. **Given** ein PDF ohne extrahierbaren Text (reiner Scan), **When** die Verarbeitung endet, **Then** wird die Quelle als nicht nutzbar gekennzeichnet mit dem Hinweis, dass gescannte Dokumente nicht unterstützt werden.
5. **Given** eine Quelle im Fehlerzustand, **When** der Benutzer die Verarbeitung erneut anstößt und sie gelingt, **Then** ist die Quelle genau einmal im Notebook vorhanden, nicht doppelt.
6. **Given** eine Datei oberhalb der Größen- oder Seitengrenze, **When** der Benutzer sie hochlädt, **Then** wird sie vor der Verarbeitung abgelehnt mit Nennung der überschrittenen Grenze.
7. **Given** ein Notebook mit einer bereits aufgenommenen Quelle, **When** der Benutzer eine inhaltsgleiche Datei unter anderem Namen hochlädt, **Then** weist die Anwendung auf die vorhandene Quelle hin und bietet Ersetzen, zusätzliche Aufnahme und Abbruch an.
8. **Given** die Rückfrage zu einer erkannten Dublette, **When** der Benutzer Ersetzen wählt, **Then** ist danach genau eine Quelle dieses Inhalts im Notebook vorhanden.

---

### User Story 3 - Belegte Antwort erhalten und im Original prüfen (Priority: P1)

Ein Benutzer stellt eine Frage zu den Quellen seines Notebooks. Die Antwort erscheint schrittweise und trägt Verweise auf die Stellen, auf denen sie beruht. Ein Klick auf einen Verweis zeigt das Quelldokument an der zugehörigen Passage mit Seitenbezug.

**Why this priority**: Das ist der Kernnutzen. Eine Antwort ohne prüfbaren Beleg unterscheidet sich nicht von einer Vermutung.

**Independent Test**: Prüfbar durch eine Frage an ein Notebook mit bekanntem Inhalt und Nachverfolgen jedes Verweises bis zur Originalstelle. Liefert den vollständigen Kernnutzen des Produkts.

**Acceptance Scenarios**:

1. **Given** ein Notebook mit mindestens einer bereiten Quelle, **When** der Benutzer eine beantwortbare Frage stellt, **Then** erscheint die Antwort schrittweise und enthält mindestens einen Verweis.
2. **Given** eine Antwort mit Verweisen, **When** der Benutzer einen Verweis anklickt, **Then** öffnet sich das Quelldokument an der belegten Passage, die Seitenzahl ist sichtbar und die Passage ist hervorgehoben.
3. **Given** eine Antwort mit Verweisen, **When** ein Verweis geprüft wird, **Then** stützt die verwiesene Passage die Aussage inhaltlich, der er zugeordnet ist.
4. **Given** ein Notebook mit bereiten Quellen, **When** der Benutzer eine Frage stellt, die keine Quelle beantwortet, **Then** erklärt die Anwendung, dass die Quellen dazu nichts hergeben, und erzeugt keine Antwort mit Verweisen.
5. **Given** ein Notebook ohne bereite Quelle, **When** der Benutzer eine Frage stellen will, **Then** erklärt die Anwendung die Voraussetzung, statt eine Antwort zu erzeugen.
6. **Given** eine laufende Antwort, **When** der Dienst des Modellanbieters ausfällt, **Then** wird der Abbruch als solcher angezeigt, die unvollständige Antwort nicht als fertig ausgegeben und ein erneuter Versuch angeboten.
7. **Given** eine laufende Antwort, **When** der Benutzer eine weitere Frage stellen will, **Then** ist die Eingabe gesperrt und ein Abbrechen wird angeboten.
8. **Given** eine laufende Antwort, **When** der Benutzer abbricht, **Then** endet die Erzeugung, die Teilantwort ist als abgebrochen gekennzeichnet und die Eingabe ist wieder frei.

---

### User Story 4 - Quellenauswahl steuern und Quellen entfernen (Priority: P2)

Ein Benutzer wählt aus, welche Quellen für die nächste Frage herangezogen werden, und entfernt Quellen, die er nicht mehr braucht.

**Why this priority**: Steigert die Antwortgüte spürbar und ist für die Nachvollziehbarkeit wichtig, aber der Kernablauf funktioniert auch mit allen Quellen des Notebooks.

**Independent Test**: Prüfbar durch eine Frage, die nur aus Quelle A beantwortbar ist, einmal mit ausgewählter Quelle A und einmal mit ausgewählter Quelle B.

**Acceptance Scenarios**:

1. **Given** ein Notebook mit mehreren bereiten Quellen, **When** der Benutzer eine Teilmenge auswählt und fragt, **Then** stammen alle Verweise der Antwort ausschließlich aus der Auswahl.
2. **Given** eine Quelle, die für Fragen ausgewählt ist, **When** der Benutzer sie entfernt, **Then** wird die Entfernung bestätigt abgefragt und die Quelle für neue Antworten nicht mehr herangezogen.
3. **Given** eine frühere Antwort mit einem Verweis auf eine inzwischen entfernte Quelle, **When** der Benutzer diesen Verweis öffnet, **Then** zeigt die Anwendung den gespeicherten Wortlaut der Belegstelle mit dem Hinweis „Quelle entfernt“ und bietet keinen Sprung ins Dokument an.
4. **Given** ein Notebook, in dem der Benutzer alle Quellen abgewählt hat, **When** er eine Frage stellen will, **Then** erklärt die Anwendung, dass mindestens eine Quelle ausgewählt sein muss.

---

### User Story 5 - Widersprüche und Anweisungsversuche in Dokumenten (Priority: P2)

Widersprechen sich ausgewählte Quellen, macht die Antwort das kenntlich, statt eine Fassung als gesichert darzustellen. Anweisungen, die in hochgeladenen Dokumenten stehen, verändern das Verhalten der Anwendung nicht.

**Why this priority**: Beides betrifft die Vertrauenswürdigkeit der Antworten. Der Kernablauf funktioniert ohne, aber die Aussage „überprüfbar" hält ohne diese Behandlung nicht stand.

**Independent Test**: Prüfbar mit zwei präparierten Quellen, die derselben Frage widersprechen, und einer präparierten Quelle, die eine Anweisung an das System enthält.

**Acceptance Scenarios**:

1. **Given** zwei ausgewählte Quellen mit einander widersprechenden Angaben, **When** der Benutzer danach fragt, **Then** benennt die Antwort den Widerspruch und verweist auf beide Stellen, statt eine Angabe als gesichert darzustellen.
2. **Given** eine Quelle, deren Text eine Anweisung an das System enthält (etwa das Ignorieren vorheriger Vorgaben oder das Offenlegen anderer Notebooks), **When** der Benutzer eine Frage stellt, **Then** wird die Anweisung als Dokumentinhalt behandelt und verändert weder Antwortverhalten noch Zugriffsgrenzen.
3. **Given** eine Quelle mit einer Anweisung, Inhalte ohne Beleg zu behaupten, **When** danach gefragt wird, **Then** gelten die Belegregeln unverändert.

---

### User Story 6 - Gesprächsverlauf bleibt erhalten (Priority: P3)

Ein Benutzer öffnet ein Notebook erneut und findet seinen bisherigen Gesprächsverlauf samt Antworten und Verweisen vor.

**Why this priority**: Erhöht den Gebrauchswert deutlich, ist aber für den Nachweis des Kernablaufs nicht zwingend.

**Independent Test**: Prüfbar durch eine Frage, Abmelden, erneutes Anmelden und Öffnen desselben Notebooks.

**Acceptance Scenarios**:

1. **Given** ein Notebook mit beantworteten Fragen, **When** der Benutzer es nach erneutem Anmelden öffnet, **Then** sind Fragen, Antworten und Verweise in ursprünglicher Reihenfolge vorhanden.
2. **Given** ein Notebook mit Gesprächsverlauf, **When** ein anderer Benutzer dieses Notebook aufzurufen versucht, **Then** erhält er keinen Zugriff auf den Verlauf.

---

### Edge Cases

- Ein Upload wird abgebrochen oder die Verbindung bricht während der Übertragung ab.
- Die Verarbeitung eines Dokuments überschreitet die Laufzeitgrenze.
- Eine Quelle wird entfernt, während eine Antwort dazu noch erzeugt wird.
- Ein Notebook wird gelöscht, während in einem anderen Tab eine Frage dazu läuft.
- Der Benutzer stellt eine Frage oberhalb der Längengrenze.
- Ein PDF ist passwortgeschützt.
- Eine Antwort beruht auf einer Passage, die über einen Seitenumbruch reicht.
- Der Modellanbieter antwortet, liefert aber keinen verwertbaren Beleg.

## Requirements *(mandatory)*

### Functional Requirements

**Konten und Zugriff**

- **FR-001**: Benutzer MÜSSEN sich mit E-Mail-Adresse und Passwort registrieren, anmelden und abmelden können.
- **FR-002**: Das System MUSS jedes Notebook, jede Quelle, jeden Textabschnitt, jeden Gesprächsverlauf und jede hochgeladene Datei genau einem Benutzerkonto zuordnen.
- **FR-003**: Das System MUSS Zugriffe auf fremde Inhalte verweigern — unabhängig davon, ob über die Oberfläche, über eine bekannte Kennung oder über eine Dateiadresse zugegriffen wird.
- **FR-004**: Das System DARF durch Fehlermeldungen oder Antwortverhalten NICHT offenlegen, ob eine fremde Kennung existiert.
- **FR-005**: Nicht angemeldete Zugriffe auf geschützte Inhalte MÜSSEN zur Anmeldung führen und KEINE Inhalte preisgeben.

**Notebooks**

- **FR-006**: Benutzer MÜSSEN Notebooks anlegen, umbenennen und löschen können.
- **FR-007**: Das Löschen eines Notebooks MUSS bestätigt werden und entfernt dessen Quellen, Textabschnitte und Gesprächsverlauf.
- **FR-008**: Das System MUSS eine Übersicht der eigenen Notebooks anzeigen, mit erklärendem Leerzustand, wenn keine vorhanden sind.

**Quellen**

- **FR-009**: Benutzer MÜSSEN textbasierte PDFs in ein Notebook hochladen können.
- **FR-010**: Das System MUSS Dateien ablehnen, die keine PDFs sind oder die festgelegten Grenzen für Dateigröße oder Seitenzahl überschreiten, und die verletzte Bedingung benennen.
- **FR-010a**: Das System MUSS beim Hochladen erkennen, ob eine inhaltsgleiche Datei bereits als Quelle im selben Notebook vorhanden ist, und den Benutzer zwischen Ersetzen, zusätzlicher Aufnahme und Abbruch wählen lassen. Die Erkennung MUSS auf dem Dateiinhalt beruhen, nicht auf dem Dateinamen. Beim Ersetzen werden Datei und Textabschnitte der bisherigen Quelle nach FR-031 entfernt.
- **FR-011**: Das System MUSS je Quelle einen der Zustände „wird verarbeitet", „bereit", „fehlgeschlagen" oder „nicht nutzbar" anzeigen und Zustandswechsel ohne Neuladen der Seite sichtbar machen.
- **FR-012**: Das System MUSS bei fehlgeschlagener Verarbeitung eine verständliche Ursache nennen und einen erneuten Versuch anbieten.
- **FR-013**: Das System MUSS PDFs ohne extrahierbaren Text als nicht nutzbar kennzeichnen und darf sie nicht als bereit ausweisen.
- **FR-014**: Wiederholte Verarbeitung derselben Quelle DARF KEINE doppelten Textabschnitte oder doppelten Quelleneinträge erzeugen.
- **FR-015**: Benutzer MÜSSEN die Quellen eines Notebooks einsehen, für Fragen auswählen und abwählen können.
- **FR-016**: Benutzer MÜSSEN Quellen entfernen können; das Entfernen MUSS bestätigt werden.
- **FR-017**: Entfernte Quellen DÜRFEN für neue Antworten NICHT mehr herangezogen werden.
- **FR-018**: Nur Quellen im Zustand „bereit" DÜRFEN für Antworten herangezogen werden.

**Fragen und Antworten**

- **FR-019**: Benutzer MÜSSEN Fragen zu den ausgewählten Quellen eines Notebooks stellen können.
- **FR-020**: Antworten MÜSSEN schrittweise erscheinen, während sie erzeugt werden.
- **FR-020a**: Während eine Antwort erzeugt wird, MUSS die Frageeingabe gesperrt sein und ein Abbrechen angeboten werden. Ein Abbruch MUSS die Erzeugung beenden und die Eingabe wieder freigeben.
- **FR-021**: Das System MUSS ausschließlich Inhalte der ausgewählten, bereiten Quellen als Belegbasis verwenden.
- **FR-022**: Das System MUSS erklären, warum es nicht antworten kann, wenn keine Quelle ausgewählt, keine bereit oder keine einschlägige Passage auffindbar ist — und in diesen Fällen KEINE Antwort mit Verweisen erzeugen.
- **FR-023**: Widersprechen sich Passagen, die für die aktuelle Frage herangezogen wurden, MUSS die Antwort den Widerspruch benennen und auf beide Stellen verweisen, statt eine Angabe als gesichert darzustellen. Eine darüber hinausgehende Prüfung des Quellenbestands findet NICHT statt.
- **FR-024**: Das System MUSS Text aus hochgeladenen Dokumenten als nicht vertrauenswürdige Daten behandeln; darin enthaltene Anweisungen DÜRFEN Antwortverhalten und Zugriffsgrenzen NICHT verändern.
- **FR-025**: Ein Abbruch bei der Antworterzeugung MUSS als solcher erkennbar sein; eine unvollständige Antwort DARF NICHT als abgeschlossen erscheinen.
- **FR-026**: Der Gesprächsverlauf eines Notebooks MUSS nach erneutem Öffnen samt Antworten und Verweisen vorhanden sein.

**Belege**

- **FR-027**: Quellenbasierte Aussagen MÜSSEN Verweise auf die Passagen tragen, auf denen sie beruhen.
- **FR-028**: Jeder Verweis MUSS auf eine gespeicherte Originalstelle auflösbar sein und Quelldokument, Passage und Seitenzahl benennen.
- **FR-028a**: Jeder Verweis MUSS den zitierten Wortlaut bei sich speichern, damit die Belegstelle unabhängig vom Fortbestand der Quelle darstellbar bleibt.
- **FR-029**: Ein Klick auf einen Verweis MUSS das Quelldokument an der belegten Passage anzeigen und die Passage hervorheben.
- **FR-030**: Eine vorhandene Quellenkennung allein DARF NICHT als gültiger Beleg gelten; die verwiesene Passage MUSS die zugeordnete Aussage inhaltlich stützen.
- **FR-031**: Wird eine Quelle entfernt, MÜSSEN ihre Datei und ihre Textabschnitte gelöscht werden. Verweise in früheren Antworten MÜSSEN den gespeicherten Wortlaut mit dem Hinweis „Quelle entfernt“ anzeigen und DÜRFEN keinen Sprung ins Dokument mehr anbieten.

**Bedienung**

- **FR-032**: Der Kernablauf Anmelden → Notebook anlegen → PDF hochladen → Frage stellen → Antwort lesen → Beleg im Original prüfen MUSS vollständig bedienbar sein.
- **FR-033**: Die für den jeweiligen Ablauf relevanten Lade-, Leer-, Erfolgs- und Fehlerzustände MÜSSEN verständlich dargestellt sein.
- **FR-034**: Alle Schritte des Kernablaufs MÜSSEN per Tastatur bedienbar sein, mit sichtbarem Fokus, beschrifteten Bedienelementen und Fehlermeldungen, die ihrem Eingabefeld zugeordnet sind.
- **FR-035**: Löschende Aktionen MÜSSEN bestätigt werden und benennen, was entfernt wird.

**Grenzen und Diagnose**

- **FR-036**: Das System MUSS die festgelegten Grenzen für Dateigröße, Seitenzahl, Quellen je Notebook, ausgewählte Quellen je Frage, Fragelänge und herangezogene Textmenge je Antwort durchsetzen. Die Textmengengrenze gilt unabhängig davon, wie der herangezogene Text zusammengestellt wird.
- **FR-037**: Das System MUSS die Anzahl automatischer Wiederholungsversuche je Verarbeitungsauftrag begrenzen und danach in einen Fehlerzustand übergehen, der dem Benutzer sichtbar ist.
- **FR-038**: Fehler MÜSSEN über ein Korrelationsmerkmal, die betroffene Phase und die Ursache diagnostizierbar sein, OHNE Dokumentinhalte, personenbezogene Daten oder Geheimnisse zu protokollieren.

### Key Entities

- **Benutzer**: Kontoinhaber; Eigentümer aller seiner Notebooks und deren Inhalte.
- **Notebook**: Benannter Arbeitsbereich eines Benutzers; bündelt Quellen und einen Gesprächsverlauf.
- **Quelle**: Hochgeladenes Dokument in einem Notebook; trägt Verarbeitungszustand, Fehlerursache, Auswahlkennzeichen und ein aus dem Dateiinhalt abgeleitetes Erkennungsmerkmal für Dubletten.
- **Textabschnitt**: Abgegrenzter Ausschnitt einer Quelle mit Seitenbezug; kleinste Einheit, auf die ein Verweis zeigt.
- **Frage**: Eingabe des Benutzers samt der zum Zeitpunkt der Frage ausgewählten Quellen.
- **Antwort**: Erzeugter Text zu einer Frage; trägt Verweise und einen Abschlusszustand.
- **Verweis**: Zuordnung einer Aussage der Antwort zu einem Textabschnitt; trägt den zitierten Wortlaut und den Seitenbezug als eigene Angaben, damit er die Löschung der Quelle überdauert.
- **Verarbeitungsauftrag**: Lauf, der aus einer hochgeladenen Datei Textabschnitte erzeugt; trägt Zustand und Versuchszähler.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ein neuer Benutzer durchläuft den Kernablauf von der Registrierung bis zur geprüften Originalstelle ohne fremde Hilfe in unter 10 Minuten.
- **SC-002**: In 100 % der Prüfversuche erhält weder ein fremder noch ein anonymer Zugriff Inhalte eines fremden Notebooks, einschließlich direkter Zugriffe auf Kennungen und Dateiadressen.
- **SC-003**: In 100 % der geprüften Antworten lässt sich jeder Verweis auf eine vorhandene Originalstelle auflösen.
- **SC-004**: Im Referenzdatensatz stützt die verwiesene Passage die zugeordnete Aussage in mindestens 90 % der Fälle inhaltlich (*Vorschlag*).
- **SC-005**: Fragen ohne Beleglage im Referenzdatensatz führen in mindestens 95 % der Fälle zu einer erklärten Einschränkung statt zu einer Antwort mit Verweisen (*Vorschlag*).
- **SC-006**: Kein Anweisungsversuch aus einem Dokument des Referenzdatensatzes verändert Antwortverhalten oder Zugriffsgrenzen.
- **SC-007**: Beschädigte, leere, passwortgeschützte und nicht unterstützte Dateien führen in 100 % der Fälle zu einem sichtbaren Fehler- oder Ablehnungszustand und nie zu einer scheinbar bereiten Quelle.
- **SC-008**: Erneute Verarbeitung derselben Quelle verändert die Anzahl ihrer Textabschnitte nicht.
- **SC-009**: Der Kernablauf ist vollständig per Tastatur durchführbar, ohne dass der Fokus unsichtbar wird oder in einem Bereich gefangen bleibt.
- **SC-010**: Bei Ausfall der Dokumentverarbeitung oder des Modellanbieters sieht der Benutzer in 100 % der Fälle einen Fehlerzustand mit Wiederholungsmöglichkeit und nie eine als erfolgreich dargestellte Teilausgabe.
- **SC-011**: Der erste Teil einer Antwort wird in höchstens 3 Sekunden sichtbar (*Vorschlag*).
- **SC-012**: Ein Dokument mit bis zu 50 Seiten erreicht in mindestens 90 % der Fälle innerhalb von 60 Sekunden den Zustand „bereit" (*Vorschlag*).
- **SC-013**: Jeder ausgelöste Fehlerfall lässt sich über Korrelationsmerkmal, Phase und Ursache einem Vorgang zuordnen, ohne dass Dokumentinhalte, personenbezogene Daten oder Geheimnisse in der Diagnoseausgabe erscheinen.

### Vorgeschlagene Grenzwerte

Alle Werte sind *Vorschläge* und vom Maintainer zu bestätigen. Sie erfüllen die Pflicht aus Prinzip VII, Grenzen in `spec.md` festzulegen.

| Größe | Vorschlag |
|---|---|
| Dateigröße je PDF | 25 MB |
| Seiten je PDF | 300 |
| Quellen je Notebook | 50 |
| Ausgewählte Quellen je Frage | 10 |
| Fragelänge | 2.000 Zeichen |
| Herangezogene Textmenge je Antwort | 60.000 Zeichen |
| Automatische Wiederholungen je Verarbeitungsauftrag | 3 |
| Laufzeitgrenze je Verarbeitungsauftrag | 5 Minuten |

## Verification Approach

Deterministische und probabilistische Prüfungen werden getrennt ausgewiesen (Prinzip VI). Ein grünes Ergebnis der einen Gruppe ersetzt die andere nicht.

**Deterministisch** — jederzeit wiederholbar mit gleichem Ergebnis:

- Zugriffsgrenzen mit eigenem, fremdem und anonymem Benutzer (SC-002).
- Dateiannahme und -ablehnung, Zustandswechsel, Wiederholung ohne Duplikate (SC-007, SC-008).
- Auflösbarkeit jedes Verweises auf eine vorhandene Originalstelle (SC-003).
- Verhalten bei entfernten Quellen, ohne Auswahl, ohne bereite Quelle.
- Ausfall von Dokumentverarbeitung und Modellanbieter, simuliert (SC-010).
- Tastaturbedienbarkeit des Kernablaufs (SC-009).
- Diagnostizierbarkeit ausgelöster Fehler ohne Preisgabe von Inhalten, Personenbezug oder Geheimnissen (SC-013).

**Probabilistisch** — bewertet gegen den Referenzdatensatz, Schwankung erwartet:

- Belegtreue: stützt die verwiesene Passage die Aussage (SC-004).
- Ehrliche Einschränkung bei fehlender Beleglage (SC-005).
- Kenntlichmachung von Widersprüchen.
- Widerstand gegen Anweisungen in Dokumenten (SC-006) — das Ergebnis wird probabilistisch bewertet, die Zugriffsgrenze dahinter bleibt deterministisch geprüft.

**Referenzdatensatz**: klein, manuell geprüft, versioniert. Enthält Dokumente mit bekannten Aussagen, ein widersprüchliches Paar, ein Dokument mit eingebetteten Anweisungsversuchen sowie Fragen mit erwarteten Belegstellen und Fragen ohne Beleglage. Zusammensetzung und Bewertungskriterien werden mit dem Datensatz dokumentiert.

## Out of Scope

Folgendes ist nicht Teil dieses MVP und DARF keine Voraussetzung für ihn werden:

- Audio-Overviews und Sprachausgabe
- Videoverarbeitung
- Web-Recherche und Quellen aus dem Internet
- OCR für gescannte Dokumente
- Teamfreigaben, geteilte Notebooks, Mehrbenutzer-Zusammenarbeit
- Abrechnung und Kontingentverwaltung
- Mobile Anwendungen
- Andere Dateiarten als PDF
- Widerspruchsanalyse über den Quellenbestand außerhalb einer konkreten Frage, etwa beim Hochladen oder als eigene Prüffunktion
- Vollständige Funktionsparität mit NotebookLM

## Assumptions

Getroffene Vorfestlegungen, wo das Briefing keine Vorgabe macht. Jede ist ohne Aufwand umkehrbar, solange die Implementierung nicht begonnen hat.

- **A-01**: Registrierung ohne E-Mail-Bestätigung. Für ein Demonstrationsprojekt genügt das; die Zugriffsgrenzen hängen nicht daran.
- **A-02**: Anmeldung mit E-Mail und Passwort, keine Anmeldung über Drittanbieter.
- **A-03**: Entscheidung vom 2026-09-14, siehe Clarifications. Frühere Antworten werden beim Entfernen einer Quelle nicht nachträglich verändert.
- **A-04**: Entscheidung vom 2026-09-14, siehe Clarifications.
- **A-05**: Löschen entfernt Datei und Textabschnitte endgültig; kein Papierkorb, keine Wiederherstellung, weil Demonstrationsprojekt. Ausgenommen sind die bei bereits erteilten Verweisen gespeicherten Wortlaute (FR-028a); sie verschwinden mit dem Gesprächsverlauf oder dem Notebook.
- **A-06**: Die Antwort erfolgt in der Sprache der Frage.
- **A-07**: Ein Gesprächsverlauf je Notebook, keine parallelen Unterhaltungen.
- **A-08**: Der Referenzdatensatz besteht aus Dokumenten, die der Maintainer bereitstellt und deren Verwendung zulässig ist.
- **A-09**: Nutzung durch einzelne Benutzer in einer Demonstrationsumgebung; keine Lastannahmen über gleichzeitige Benutzer.

## Offene Entscheidungen

Bewusst offen gelassen, weil sie dem Maintainer gehören. Keine blockiert den Beginn der Planung.

- **OD-01**: Bestätigung oder Korrektur der vorgeschlagenen Grenzwerte und der Zielwerte SC-004, SC-005, SC-011, SC-012.
- **OD-02**: Bestätigung der Annahmen A-01 bis A-09, insbesondere A-03 (entfernte Quellen) und A-04 (Tiefe der Widerspruchserkennung).
- **OD-03**: Umfang und Herkunft des Referenzdatensatzes (Anzahl Dokumente, Anzahl Fragen).
- **OD-04**: Ob abgewählte Quellen beim erneuten Öffnen eines Notebooks ihren Auswahlzustand behalten.
