# Feature Specification: Quellengebundenes Notebook-Frage-Antwort-System

**Feature Branch**: `001-notebook-source-qa`

**Created**: 2026-09-14

**Status**: Approved — Maintainer-Freigabe vom 2026-09-19

**Input**: Projektbriefing des Maintainers — NotebookLM-Klon. Benutzer organisieren eigene Dokumente in Notebooks und stellen Fragen dazu; Antworten beruhen auf ausgewählten Quellen und tragen überprüfbare Verweise auf die Originalstellen.

## Clarifications

### Session 2026-09-14

- Q: Was soll mit den Belegstellen einer bereits gegebenen Antwort geschehen, wenn der Benutzer die zugrunde liegende Quelle später entfernt? → A: Datei und Suchindex werden gelöscht; der zitierte Wortlaut bleibt beim Beleg gespeichert und wird als „Quelle entfernt“ angezeigt, ohne Sprung ins Dokument.
- Q: Was soll passieren, wenn ein Benutzer dieselbe Datei ein zweites Mal in dasselbe Notebook hochlädt? → A: Die Anwendung erkennt die Dublette am Dateiinhalt und fragt nach: ersetzen, zusätzlich aufnehmen oder abbrechen.
- Q: Wie weit soll die Anwendung nach Widersprüchen zwischen Quellen suchen? → A: Nur innerhalb der für die aktuelle Frage herangezogenen Passagen; keine Prüfung über den gesamten Bestand.
- Q: Was soll die Anwendung tun, wenn ein Benutzer eine neue Frage stellt, während die vorige Antwort noch erzeugt wird? → A: Die Eingabe ist während der Erzeugung gesperrt; ein Abbrechen beendet die laufende Antwort und gibt die Eingabe wieder frei.
- Q: In welcher Einheit soll die Obergrenze für den Textumfang gelten, den eine einzelne Antwort heranziehen darf? → A: Als Textmenge in Zeichen, festgelegt auf 60.000, unabhängig von der Vorgehensweise; die Aufteilung entscheidet `plan.md`.

### Session 2026-09-19

- Q: Welche vorgeschlagenen Werte und Annahmen gelten für das Demo? → A: Die Grenzwerte und Annahmen dieses Dokuments sind freigegeben. Die manuell angepassten Werte 10 MB, 50 Seiten, 30 Quellen und 5 Sekunden bis zum ersten Antwortteil sind verbindlich.
- Q: Bleibt die Quellenauswahl nach erneutem Öffnen erhalten? → A: Ja, die Auswahl wird je Quelle persistent gespeichert.
- Q: Wie wird Belegqualität einfach und überprüfbar getrennt? → A: Herkunft und Wortlaut eines angezeigten Verweises werden deterministisch geprüft; inhaltliche Stützung und ehrliche Einschränkung werden getrennt am Referenzdatensatz berichtet und sind kein Freigabetor.
- Q: Was geschieht bei Löschungen während einer laufenden Antwort? → A: Quellen- und Notebook-Löschung werden mit verständlichem Konflikthinweis abgelehnt, bis die Antwort beendet oder abgebrochen ist.
- Q: Wie soll das System entscheiden, dass trotz vorhandener Quellen keine einschlägige Passage gefunden wurde? → A: Es verwendet eine Top-k-Suche mit einem am versionierten Referenzdatensatz kalibrierten Mindestwert für die Ähnlichkeit.
- Q: Wann soll beim Ersetzen einer inhaltsgleichen Datei die bisherige Quelle gelöscht werden? → A: Erst nach erfolgreicher Übertragung der neuen Datei; anschließend wird die alte Quelle entfernt und die neue Verarbeitung gestartet.
- Q: Was soll geschehen, wenn der Benutzer eine wegen Anbieterfehler fehlgeschlagene Antwort erneut versucht? → A: Der fehlgeschlagene Versuch bleibt sichtbar; für dieselbe Frage wird ein neuer Antwortversuch angehängt.
- Q: Was soll das System tun, wenn eine fertig erzeugte Antwort mindestens eine quellenbasierte Aussage ohne gültigen Verweis enthält? → A: Die gesamte Antwort wird als erfolgreiche Antwort verworfen; der Entwurf bleibt dauerhaft als ungeprüft und nicht belegt gekennzeichnet sichtbar, mit einer erklärten Einschränkung darunter und ohne aktive Verweise.
- Q: Woran soll die Belegprüfung technisch erkennen, dass jede quellenbasierte Aussage einen gültigen Verweis besitzt? → A: Eine erfolgreiche Antwort enthält pro Absatz genau eine quellenbasierte Aussage; jeder solche Absatz endet mit mindestens einem gültigen Verweis.
- Q: Wie soll die Anwendung reagieren, wenn die Frage nicht durchsuchbar gemacht werden kann, weil der dafür zuständige Dienst nicht erreichbar ist? → A: Eigener Fehlerzustand mit Wiederholung, klar getrennt von fehlender Beleglage; keine Aussage über die Quellenlage.
- Q: Woran erkennt die Belegprüfung, ob ein Absatz eine quellenbasierte Aussage enthält und damit einen Verweis braucht? → A: Jeder Absatz braucht einen Verweis; ausgenommen sind ausschließlich die von der Anwendung selbst erzeugten festen Status- und Einschränkungstexte.
- Q: Was sieht ein Benutzer, der eine Antwort mitgelesen hat, wenn die Belegprüfung sie danach vollständig verwirft? → A: Der Entwurfstext bleibt sichtbar, unmissverständlich als ungeprüft und nicht belegt gekennzeichnet, mit der erklärten Einschränkung darunter.
- Q: Soll ein als unbelegt gekennzeichneter Entwurf im Gesprächsverlauf erhalten bleiben? → A: Ja, Entwurf und Kennzeichnung werden gespeichert und erscheinen beim erneuten Öffnen unverändert markiert.
- Q: Wo soll die Zugriffsmatrix festgelegt werden, auf die sich SC-002 beruft? → A: Als vollständige Tabelle in `spec.md`, Zeilen je geschützter Oberfläche, Spalten Eigentümer / fremdes Konto / anonym.

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
8. **Given** die Rückfrage zu einer erkannten Dublette, **When** der Benutzer Ersetzen wählt und die neue Datei erfolgreich übertragen wurde, **Then** wird die alte Quelle entfernt und die neue Verarbeitung gestartet; danach ist genau eine Quelle dieses Inhalts im Notebook vorhanden.
9. **Given** der Benutzer hat bei einer Dublette Ersetzen gewählt, **When** die neue Übertragung abbricht, **Then** bleibt die bisherige Quelle unverändert erhalten und es startet keine neue Verarbeitung.

---

### User Story 3 - Belegte Antwort erhalten und im Original prüfen (Priority: P1)

Ein Benutzer stellt eine Frage zu den Quellen seines Notebooks. Die Antwort erscheint schrittweise und trägt Verweise auf die Stellen, auf denen sie beruht. Ein Klick auf einen Verweis zeigt das Quelldokument an der zugehörigen Passage mit Seitenbezug.

**Why this priority**: Das ist der Kernnutzen. Eine Antwort ohne prüfbaren Beleg unterscheidet sich nicht von einer Vermutung.

**Independent Test**: Prüfbar durch eine Frage an ein Notebook mit bekanntem Inhalt und Nachverfolgen jedes Verweises bis zur Originalstelle. Liefert den vollständigen Kernnutzen des Produkts.

**Acceptance Scenarios**:

1. **Given** ein Notebook mit mindestens einer bereiten Quelle, **When** der Benutzer eine beantwortbare Frage stellt, **Then** erscheint die Antwort schrittweise und enthält mindestens einen Verweis.
2. **Given** eine Antwort mit Verweisen, **When** der Benutzer einen Verweis anklickt, **Then** öffnet sich das Quelldokument auf der belegten Seite und die Passage ist hervorgehoben; ist der Wortlaut in der Textebene nicht auffindbar, wird er daneben angezeigt.
3. **Given** eine Antwort mit Verweisen, **When** ein Verweis technisch geprüft wird, **Then** zeigt er auf einen tatsächlich abgerufenen Abschnitt einer ausgewählten, bereiten Quelle und sein gespeicherter Wortlaut kommt dort vor. Die inhaltliche Stützung der Aussage wird getrennt am Referenzdatensatz bewertet.
4. **Given** ein Notebook mit bereiten Quellen, **When** der Benutzer eine Frage stellt, die keine Quelle beantwortet, **Then** erklärt die Anwendung, dass die Quellen dazu nichts hergeben, und erzeugt keine Antwort mit Verweisen.
5. **Given** ein Notebook ohne bereite Quelle, **When** der Benutzer eine Frage stellen will, **Then** erklärt die Anwendung die Voraussetzung, statt eine Antwort zu erzeugen.
6. **Given** eine laufende Antwort, **When** der Dienst des Modellanbieters ausfällt, **Then** wird der Fehler als solcher angezeigt, die unvollständige Antwort nicht als fertig ausgegeben und ein erneuter Versuch angeboten.
7. **Given** eine laufende Antwort, **When** der Benutzer eine weitere Frage stellen will, **Then** ist die Eingabe gesperrt und ein Abbrechen wird angeboten.
8. **Given** eine laufende Antwort, **When** der Benutzer abbricht, **Then** endet die Erzeugung, die provisorische Teilantwort wird verworfen, der Versuch wird als „abgebrochen“ angezeigt und die Eingabe ist wieder frei.
9. **Given** eine fehlgeschlagene Antwort, **When** der Benutzer „Erneut versuchen“ auswählt, **Then** bleibt der fehlgeschlagene Versuch sichtbar und für dieselbe Frage wird ein neuer Antwortversuch angehängt.
10. **Given** eine fertig erzeugte Antwort, **When** die Belegprüfung abgeschlossen wird, **Then** enthält jeder Absatz außer den festen Status- und Einschränkungstexten genau eine quellenbasierte Aussage und endet mit mindestens einem gültigen Verweis.
11. **Given** eine Antwort, die die Belegprüfung nicht besteht, **When** sie angezeigt wird, **Then** bleibt der Entwurfstext sichtbar, ist unmissverständlich als ungeprüft und nicht belegt gekennzeichnet, trägt die erklärte Einschränkung darunter und bietet keine anklickbaren Verweise an.
12. **Given** ein Notebook mit bereiten, ausgewählten Quellen, **When** der für die Suche zuständige Dienst nicht erreichbar ist, **Then** erscheint ein Fehlerzustand mit „Erneut versuchen“ und keine Aussage darüber, ob die Quellen zur Frage etwas hergeben.

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
5. **Given** ein Benutzer mit ausgewählten und abgewählten Quellen, **When** er das Notebook erneut öffnet, **Then** ist derselbe Auswahlzustand wiederhergestellt.

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
3. **Given** ein Verlauf mit einer als unbelegt verworfenen Antwort, **When** der Benutzer das Notebook erneut öffnet, **Then** ist der Entwurf weiterhin sichtbar und unverändert als ungeprüft und nicht belegt gekennzeichnet.

---

### Edge Cases

- Ein abgebrochener Upload zeigt einen Fehler, erzeugt keinen Verarbeitungsauftrag und kann als vollständiger Upload neu gestartet werden. Beim Ersetzen bleibt die bisherige Quelle unverändert erhalten. Eine physische Bereinigung verwaister Storage-Objekte ist für das Demo nicht Teil der Abnahme.
- Die Verarbeitung eines Dokuments überschreitet die Laufzeitgrenze.
- Eine Quelle wird während einer laufenden Antwort nicht entfernt; der Löschversuch wird bis zum Ende oder Abbruch der Antwort abgelehnt.
- Ein Notebook wird während einer laufenden Antwort nicht gelöscht; der Löschversuch wird bis zum Ende oder Abbruch der Antwort abgelehnt.
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
- **FR-010a**: Das System MUSS beim Hochladen erkennen, ob eine inhaltsgleiche Datei bereits als Quelle im selben Notebook vorhanden ist, und den Benutzer zwischen Ersetzen, zusätzlicher Aufnahme und Abbruch wählen lassen. Die Erkennung MUSS auf dem Dateiinhalt beruhen, nicht auf dem Dateinamen. Beim Ersetzen bleibt die bisherige Quelle bis zur bestätigten Übertragung der neuen Datei unverändert erhalten; erst danach werden Datei und Textabschnitte der bisherigen Quelle nach FR-031 entfernt und die neue Verarbeitung gestartet.
- **FR-011**: Das System MUSS je Quelle einen der Zustände „wird verarbeitet", „bereit", „fehlgeschlagen" oder „nicht nutzbar" anzeigen und Zustandswechsel ohne Neuladen der Seite sichtbar machen. Die internen Zustände `uploading` und `processing` werden beide als „wird verarbeitet" angezeigt.
- **FR-012**: Das System MUSS bei fehlgeschlagener Verarbeitung eine verständliche Ursache nennen und einen erneuten Versuch anbieten.
- **FR-013**: Das System MUSS PDFs ohne extrahierbaren Text als nicht nutzbar kennzeichnen und darf sie nicht als bereit ausweisen.
- **FR-014**: Wiederholte Verarbeitung derselben Quelle DARF KEINE doppelten Textabschnitte oder doppelten Quelleneinträge erzeugen.
- **FR-015**: Benutzer MÜSSEN die Quellen eines Notebooks einsehen, für Fragen auswählen und abwählen können. Die Auswahl bleibt nach erneutem Öffnen des Notebooks erhalten.
- **FR-016**: Benutzer MÜSSEN Quellen entfernen können; das Entfernen MUSS bestätigt werden.
- **FR-017**: Entfernte Quellen DÜRFEN für neue Antworten NICHT mehr herangezogen werden.
- **FR-018**: Nur Quellen im Zustand „bereit" DÜRFEN für Antworten herangezogen werden.

**Fragen und Antworten**

- **FR-019**: Benutzer MÜSSEN Fragen zu den ausgewählten Quellen eines Notebooks stellen können.
- **FR-020**: Antworten MÜSSEN schrittweise erscheinen, während sie erzeugt werden.
- **FR-020a**: Während eine Antwort erzeugt wird, MUSS die Frageeingabe gesperrt sein und ein Abbrechen angeboten werden. Der Client-Abbruch MUSS die Modellanforderung beenden, provisorische Antwortinhalte verwerfen, die Nachricht mit einem festen Hinweis als `aborted` speichern und die Eingabe wieder freigeben.
- **FR-021**: Das System MUSS ausschließlich Inhalte der ausgewählten, bereiten Quellen als Belegbasis verwenden.
- **FR-022**: Das System MUSS erklären, warum es nicht antworten kann, wenn keine Quelle ausgewählt, keine bereit oder bei einer Top-k-Suche keine Passage den am versionierten Referenzdatensatz kalibrierten Mindestwert für die Ähnlichkeit erreicht — und in diesen technisch feststellbaren Fällen KEINE Antwort mit Verweisen erzeugen. Die semantische Entscheidung bei vorhandenen, aber unzureichenden Passagen oberhalb des Mindestwerts wird nach SC-005 bewertet. Ist die Suche selbst nicht durchführbar, weil ein daran beteiligter Dienst nicht erreichbar ist, gilt FR-025; dieser Fall DARF NICHT als fehlende Beleglage dargestellt werden.
- **FR-023**: Widersprechen sich Passagen, die für die aktuelle Frage herangezogen wurden, MUSS die Antwort den Widerspruch benennen und auf beide Stellen verweisen, statt eine Angabe als gesichert darzustellen. Eine darüber hinausgehende Prüfung des Quellenbestands findet NICHT statt.
- **FR-024**: Das System MUSS Text aus hochgeladenen Dokumenten als nicht vertrauenswürdige Daten behandeln; darin enthaltene Anweisungen DÜRFEN Antwortverhalten und Zugriffsgrenzen NICHT verändern.
- **FR-025**: Ein Abbruch oder Anbieterfehler bei der Suche oder der Antworterzeugung MUSS mit dem passenden Zustand `aborted` beziehungsweise `failed` und einem festen Hinweis erkennbar sein, der KEINE Aussage über die Quellenlage trifft; provisorische Antwortinhalte und Verweise werden nicht gespeichert. Bei `failed` MUSS „Erneut versuchen“ für dieselbe Frage einen neuen Antwortversuch anhängen, während der fehlgeschlagene Versuch unverändert sichtbar bleibt.
- **FR-026**: Der Gesprächsverlauf eines Notebooks MUSS nach erneutem Öffnen samt Antworten und Verweisen vorhanden sein. Das schließt als unbelegt gekennzeichnete Entwürfe samt ihrer Kennzeichnung nach FR-027a ein.

**Belege**

- **FR-027**: In einer erfolgreich angezeigten Antwort MUSS **jeder** Absatz genau eine quellenbasierte Aussage enthalten und mit mindestens einem gültigen Verweis auf die Passage enden, auf der sie beruht. Ausgenommen sind ausschließlich die von der Anwendung selbst erzeugten festen Status- und Einschränkungstexte; eine Kennzeichnung durch das Modell begründet KEINE Ausnahme. Freie Einleitungs- oder Zusammenfassungsabsätze ohne Verweis sind damit ausgeschlossen. Verletzt mindestens ein Absatz diese Form, MUSS die gesamte Antwort als unbelegt gelten.
- **FR-027a**: Eine als unbelegt verworfene Antwort MUSS sichtbar bleiben und dabei unmissverständlich als ungeprüft und nicht belegt gekennzeichnet sein; die erklärte Einschränkung MUSS darunter stehen. Die Kennzeichnung DARF NICHT allein über Farbe erfolgen und MUSS auch der Textausgabe von Hilfstechnologien entnehmbar sein. Verweise einer verworfenen Antwort DÜRFEN NICHT als gültige Belege dargestellt und NICHT anklickbar sein. Entwurfstext und Kennzeichnung MÜSSEN gespeichert werden; die Kennzeichnung DARF KEINE reine Anzeigeeigenschaft der laufenden Sitzung sein, sonst kehrte der Text nach erneutem Öffnen unmarkiert zurück.
- **FR-028**: Jeder Verweis MUSS auf eine gespeicherte Originalstelle auflösbar sein und Quelldokument, Passage und Seitenzahl benennen.
- **FR-028a**: Jeder Verweis MUSS den zitierten Wortlaut bei sich speichern, damit die Belegstelle unabhängig vom Fortbestand der Quelle darstellbar bleibt.
- **FR-029**: Ein Klick auf einen Verweis MUSS das Quelldokument an der belegten Seite anzeigen und die Passage hervorheben. Ist der geprüfte Wortlaut in der PDF-Textebene technisch nicht auffindbar, MUSS die Seite geöffnet und der Wortlaut daneben angezeigt werden.
- **FR-030**: Eine vorhandene Quellenkennung allein DARF NICHT als gültiger Beleg gelten. Ein angezeigter Verweis MUSS auf einen tatsächlich abgerufenen Abschnitt einer ausgewählten, bereiten Quelle zeigen, und sein gespeicherter Wortlaut MUSS dort nach Vereinheitlichung von Leerraum vorkommen. Ob die Passage die zugeordnete Aussage inhaltlich stützt, wird getrennt als probabilistische Qualitätsmetrik berichtet.
- **FR-031**: Wird eine Quelle entfernt, MÜSSEN ihre Datei und ihre Textabschnitte gelöscht werden. Verweise in früheren Antworten MÜSSEN den gespeicherten Wortlaut mit dem Hinweis „Quelle entfernt“ anzeigen und DÜRFEN keinen Sprung ins Dokument mehr anbieten.

**Bedienung**

- **FR-032**: Der Kernablauf Anmelden → Notebook anlegen → PDF hochladen → Frage stellen → Antwort lesen → Beleg im Original prüfen MUSS vollständig bedienbar sein.
- **FR-033**: Die für den jeweiligen Ablauf relevanten Lade-, Leer-, Erfolgs- und Fehlerzustände MÜSSEN verständlich dargestellt sein.
- **FR-034**: Alle Schritte des Kernablaufs MÜSSEN per Tastatur bedienbar sein, mit sichtbarem Fokus, beschrifteten Bedienelementen und Fehlermeldungen, die ihrem Eingabefeld zugeordnet sind.
- **FR-035**: Löschende Aktionen MÜSSEN bestätigt werden und benennen, was entfernt wird. Läuft im betroffenen Notebook eine Antwort, MUSS die Löschung mit einem verständlichen Konflikthinweis abgelehnt werden.

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
- **Antwort**: Erzeugter Text zu einer Frage; trägt Verweise und einen Abschlusszustand. Ein Versuch kann als unbelegt gekennzeichnet sein; diese Kennzeichnung gehört zum gespeicherten Zustand, nicht zur Darstellung. Eine Frage kann nach einem Anbieterfehler mehrere chronologisch sichtbare Antwortversuche besitzen.
- **Verweis**: Zuordnung einer Aussage der Antwort zu einem Textabschnitt; trägt den zitierten Wortlaut und den Seitenbezug als eigene Angaben, damit er die Löschung der Quelle überdauert.
- **Verarbeitungsauftrag**: Lauf, der aus einer hochgeladenen Datei Textabschnitte erzeugt; trägt Zustand und Versuchszähler.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In der vorbereiteten Demo-Umgebung führt der Maintainer den Kernablauf von der Registrierung bis zur geprüften Originalstelle in unter 10 Minuten vor.
- **SC-002**: In 100 % der Felder der Zugriffsmatrix im Abschnitt „Zugriffsmatrix" tritt das dort genannte Ergebnis ein.
- **SC-003**: In 100 % der geprüften Antworten lässt sich jeder Verweis auf eine noch vorhandene Quelle zur Originalstelle auflösen. Nach Quellenlöschung bleiben gespeicherter Wortlaut, Quellenname und Seite mit dem Hinweis „Quelle entfernt“ sichtbar; ein Dokumentsprung wird nicht angeboten.
- **SC-005**: Fragen, für die der Referenzdatensatz keine inhaltlich ausreichende Beleglage enthält, führen in mindestens 95 % der Fälle zu einer erklärten Einschränkung statt zu einer Antwort mit Verweisen. Das Ergebnis ist eine berichtete Qualitätsmetrik und kein Freigabetor.
- **SC-006**: Kein Anweisungsversuch aus einem Dokument des Referenzdatensatzes verändert Antwortverhalten oder Zugriffsgrenzen.
- **SC-007**: Beschädigte, leere, passwortgeschützte und nicht unterstützte Dateien führen in 100 % der Fälle zu einem sichtbaren Fehler- oder Ablehnungszustand und nie zu einer scheinbar bereiten Quelle.
- **SC-008**: Erneute Verarbeitung derselben Quelle verändert die Anzahl ihrer Textabschnitte nicht.
- **SC-009**: Der Kernablauf ist vollständig per Tastatur durchführbar, ohne dass der Fokus unsichtbar wird oder in einem Bereich gefangen bleibt.
- **SC-010**: Bei Ausfall der Dokumentverarbeitung, der Suche oder des Modellanbieters sieht der Benutzer in 100 % der Fälle einen Fehlerzustand mit Wiederholungsmöglichkeit und nie eine als erfolgreich dargestellte Teilausgabe oder eine Aussage über die Quellenlage.
- **SC-011**: Der erste Teil einer Antwort wird in mindestens vier von fünf dokumentierten Läufen der vorbereiteten Demo-Umgebung innerhalb von 5 Sekunden sichtbar. Das Ergebnis ist ein Performance-Smoke-Wert und kein Freigabetor.
- **SC-013**: Jeder ausgelöste Fehlerfall lässt sich über Korrelationsmerkmal, Phase und Ursache einem Vorgang zuordnen, ohne dass Dokumentinhalte, personenbezogene Daten oder Geheimnisse in der Diagnoseausgabe erscheinen.

### Zugriffsmatrix

Abnahmegrundlage für SC-002. Jeder geschützte Vorgang ist eine Zeile; fehlt eine Zeile, fehlt eine Prüfung. **Fremd** heißt angemeldet mit einem anderen Konto, **anonym** heißt ohne Sitzung. Die Zuordnung der Vorgänge zu konkreten Schnittstellen steht in `contracts/`.

| Geschützter Vorgang | Eigentümer | Fremd | Anonym |
|---|---|---|---|
| Notebook-Übersicht öffnen | zeigt nur eigene Notebooks | zeigt nur eigene Notebooks | zur Anmeldung, kein Inhalt |
| Notebook öffnen | Zugriff | nicht gefunden | zur Anmeldung, kein Inhalt |
| Notebook anlegen | erfolgreich | legt eigenes an, kein Fremdzugriff | abgelehnt |
| Notebook umbenennen oder löschen | erfolgreich | nicht gefunden | abgelehnt |
| Datei hochladen, bestätigen oder abbrechen | erfolgreich | nicht gefunden | abgelehnt |
| Quelle auswählen, entfernen oder erneut verarbeiten | erfolgreich | nicht gefunden | abgelehnt |
| Frage stellen | erfolgreich | nicht gefunden | abgelehnt |
| Verarbeitungszustand abfragen | nur eigene Aufträge | nicht gefunden | abgelehnt |
| PDF-Datei über ihre Adresse abrufen | Zugriff | kein Zugriff | kein Zugriff |
| Gesprächsverlauf lesen | Zugriff | nicht gefunden | zur Anmeldung, kein Inhalt |
| Verarbeitung von außen anstoßen | nur mit gültigem internem Geheimnis; eine Benutzersitzung berechtigt nicht | abgelehnt | abgelehnt |

„Nicht gefunden" und „abgelehnt" MÜSSEN ununterscheidbar davon sein, dass das Objekt gar nicht existiert (FR-004). Ein neuer geschützter Vorgang erfordert eine neue Zeile, bevor er ausgeliefert wird.

Zusätzlich zur Oberflächenmatrix MÜSSEN direkte Lese- und Schreibzugriffe mit einem Benutzer- oder anonymen Token auf allen sechs Anwendungstabellen scheitern. Fremde Elternkennungen DÜRFEN auch in Kombination mit dem eigenen `user_id` keine gültige Kindzeile ergeben. Diese beiden Datenbankgrenzen sind deterministische Bestandteile von SC-002.

### Grenzwerte

Die Werte sind durch den Maintainer am 2026-09-19 bestätigt und erfüllen die Pflicht aus Prinzip VII, Grenzen in `spec.md` festzulegen.

| Größe | Wert |
|---|---|
| Dateigröße je PDF | Anzeige „10 MB“; technische Grenze 10 MiB = exakt 10.485.760 Bytes |
| Seiten je PDF | 50 |
| Quellen je Notebook | 30 |
| Ausgewählte Quellen je Frage | 10 |
| Fragelänge | 2.000 Zeichen |
| Herangezogene Textmenge je Antwort | 60.000 Zeichen |
| Automatische Wiederholungen je Verarbeitungsauftrag | 3 |
| Laufzeitgrenze je Verarbeitungsauftrag | 5 Minuten |

## Verification Approach

Deterministische und probabilistische Prüfungen werden getrennt ausgewiesen (Prinzip VI). Ein grünes Ergebnis der einen Gruppe ersetzt die andere nicht.

**Deterministisch** — jederzeit wiederholbar mit gleichem Ergebnis:

- Zugriffsgrenzen mit eigenem, fremdem und anonymem Benutzer (SC-002).
- Abweisung direkter Benutzer-/Anonym-Token-Zugriffe sowie eigentümerkonsistente Elternbeziehungen in der Datenbank (SC-002, FR-002, FR-003).
- Dateiannahme und -ablehnung, Zustandswechsel, Wiederholung ohne Duplikate (SC-007, SC-008).
- Auflösbarkeit jedes Verweises auf eine vorhandene Quelle sowie der historische Belegfall nach Quellenlöschung (SC-003).
- Verhalten bei entfernten Quellen, ohne Auswahl, ohne bereite Quelle.
- Ausfall von Dokumentverarbeitung, Suche und Modellanbieter, simuliert (SC-010).
- Tastaturbedienbarkeit des Kernablaufs (SC-009).
- Diagnostizierbarkeit ausgelöster Fehler ohne Preisgabe von Inhalten, Personenbezug oder Geheimnissen (SC-013).
- Kennzeichnung einer verworfenen Antwort: Markierung vorhanden, nicht allein farbbasiert, Verweise nicht anklickbar (FR-027a).

**Probabilistisch und beobachtend** — kein Freigabetor, Schwankung erwartet:

- Belegtreue: stützt die verwiesene Passage die Aussage; als Berichtsmetrik ohne eigenes Erfolgskriterium.
- Ein-Aussage-Regel: enthält jeder Claim-Absatz nach der versionierten manuellen Rubrik genau eine quellenbasierte Aussage (FR-027).
- Ehrliche Einschränkung bei fehlender Beleglage (SC-005).
- Kenntlichmachung von Widersprüchen.
- Widerstand gegen Anweisungen in Dokumenten (SC-006) — das Ergebnis wird probabilistisch bewertet, die Zugriffsgrenze dahinter bleibt deterministisch geprüft.
- Antwort in der Sprache der Frage (A-06).
- Zeit bis zum ersten sichtbaren Antwortteil in fünf Läufen der Demo-Umgebung (SC-011).

**Referenzdatensatz**: vier selbst erstellte oder vom Maintainer ausdrücklich freigegebene, versionierte PDF-Dokumente und zwölf Fragen. Enthalten sind bekannte Aussagen, ein widersprüchliches Paar, ein eingebetteter Anweisungsversuch, sechs beantwortbare, drei unbeantwortbare, zwei widersprüchliche und eine auf den Anweisungsversuch zielende Frage; mindestens eine beantwortbare Frage ist deutsch und eine englisch. Erwartete Belegstellen, Antwortsprachen, Bewertungskriterien und der daraus kalibrierte Mindestwert für die Ähnlichkeit werden mit dem Datensatz dokumentiert.

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
- Physische Bereinigung möglicher verwaister Storage-Objekte nach Upload-Abbruch oder vollständiger Notebook-Löschung. Für das Demo bleiben sie privat und werden beim Zurücksetzen des Demo-Projekts entfernt; die Quelllöschung nach FR-031 bleibt davon unberührt.

## Assumptions

Getroffene Vorfestlegungen, wo das Briefing keine Vorgabe macht. Jede ist ohne Aufwand umkehrbar, solange die Implementierung nicht begonnen hat.

- **A-01**: Registrierung ohne E-Mail-Bestätigung. Für ein Demonstrationsprojekt genügt das; die Zugriffsgrenzen hängen nicht daran.
- **A-02**: Anmeldung mit E-Mail und Passwort, keine Anmeldung über Drittanbieter.
- **A-03**: Entscheidung vom 2026-09-14, siehe Clarifications. Frühere Antworten werden beim Entfernen einer Quelle nicht nachträglich verändert.
- **A-04**: Widersprüche werden nur innerhalb der für die aktuelle Frage herangezogenen Passagen erkannt; eine Prüfung des gesamten Quellenbestands findet nicht statt.
- **A-05**: Löschen entfernt Datei und Textabschnitte endgültig; kein Papierkorb, keine Wiederherstellung, weil Demonstrationsprojekt. Ausgenommen sind die bei bereits erteilten Verweisen gespeicherten Wortlaute (FR-028a); sie verschwinden mit dem Gesprächsverlauf oder dem Notebook.
- **A-06**: Die Antwort erfolgt in der Sprache der Frage.
- **A-07**: Ein Gesprächsverlauf je Notebook, keine parallelen Unterhaltungen.
- **A-08**: Der Referenzdatensatz besteht aus selbst erstellten oder vom Maintainer ausdrücklich freigegebenen Dokumenten, deren Verwendung zulässig ist.
- **A-09**: Nutzung durch einzelne Benutzer in einer Demonstrationsumgebung; keine Lastannahmen über gleichzeitige Benutzer.
- **A-10**: Der Auswahlzustand einer Quelle wird persistent gespeichert und beim erneuten Öffnen wiederhergestellt.

## Maintainer-Entscheidungen vom 2026-09-19

- **OD-01 — entschieden**: Grenzwerte sowie SC-005 und SC-011 gelten in der oben festgelegten Fassung. SC-004 und SC-012 entfallen; Belegtreue bleibt Berichtsmetrik.
- **OD-02 — entschieden**: A-01 bis A-10 sind für das Demo bestätigt.
- **OD-03 — entschieden**: Umfang und Herkunft des Referenzdatensatzes sind im Abschnitt Verification Approach festgelegt.
- **OD-04 — entschieden**: Die Quellenauswahl ist persistent.
