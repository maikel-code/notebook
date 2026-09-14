# Notebook Constitution

Ziel: ein überprüfbarer NotebookLM-Klon als Senior-Fullstack-Interviewprojekt.
Der Maintainer verantwortet Entscheidungen und Abnahme der KI-gestützten Entwicklung.

## Core Principles

### I. Technische Verantwortung

- Für KI-generierten und manuell geschriebenen Code gelten dieselben Qualitätsregeln.
- Fertigmeldungen MÜSSEN ausgeführte Prüfungen und Ergebnisse nennen; ungeprüfte Arbeit bleibt offen.
- Anforderungen und Tests DÜRFEN NICHT abgeschwächt werden, um fehlerhaften Code durchzubringen.
- Wesentliche Entscheidungen MÜSSEN mit Begründung und betrachteten Alternativen dokumentiert sein.
- Wiederkehrende Agentenfehler SOLLTEN zu gezielten Verbesserungen der Arbeitsanweisungen führen.

### II. Sichere Zugriffsgrenzen

- Notebooks und zugehörige Dokumente, Textabschnitte, Einbettungen und Chats MÜSSEN gegen unberechtigten Zugriff geschützt sein.
- Berechtigungen MÜSSEN in Datenbank (RLS), Storage, Retrieval und Hintergrundverarbeitung wirksam bleiben.
- Privilegierte Zugriffe MÜSSEN serverseitig, begründet und auf den autorisierten Verarbeitungskontext beschränkt sein.
- Jede Zugriffsgrenze MUSS mit berechtigtem, fremdem und anonymem Benutzer geprüft sein. Neue oder geänderte Zugriffspfade brauchen passende Tests.
- Geheimnisse DÜRFEN NICHT in Client-Bundles, Repository oder Logs gelangen; ihre Bereitstellung erfolgt über serverseitig verwaltete Secret-Quellen.

Nachweis: Tests zeigen erlaubte und verweigerte Zugriffe und würden einen Ausfall der geprüften Schutzmaßnahme erkennen.

### III. Quellengebundene, ehrliche Antworten

- Quellenangaben MÜSSEN auf gespeicherte Originalstellen auflösbar sein und die zugeordnete Aussage inhaltlich stützen.
- Fehlende oder unpassende Belege gelten als Qualitätsfehler. Unzureichende Belege und erkannte Widersprüche MÜSSEN sichtbar werden.
- Dokumentinhalte und Metadaten MÜSSEN als nicht vertrauenswürdige Daten behandelt werden; darin enthaltene Anweisungen DÜRFEN KEINE System- oder Zugriffsregeln überschreiben.

Nachweis: Zitatauflösung, Belegtreue, unbeantwortbare Fragen und Anweisungsversuche in Dokumenten sind im Referenzdatensatz abgedeckt.

### IV. Einfache, begründete Architektur

- Originalaufgabe und vereinbarter Stack sind verbindlich. Fehlende Vorgaben MÜSSEN als offene Fragen erkennbar bleiben.
- Zusätzliche Dienste, Laufzeiten, Abhängigkeiten und Schichten MÜSSEN einen konkreten Nutzen haben; Begründungen gehören in `plan.md`.
- Bestehende Muster SOLLTEN weiterverwendet werden; Abweichungen brauchen eine Begründung.
- Architektur SOLLTE dem tatsächlichen Umfang folgen. Generalisierung auf Vorrat ist zu vermeiden.

### V. Vollständige Nutzerabläufe

- Features MÜSSEN in kleinen, durchgängigen Nutzerabläufen geliefert werden.
- Für den jeweiligen Ablauf relevante Lade-, Leer-, Erfolgs- und Fehlerzustände MÜSSEN verständlich sein.
- Unvollständige oder fehlgeschlagene Verarbeitung DARF NICHT als Erfolg erscheinen; Wiederholung SOLLTE dort möglich sein, wo sie sinnvoll ist.
- Tastaturbedienung, sichtbarer Fokus, beschriftete Bedienelemente und zugeordnete Fehlermeldungen MÜSSEN berücksichtigt sein.

Nachweis: Kernablauf und relevante Zustände sind demonstrierbar, einschließlich vorhandener Fehlerpfade.

### VI. Verifikation anhand von Anforderungen

- Tests MÜSSEN Akzeptanzkriterien und Risiken prüfen. Abdeckungsquoten allein belegen keine Korrektheit.
- Zugriffsisolation, Dokumentverarbeitung einschließlich Fehlerfällen und Quellenqualität MÜSSEN geprüft werden.
- Deterministische Tests und probabilistische Antwortbewertungen MÜSSEN getrennt ausgewiesen werden.
- Antwortbewertungen MÜSSEN auf einem kleinen, manuell geprüften und versionierten Referenzdatensatz beruhen; Ablauf und Bewertungskriterien sind dokumentiert.
- Agenten-Reviews ergänzen ausführbare Prüfungen. Reproduzierte Fehler SOLLTEN zuerst durch eine fehlschlagende Prüfung abgesichert werden.

### VII. Reproduzierbarkeit und Ressourcenverbrauch

- Setup, Migrationen und Prüfungen MÜSSEN mit dokumentierten Voraussetzungen reproduzierbar sein; Schemaänderungen sind versioniert.
- Limits für Dateigröße, Kontextumfang, Laufzeit und Wiederholungen MÜSSEN durchgesetzt werden; Werte stehen in `spec.md`.
- Wiederholte Verarbeitung DARF KEINE unbeabsichtigten Duplikate erzeugen. Der Mechanismus und sein Nachweis gehören in `plan.md` beziehungsweise die Tests.
- Fehler MÜSSEN über Korrelationsmerkmal, Phase und Ursache diagnostizierbar sein, ohne Dokumentinhalte, personenbezogene Daten oder Geheimnisse zu protokollieren.

Nachweis: Setup in frischer Umgebung und erneute Verarbeitung derselben Eingabe sind geprüft.

### VIII. Verständliche Zusammenarbeit

- Code und Dokumentation MÜSSEN Zweck, Grenzen und Prüfweg nachvollziehbar machen.
- Wesentliche Entscheidungen, Agentenkorrekturen und bekannte Einschränkungen MÜSSEN knapp und auffindbar dokumentiert sein.
- Namen und Kommentare SOLLTEN das Verständnis erleichtern; Dokumentation soll Gründe erklären und keine Code-Nacherzählung sein.

## Qualitätsgates

1. **Abgrenzung:** Änderung und zugehöriger Nutzerablauf oder Korrektur sind benannt.
2. **Prüfkriterien:** Akzeptanzkriterien und Risiken stehen vor der Implementierung fest.
3. **Automatisierte Prüfung:** Die vor der Implementierung in `plan.md` festgelegten Prüfkommandos für Typprüfung, Linting und Tests MÜSSEN erfolgreich durchlaufen. Geänderte Migrationen MÜSSEN geprüft werden. Der implementierende Agent DARF den Prüfumfang nicht eigenständig reduzieren. Fehlende Prüfkommandos sind vor Implementierungsbeginn festzulegen.
4. **Zugriffsprüfung:** Neue oder geänderte Zugriffspfade haben positive und negative Tests; bestehende Schutztests bestehen weiterhin.
5. **Review:** Maintainer oder getrennte Agenteninstanz prüft die Änderung. Der Autor ist nicht alleiniger Prüfer.
6. **Nachweis:** Ausgeführte Prüfungen, Ergebnisse und offene Einschränkungen sind dokumentiert.

## Dokumentgrenzen und Governance

- Constitution: Prinzipien und Abnahme; `spec.md`: Features, Kriterien und Limits; `plan.md`: Architektur und Stack; `AGENTS.md`: Rollen und Zusammenarbeit.
- Die Stellenbeschreibung ist Kontext und erzeugt keine zusätzlichen Pflichtfeatures.
- Innerhalb der Projektdokumentation hat die Constitution Vorrang. MUSS-Regeln sind verbindlich; SOLLTE-Abweichungen sind begründbar.
- Ausnahmen brauchen dokumentierten Grund, Auswirkung, Rückweg und ausdrückliche Maintainer-Entscheidung. Sie gelten nur für den benannten Fall.
- Änderungen brauchen eine vorgeschlagene Fassung, Begründung, Folgenprüfung und Maintainer-Entscheidung. Betroffene Artefakte werden angepasst.
- Versionierung: MAJOR bei Aufhebung oder Neudefinition eines Prinzips, MINOR bei Erweiterung, PATCH bei bedeutungsgleicher Klarstellung.

**Version**: 2.0.0 | **Ratified**: 2026-09-14 | **Last Amended**: 2026-09-14
