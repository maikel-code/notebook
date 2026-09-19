# Phase 0 — Entscheidungen

**Feature**: 001-notebook-source-qa · **Stand**: 2026-09-19

Jede Entscheidung nennt die verworfene Alternative (Prinzip I). **Zusätzliche Abhängigkeit** markiert Einträge, die Prinzip IV begründen müssen.

## D-01 Rahmenwerk

**Decision**: Next.js App Router. Server Components für Anzeige, Route Handlers für Strom und Verarbeitungsaufträge.

**Rationale**: Vom Briefing vorgegeben. Datenbankzugriffe bleiben serverseitig; der direkte Browserzugriff beschränkt sich auf eigene Storage-Objekte unter Storage-RLS — Voraussetzung für Prinzip II.

**Alternatives**: Pages Router (keine Server Components); getrenntes Backend (verdoppelt Typdefinitionen).

## D-02 Datenhaltung, Authentifizierung, Dateiablage

**Decision**: Supabase für alle drei. Postgres mit RLS, Auth mit E-Mail und Passwort (A-02), privater Storage-Bucket.

**Rationale**: Vom Briefing vorgegeben. Leseregeln, Storage-Regeln und relationale Eigentümerbindung sitzen in der Datenbank. Privilegierte Schreibpfade ergänzen diese Grenze durch zentrale Autorisierung; keine einzelne Anwendungskontrolle trägt sie allein.

**Alternatives**: Prüfung nur in der Anwendung — widerspricht Prinzip II. Gleichförmige Benutzer-Schreibpolicies — erlauben das Umgehen der vorgesehenen Serverabläufe.

## D-03 Abrufverfahren

**Decision**: Zerlegung in Textabschnitte, Einbettung je Abschnitt, Ähnlichkeitssuche über `pgvector`. Pro Frage werden höchstens acht Treffer (`topK = 8`) betrachtet. Treffer unter dem versionierten Mindestwert werden verworfen; verbleibende Treffer werden in Rangfolge bis zur Grenze von 60.000 Zeichen gepackt.

**Rationale**: `pgvector` gehört zu Supabase, kein zusätzlicher Dienst. Verweise brauchen ohnehin eine Passage mit Seitenbezug (FR-028); Abschnitte sind diese Einheit. Kosten unabhängig von der Dokumentgröße.

**Alternatives**: Ganze Dokumente im Kontext — jede Frage kostet die volle Dokumentmenge, Belegstelle muss trotzdem lokalisiert werden. Nur Top-k ohne Mindestwert — erzwingt auch bei unpassenden Treffern einen Modellaufruf. Zusätzliche Stichwortsuche — **Auslöser für Nachrüstung**: Die berichtete Belegtreue fällt bei Fragen nach Eigennamen, Zahlen oder Aktenzeichen erkennbar ab.

## D-04 Modellanbieter

**Decision**: Antworten über Anthropic Claude, Einbettungen über OpenAI `text-embedding-3-small`, beide über das Vercel AI SDK.

**Rationale**: Beide Konten liegen vor. Anthropic bietet keine Einbettungen, die kommen ohnehin von einem zweiten Anbieter. Das AI SDK kapselt die Erzeugung; ein Wechsel betrifft eine Konfigurationsstelle.

**Folge — drei unabhängig sichtbare Ausfallpfade**, die verschiedene Abläufe treffen:

| Ausfall | Wirkung |
|---|---|
| Einbettungen beim Dokument | Auftrag scheitert in Phase `embed`, Wiederholung nach FR-037; bestehende Quellen bleiben nutzbar |
| Einbettung der Frage oder Suche | Assistant-Versuch endet `failed`, erneuter Versuch nach FR-025; keine Aussage über die Beleglage |
| Antwortmodell | Nachricht auf `failed`, erneuter Versuch (FR-025); Aufnahme läuft weiter |

SC-010 braucht deshalb drei getrennte Prüffälle, nicht einen.

**Alternatives**: OpenAI für beides — nur noch Bequemlichkeit, da beide Konten vorhanden. Gemini — gleichwertig, kein Wechselgrund.

**Zu beachten**: Ein Wechsel des Einbettungsmodells erzwingt die Neuberechnung aller Abschnitte.

## D-05 Hintergrundverarbeitung

**Decision**: `ingestion_jobs` ist die Zustandsmaschine. Ein Route Handler beansprucht einen Auftrag atomar (`FOR UPDATE SKIP LOCKED`) und führt ihn in Phasen aus. Drei Auslöser: nach dem Upload, wiederholender Aufruf, manueller Wiederholversuch.

**Rationale**: FR-011, FR-012, FR-014 und FR-037 verlangen zusammen sichtbaren Fortschritt, manuelle Wiederholung, begrenzte automatische Wiederholung und Idempotenz. Die Datenbank als Zustandshalter erfüllt alle vier; `SKIP LOCKED` verhindert Doppelverarbeitung.

**Auslösung**: Der wiederholende Aufruf wird ausdrücklich angestoßen — lokal über `pnpm worker:sweep`, nach einer Veröffentlichung über einen Zeitplan dort. **Kein Zeitplan auf Datenbankseite**, obwohl eine lokale Datenbank die lokale Anwendung erreichen könnte: ein Mechanismus, der nur lokal funktioniert und nach der Veröffentlichung durch einen anderen ersetzt werden müsste, ist zwei Mechanismen statt einem (Prinzip IV).

**Alternatives**: Verarbeitung im Upload-Aufruf — stirbt mit der Zeitgrenze, kein Wiederanlauf. Edge Functions — zweite Sprache und zweite Umgebung für dieselbe PDF-Bibliothek.

## D-06 Idempotenz

**Decision**: Ein Auftrag löscht vor dem Schreiben alle Abschnitte seiner Quelle und schreibt sie in derselben Transaktion neu.

**Rationale**: FR-014 verbietet Duplikate bei wiederholter Verarbeitung. Garantiert das Ergebnis auch nach einem mitten im Schreiben abgebrochenen Lauf.

**Alternatives**: Unterschiede abgleichen — mehr Code, bei unverändertem Dokument dasselbe Ergebnis.

## D-07 Prüfung der Belege — tragender Entwurfsteil

**Decision**: Das Modell liefert strukturierte Claim-Einheiten mit Aussage, Abschnittsnummern und **wörtlichen Auszügen**. Eine Claim-Einheit wird als genau ein Absatz gerendert; ihre geprüften Verweise stehen ausschließlich am Absatzende. Der Server prüft Auswahl, Herkunft und Wortlaut jeder Einheit. Scheitert eine Einheit oder ein Verweis, wird der gesamte Entwurf als erfolgreicher Antworttext verworfen und mit `status = invalid` sowie `unsupported_reason = invalid_citations` gespeichert. Er bleibt als ungeprüft und nicht belegt gekennzeichnet sichtbar; abgeleitete Verweise werden nicht gespeichert (FR-027, FR-027a).

**Rationale**: FR-030 schließt aus, dass eine Quellenkennung als Beleg genügt. Ohne diesen Schritt prüft nur das Modell sich selbst. Der Abgleich ist deterministisch und anbieterunabhängig; er liefert zugleich den Wortlaut, den FR-028a speichern muss.

**Alternatives**: Einzelne gültige Verweise retten — verletzt die Gesamtverwerfung aus FR-027. Ungültigen Entwurf vollständig löschen — verletzt die persistente Kennzeichnung aus FR-027a. Freitext semantisch in Aussagen zerlegen — nicht deterministisch. Zweites Modell als Prüfer — teurer, langsamer, selbst probabilistisch.

## D-08 Streamen und Claim-Einheiten

**Decision**: Strukturierte Claim-Einheiten werden nacheinander erzeugt und jeweils vollständig gepuffert. Erst eine vollständig bestandene Einheit erscheint provisorisch als Absatz mit nicht interaktiven Verweisen und dem Zustand „wird geprüft“. Nach erfolgreicher Gesamtprüfung werden Antwort und Verweise atomar gespeichert und interaktiv. Scheitert eine spätere Einheit, bleibt der vollständige Entwurf ohne Citations mit `status = invalid` und dauerhafter Kennzeichnung sichtbar. Bei Client-Abbruch oder Anbieterfehler werden provisorische Inhalte dagegen verworfen und nur ein fester terminaler Hinweis ohne Citations gespeichert; für die Demo entsteht dadurch kein zusätzlicher persistenter Streaming-Zustand.

**Rationale**: FR-020 verlangt schrittweises Erscheinen, Prinzip III aber keine ungeprüften fertigen Aussagen. Claim-weises Puffern erfüllt beides und macht „ein Absatz = eine Claim-Einheit“ strukturell prüfbar.

**Alternatives**: Rohen Modelltext anzeigen — kann ungültige Belege sichtbar machen. Erst nach vollständiger Antwort etwas anzeigen — verletzt das schrittweise Erscheinen. Zweiter Modellaufruf zur Belegzuordnung — doppelte Kosten und Wartezeit.

## D-09 Anweisungen in Dokumenten

**Decision**: Drei Ebenen — Dokumenttext in abgegrenzten Blöcken und in der Systemanweisung als Daten benannt; Abruf serverseitig auf die vom Benutzer ausgewählten Quellen eingegrenzt; Belegprüfung nach D-07.

**Rationale**: FR-024 verlangt, dass Anweisungen im Dokument nichts verändern. Ebene eins ist eine Bitte an das Modell, Ebene zwei eine Schranke: die Filterung liegt **vor** dem Modell und hängt an der Sitzung, also kann kein erzeugter Text den Abruf ausweiten.

**Alternatives**: Nur Formulierungen in der Systemanweisung — keine mechanische Schranke, genügt Prinzip III nicht.

## D-10 Erhöhte Rechte

**Decision**: Benutzer- und anonyme Clients erhalten keinen direkten Zugriff auf die sechs Anwendungstabellen. Sämtliche Datenbankzugriffe laufen in Server Components, Server Actions, Route Handlers oder Verarbeitungsaufträgen über die Dienstrolle. Vor jedem Zugriff werden Sitzung und Zielobjekt zentral geprüft; vor Mutationen zusätzlich die Elternbeziehung. `user_id` stammt aus diesem geprüften Kontext. Der Verarbeitungslauf bleibt zusätzlich auf den Eigentümer des Auftrags eingeschränkt. Die Dienstrolle wird ausschließlich in `lib/supabase/service.ts` erzeugt und erreicht nie den Browser. Direkte Dateiübertragung und Dateiabruf bleiben davon getrennt und laufen über den authentifizierten Browser-Client unter Storage-RLS.

**Rationale**: Gleichförmige Benutzerpolicies wie `user_id = auth.uid()` würden interne Spalten lesbar machen und einem Browser bei Schreibfreigabe erlauben, Zustände, Aufträge, Abschnitte, Assistant-Nachrichten oder Citations an den vorgesehenen Serverprüfungen vorbei zu verändern. Die serverseitige Datenbankgrenze hält die sechs Tabellen vollständig aus dem direkten Browserzugriff heraus. Weil die Dienstrolle RLS umgeht, sind zentrale Autorisierung, eigentümergebundene Abfragen und relationale Datenbank-Invarianten gemeinsam erforderlich.

**Alternatives**: Lesen mit Benutzer-Token und Spaltenprivilegien — zweites Berechtigungsmodell zusätzlich zu den ohnehin nötigen Serverpfaden. Schreiben mit Benutzer-Token — umgeht Grenzwerte und Zustandsmaschinen über die öffentliche Datenbankschnittstelle. Eigene Datenbankfunktionen je Aktion — mehr Schnittstellen und Prüfpfade für denselben Demo-Umfang. Dienstrolle ohne zentrale Autorisierung — jede Abfrage wäre ein möglicher Cross-User-Bruch.

## D-11 Textextraktion und Belegansicht — Zusätzliche Abhängigkeit

**Decision**: `pdf.js` serverseitig zur seitenweisen Extraktion, clientseitig zur Anzeige. Gespeichert werden Abschnittstext, Seitenbereich und Wortlaut; die Anzeige sucht den Wortlaut in der Textebene. Wird er nicht gefunden, öffnet die Seite und zeigt den Wortlaut daneben.

**Rationale**: FR-029 verlangt den Sprung auf die belegte Seite und bevorzugt die Hervorhebung. Zeichenpositionen aus der Extraktion stimmen nicht zwingend mit der gerenderten Textebene überein; die Suche nach dem Wortlaut ist robuster. Die freigegebene Demo-Abschwächung zeigt den geprüften Wortlaut andernfalls daneben und verhindert unbrauchbare Belege.

**Alternatives**: Zeichenpositionen speichern — bricht bei abweichender Textebene. Seitenbilder — verlieren die Textauswahl.

## D-12 Node-Version

**Decision**: Node 22 LTS, gepinnt über `.nvmrc` und `engines`.

**Rationale**: Lokal läuft v25.4.0, eine ungerade Ausgabe ohne Langzeitunterstützung. Prinzip VII verlangt benannte Voraussetzungen.

**Alternatives**: v25 nutzen — spart heute einen Schritt, kostet später die Frage, warum etwas nur auf einem Rechner läuft.

## D-13 Komponenten und Barrierefreiheit — Zusätzliche Abhängigkeit

**Decision**: Komponenten von neobrutalism.com über die shadcn-kompatible Befehlszeile nach `components/ui/`. Tailwind CSS v4. Primitive von Radix UI, Base UI und React Aria.

**Rationale**: FR-034 und SC-009 verlangen Tastaturbedienung, sichtbaren Fokus, beschriftete Bedienelemente und zugeordnete Fehlermeldungen. Die Primitive bringen das mit. Die Komponenten liegen als Quelltext im Repository und unterliegen Prinzip I.

**Vor Verwendung zu prüfen**: Lizenzbezeichnung der offenen Komponenten (nicht verifiziert, Aufgabe T006). Kontrastwerte und Sichtbarkeit des Fokusrings, weil die kräftige Gestaltung Umrandungen und Schatten stark verändert.

**Prüfergebnis T006 (2026-09-19)**: Herkunft ist die offizielle Registry
`https://neobrutalism.com/r/radix/`, eingebunden mit der shadcn-CLI. Das zugehörige
Repository `neobrutalism/neobrutalism` weist die Komponenten als MIT-lizenziert aus.
Button, Card, Input, Label und Dialog werden als Quelltext nach `components/ui/`
kopiert; es entsteht keine Laufzeitbindung an die Registry. Der sichtbare globale
Fokusring bleibt zusätzlich im Projekt-Theme erzwungen. Kontrast und konkrete
Dialogbedienung bleiben Bestandteil der Story- und Abschlussprüfungen.

**Alternatives**: Selbst schreiben — Aufwand in Barrierefreiheitsdetails statt Fachlichkeit. Paketabhängigkeit — weniger Kontrolle, und das Briefing nennt diese Quelle.

## D-14 Betriebsumgebung — gedreht 2026-09-19

**Decision**: Entwicklung und Prüfläufe laufen gegen **eine lokale** Supabase-Instanz. Das gehostete Cloud-Projekt ist ausschließlich Veröffentlichungs- und Vorführziel; Schemaänderungen gelangen über `supabase db push` dorthin.

**Rationale**: Drei Gründe, alle gegen die zuvor geplante Cloud-Entwicklung. Erstens verlangt Gate 3 `pnpm db:reset`, also Migrationen auf leerer Datenbank — lokal ist das Teil der normalen Arbeit, bei Cloud-Entwicklung erst im Testkontext, und ein Schemafehler zeigt sich entsprechend spät. Zweitens liegt der Befehl, der eine Datenbank leert, bei Cloud-Entwicklung täglich in Reichweite des Vorführprojekts; ist die Cloud reines Veröffentlichungsziel, wird sie nur bewusst angefasst. Drittens entfällt die Drift zwischen zwei Datenbanken: Entwicklung und Prüfung teilen sich dieselbe Instanz.

**Folge**: Eine statt zwei lokaler Konfigurationen. Prüfläufe setzen die Instanz zurück und leeren dabei den Entwicklungsstand — das ist der Preis und mit erneutem Befüllen billig bezahlt.

**Alternatives**: Entwicklung gegen die Cloud — die zuvor gewählte Fassung, verworfen aus den drei Gründen oben. Getrennte lokale Instanz nur für Tests — zweite Konfiguration ohne Gegenwert, da lokale Entwicklungsdaten ohnehin entbehrlich sind.

## D-15 Fortschrittsanzeige

**Decision**: Abfrage in kurzen Abständen, solange ein Auftrag offen ist.

**Rationale**: FR-011 verlangt sichtbare Zustandswechsel ohne Neuladen. Genügt dafür und braucht keine dauerhafte Verbindung; die Zahl gleichzeitiger Aufträge ist durch A-09 klein.

**Alternatives**: Dauerhafte Verbindung — weiterer Mechanismus mit eigenen Zugriffsregeln. **Auslöser für Wechsel**: spürbare Last oder mehrere gleichzeitige Benutzer.

## D-16 Prüfwerkzeuge — Zusätzliche Abhängigkeit

**Decision**: Biome übernimmt Linting, Formatprüfung und Importorganisation. Vitest prüft reine Logik; Playwright führt die Demo-Abläufe in genau einem Chromium-Projekt aus. Jedes Feld der Zugriffsmatrix aus spec.md läuft gegen die lokale Instanz; interne Jobs zusätzlich mit gültigem, fehlendem und ungültigem Geheimnis sowie einem Cross-User-Worker-Fall. Bewertung und Performance-Smoke-Test laufen als getrennte Kommandos.

**Rationale**: Ein Werkzeug für Linting und Format vermeidet überlappende Konfiguration. Für die Demo genügt Chromium und hält E2E-Laufzeit sowie Wartung klein. Prinzip II verlangt die benannte positive und negative Demo-Matrix; aussagekräftig nur gegen echte Regeln, nicht gegen Attrappen. Prinzip VI verlangt getrennte Ausweisung von deterministisch, probabilistisch und beobachtend.

**Alternatives**: ESLint plus separates Formatwerkzeug — zwei Konfigurationen ohne Demo-Nutzen. Firefox- und WebKit-Projekte — zusätzlicher Laufzeit- und Pflegeaufwand ohne Abnahmeanforderung. Zugriffsgrenzen mit Attrappen — prüft den Code, nicht die Regel. Antwortqualität in derselben Suite — macht das Freigabetor von schwankenden Ergebnissen abhängig.

## D-17 Kalibrierter Abrufgrenzwert

**Decision**: `eval/dataset/retrieval-calibration.json` versioniert `topK = 8`, Mindestähnlichkeit, Einbettungsmodell, Distanzmaß sowie Fingerprints von Datensatz und Chunk-Konfiguration. Ein separater Kalibrierlauf bewertet Kandidatenschwellen am Referenzdatensatz, maximiert die ausgewogene Trefferquote beantwortbarer und unbeantwortbarer Fragen und wählt bei Gleichstand den höheren Wert. Der Maintainer gibt das erzeugte Artefakt frei; die Laufzeit verändert es nie selbst.

**Rationale**: FR-022 braucht einen vorhersehbaren technischen Abbruch. Die Herkunft des Werts bleibt nachvollziehbar, während deterministische Tests die festgeschriebene Konfiguration und die Fälle unterhalb, auf und oberhalb der Grenze prüfen können.

**Rekalibrierung**: bei Änderung von Einbettungsmodell, Distanzmaß, Chunk-Konfiguration oder Referenzdatensatz. Der externe Lauf ist probabilistisch und kein Gate; das freigegebene Ergebnis ist danach feste Eingabe der Gate-Tests.

**Alternatives**: Handwert im Quelltext oder in einer Umgebungsvariable — weder hergeleitet noch reproduzierbar. Dynamische Schwelle je Anfrage — erzeugt unvorhersehbare Zustände. Cross-Encoder oder Hybrid-Suche — zusätzliche Laufzeit und Komplexität ohne belegten Demo-Bedarf.

## D-18 Zweiphasiger Ersatz einer Dublette

**Decision**: `prepareUpload(intent: 'replace')` legt eine neue Quelle als `uploading` mit `replaces_source_id` an; die alte Quelle bleibt unverändert. `confirmUpload` prüft das neue Objekt serverseitig auf Existenz, Größe und Hash. Erst dann sperrt eine Datenbanktransaktion beide Quellen, entfernt die alte Datenbankquelle, setzt die neue auf `processing` und erzeugt genau einen Auftrag. Dessen erste idempotente Phase `cleanup` entfernt den alten Storage-Pfad, bevor die neue Datei verarbeitet wird. `cancelUpload` entfernt nur den neuen Entwurf und startet keinen Auftrag.

**Rationale**: Ein Upload-Abbruch kann die funktionsfähige alte Quelle nicht zerstören. Datenbankwechsel und Auftragserzeugung sind atomar; die nicht transaktionale Storage-Löschung wird über den vorhandenen Wiederholungsmechanismus zuverlässig ausgeführt.

**Alternatives**: Alte Quelle vor dem Upload löschen — verletzt FR-010a. Austausch nur im Browser vormerken — nicht reload- oder crashfest. Separate Upload- und Cleanup-Tabellen — für die Demo unnötig.

## D-19 Antwortversuche

**Decision**: Eine Benutzerfrage wird einmal gespeichert. Jede Assistant-Nachricht verweist über `question_message_id` darauf und trägt eine innerhalb der Frage fortlaufende `attempt_no`. `POST /api/chat` akzeptiert entweder eine neue Frage oder `retryOfMessageId`; ein Retry ist nur für eine eigene fehlgeschlagene Assistant-Nachricht zulässig und hängt einen neuen Versuch an. Fragetext und Auswahl-Snapshot der ursprünglichen Frage werden wiederverwendet, aktuell entfernte oder unbereite Quellen führen zur festen Einschränkung.

**Rationale**: Der fehlgeschlagene Versuch bleibt unverändert sichtbar, ohne die Frage im Verlauf zu duplizieren. Der bestehende Streaming-Endpunkt und sein zentraler Autorisierungsweg genügen.

**Alternatives**: Fehlgeschlagene Nachricht überschreiben — verliert die Versuchshistorie. Frage duplizieren — verfälscht den Verlauf. Eigener Retry-Endpunkt — erweitert die Angriffs- und Testfläche ohne Nutzen.

## D-20 Atomarer Antwortabschluss

**Decision**: Erfolgreiche Antwort, vollständige Menge ihrer Verweise und Zustand `complete` werden in einer Transaktion gespeichert. Bei `invalid_citations` werden der vollständige Modellentwurf, `status = invalid` und `unsupported_reason = invalid_citations` atomar gespeichert; Citations werden nicht gespeichert. Die Oberfläche leitet daraus die dauerhafte, nicht nur farbliche Kennzeichnung und den festen Einschränkungstext ab.

**Rationale**: Nach Neuladen darf weder eine Teilrettung noch ein ungekennzeichneter Entwurf erscheinen. Die Transaktion macht Entwurf und Kennzeichnung unabhängig von einem Verbindungsabbruch beim Abschluss.

**Alternatives**: Nachricht und Verweise einzeln speichern — erzeugt sichtbare Zwischenzustände. Nur die Einschränkung speichern — verliert den nach FR-027a sichtbar zu haltenden Entwurf. Ungültige Citations mitspeichern — ließe nicht geprüfte Belege wie echte Herkunftsangaben wirken.
