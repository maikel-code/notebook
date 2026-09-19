# Phase 0 — Entscheidungen

**Feature**: 001-notebook-source-qa · **Stand**: 2026-09-15

Jede Entscheidung nennt die verworfene Alternative (Prinzip I). **Zusätzliche Abhängigkeit** markiert Einträge, die Prinzip IV begründen müssen.

## D-01 Rahmenwerk

**Decision**: Next.js App Router. Server Components für Anzeige, Route Handlers für Strom und Verarbeitungsaufträge.

**Rationale**: Vom Briefing vorgegeben. Datenzugriff bleibt serverseitig — Voraussetzung für Prinzip II.

**Alternatives**: Pages Router (keine Server Components); getrenntes Backend (verdoppelt Typdefinitionen).

## D-02 Datenhaltung, Authentifizierung, Dateiablage

**Decision**: Supabase für alle drei. Postgres mit RLS, Auth mit E-Mail und Passwort (A-02), privater Storage-Bucket.

**Rationale**: Vom Briefing vorgegeben. Die Zugriffsgrenze sitzt in der Datenbank, nicht in der Anwendung — eine vergessene Abfrage führt dann nicht zum Datenabfluss.

**Alternatives**: Prüfung nur in der Anwendung — widerspricht Prinzip II.

## D-03 Abrufverfahren

**Decision**: Zerlegung in Textabschnitte, Einbettung je Abschnitt, Ähnlichkeitssuche über `pgvector`.

**Rationale**: `pgvector` gehört zu Supabase, kein zusätzlicher Dienst. Verweise brauchen ohnehin eine Passage mit Seitenbezug (FR-028); Abschnitte sind diese Einheit. Kosten unabhängig von der Dokumentgröße.

**Alternatives**: Ganze Dokumente im Kontext — jede Frage kostet die volle Dokumentmenge, Belegstelle muss trotzdem lokalisiert werden. Zusätzliche Stichwortsuche — **Auslöser für Nachrüstung**: Die berichtete Belegtreue fällt bei Fragen nach Eigennamen, Zahlen oder Aktenzeichen erkennbar ab.

## D-04 Modellanbieter

**Decision**: Antworten über Anthropic Claude, Einbettungen über OpenAI `text-embedding-3-small`, beide über das Vercel AI SDK.

**Rationale**: Beide Konten liegen vor. Anthropic bietet keine Einbettungen, die kommen ohnehin von einem zweiten Anbieter. Das AI SDK kapselt die Erzeugung; ein Wechsel betrifft eine Konfigurationsstelle.

**Folge — zwei unabhängige Ausfallpfade**, die verschiedene Abläufe treffen:

| Ausfall | Wirkung |
|---|---|
| Einbettungen | Auftrag scheitert in Phase `embed`, Wiederholung nach FR-037; bestehende Quellen bleiben nutzbar |
| Antwortmodell | Nachricht auf `failed`, erneuter Versuch (FR-025); Aufnahme läuft weiter |

SC-010 braucht deshalb zwei Prüffälle, nicht einen.

**Alternatives**: OpenAI für beides — nur noch Bequemlichkeit, da beide Konten vorhanden. Gemini — gleichwertig, kein Wechselgrund.

**Zu beachten**: Ein Wechsel des Einbettungsmodells erzwingt die Neuberechnung aller Abschnitte.

## D-05 Hintergrundverarbeitung

**Decision**: `ingestion_jobs` ist die Zustandsmaschine. Ein Route Handler beansprucht einen Auftrag atomar (`FOR UPDATE SKIP LOCKED`) und führt ihn in Phasen aus. Drei Auslöser: nach dem Upload, wiederholender Aufruf, manueller Wiederholversuch.

**Rationale**: FR-011, FR-012, FR-014 und FR-037 verlangen zusammen sichtbaren Fortschritt, manuelle Wiederholung, begrenzte automatische Wiederholung und Idempotenz. Die Datenbank als Zustandshalter erfüllt alle vier; `SKIP LOCKED` verhindert Doppelverarbeitung.

**Alternatives**: Verarbeitung im Upload-Aufruf — stirbt mit der Zeitgrenze, kein Wiederanlauf. Edge Functions — zweite Sprache und zweite Umgebung für dieselbe PDF-Bibliothek.

## D-06 Idempotenz

**Decision**: Ein Auftrag löscht vor dem Schreiben alle Abschnitte seiner Quelle und schreibt sie in derselben Transaktion neu.

**Rationale**: FR-014 verbietet Duplikate bei wiederholter Verarbeitung. Garantiert das Ergebnis auch nach einem mitten im Schreiben abgebrochenen Lauf.

**Alternatives**: Unterschiede abgleichen — mehr Code, bei unverändertem Dokument dasselbe Ergebnis.

## D-07 Prüfung der Belege — tragender Entwurfsteil

**Decision**: Das Modell liefert je Aussage Abschnittsnummer **und wörtlichen Auszug**. Vor der Anzeige prüft der Server, ob der Auszug — nach Vereinheitlichung von Leerraum — wörtlich im genannten Abschnitt vorkommt. Verweise, die das nicht bestehen, werden verworfen. Bleibt keiner übrig, gilt die Aussage als unbelegt (FR-022).

**Rationale**: FR-030 schließt aus, dass eine Quellenkennung als Beleg genügt. Ohne diesen Schritt prüft nur das Modell sich selbst. Der Abgleich ist deterministisch und anbieterunabhängig; er liefert zugleich den Wortlaut, den FR-028a speichern muss.

**Alternatives**: Dem Modell vertrauen — von FR-030 ausgeschlossen. Zweites Modell als Prüfer — teurer, langsamer, selbst probabilistisch.

## D-08 Streamen und Belegmarken

**Decision**: Antwort als Textstrom, Belege als Marken im Text mit Abschnittsnummer und Auszug. Auflösung und Prüfung nach Abschluss.

**Rationale**: FR-020 verlangt schrittweises Erscheinen; reiner Text streamt ohne Zwischenzustände. Die Prüfung nach D-07 braucht ohnehin die vollständige Antwort.

**Alternatives**: Strukturierte Ausgabe im Strom — unruhige Darstellung. Zweiter Modellaufruf zur Belegzuordnung — doppelte Kosten und Wartezeit.

## D-09 Anweisungen in Dokumenten

**Decision**: Drei Ebenen — Dokumenttext in abgegrenzten Blöcken und in der Systemanweisung als Daten benannt; Abruf serverseitig auf die vom Benutzer ausgewählten Quellen eingegrenzt; Belegprüfung nach D-07.

**Rationale**: FR-024 verlangt, dass Anweisungen im Dokument nichts verändern. Ebene eins ist eine Bitte an das Modell, Ebene zwei eine Schranke: die Filterung liegt **vor** dem Modell und hängt an der Sitzung, also kann kein erzeugter Text den Abruf ausweiten.

**Alternatives**: Nur Formulierungen in der Systemanweisung — keine mechanische Schranke, genügt Prinzip III nicht.

## D-10 Erhöhte Rechte

**Decision**: Der Verarbeitungslauf nutzt die Dienstrolle. Jede Abfrage darin MUSS zusätzlich auf den Eigentümer des Auftrags eingeschränkt werden. Die Dienstrolle wird ausschließlich in `lib/supabase/service.ts` erzeugt und erreicht nie den Browser.

**Rationale**: Die Dienstrolle umgeht RLS; Prinzip II verlangt Beschränkung auf den autorisierten Verarbeitungskontext. Ein einziger Einstiegspunkt macht die Regel prüfbar.

**Alternatives**: Lauf mit Benutzersitzung — scheitert nach dem Abmelden. Dienstrolle frei verfügbar — jede spätere Abfrage ist ein möglicher Bruch.

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

**Alternatives**: Selbst schreiben — Aufwand in Barrierefreiheitsdetails statt Fachlichkeit. Paketabhängigkeit — weniger Kontrolle, und das Briefing nennt diese Quelle.

## D-14 Betriebsumgebung

**Decision**: Supabase als gehostetes Cloud-Projekt, Anwendung vorerst lokal, Prüfläufe gegen eine eigene lokale Instanz.

**Rationale**: Die Cloud hält Daten für die Vorführung. Prüfläufe legen Konten an und setzen das Schema zurück — gegen die Vorführinstanz gerichtet zerstören sie deren Inhalt. Die Sicherheitsregel dazu steht in quickstart.md, Abschnitt „Zwei Supabase-Instanzen".

**Folge**: Eine Cloud-Datenbank erreicht die lokale Anwendung nicht, ein Zeitplan auf Datenbankseite scheidet aus. Der wiederholende Aufruf wird lokal ausgelöst. Das **entfernt** einen Mechanismus aus dem Entwurf.

**Alternatives**: Alles lokal — keine dauerhafte Vorführumgebung. Prüfläufe gegen die Cloud — zerstört Vorführdaten. Zweite Cloud-Instanz für Tests — die lokale leistet dasselbe ohne Kosten.

## D-15 Fortschrittsanzeige

**Decision**: Abfrage in kurzen Abständen, solange ein Auftrag offen ist.

**Rationale**: FR-011 verlangt sichtbare Zustandswechsel ohne Neuladen. Genügt dafür und braucht keine dauerhafte Verbindung; die Zahl gleichzeitiger Aufträge ist durch A-09 klein.

**Alternatives**: Dauerhafte Verbindung — weiterer Mechanismus mit eigenen Zugriffsregeln. **Auslöser für Wechsel**: spürbare Last oder mehrere gleichzeitige Benutzer.

## D-16 Prüfwerkzeuge — Zusätzliche Abhängigkeit

**Decision**: Vitest für reine Logik, Playwright für Abläufe. Zugriffsgrenzen als feste Demo-Matrix gegen die lokale Instanz: Notebook-Seite plus `renameNotebook`, Storage-Download, `POST /api/chat` und `GET /api/jobs/status` jeweils berechtigt, fremd und anonym; interne Jobs mit gültigem, fehlendem und ungültigem Geheimnis sowie einem Cross-User-Worker-Fall. Weitere Server Actions verwenden denselben zentralen Autorisierungsweg. Bewertung und Performance-Smoke-Test laufen als getrennte Kommandos.

**Rationale**: Prinzip II verlangt die benannte positive und negative Demo-Matrix; aussagekräftig nur gegen echte Regeln, nicht gegen Attrappen. Prinzip VI verlangt getrennte Ausweisung von deterministisch, probabilistisch und beobachtend.

**Alternatives**: Zugriffsgrenzen mit Attrappen — prüft den Code, nicht die Regel. Antwortqualität in derselben Suite — macht das Freigabetor von schwankenden Ergebnissen abhängig.
