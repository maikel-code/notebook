# Phase 0 — Entscheidungen und Begründungen

**Feature**: 001-notebook-source-qa · **Datum**: 2026-09-14

Jede Entscheidung nennt die verworfene Alternative. Prinzip IV verlangt für jede zusätzliche Abhängigkeit einen konkreten Nutzen; die betroffenen Einträge sind als **Zusätzliche Abhängigkeit** gekennzeichnet.

D-04 (Modellanbieter) und D-14 (Betriebsumgebung) wurden am 2026-09-15 vom Maintainer entschieden und sind unten in der beschlossenen Fassung festgehalten.

---

## D-01 Rahmenwerk und Rendering

**Decision**: Next.js im App Router. Server Components für Listen und Detailansichten, Client Components nur dort, wo Interaktion nötig ist. Route Handlers für Antwortstrom und Verarbeitungsaufträge.

**Rationale**: Vom Briefing vorgegeben. Der App Router erlaubt, Datenzugriff auf dem Server zu halten — das ist für Prinzip II wesentlich, weil die Zugriffsprüfung dann nicht im Browser stattfindet.

**Alternatives considered**: Pages Router (älteres Modell, keine Server Components); getrenntes Backend (widerspricht dem vorgegebenen Rahmen und verdoppelt die Typdefinitionen).

## D-02 Datenhaltung, Authentifizierung, Dateiablage

**Decision**: Supabase für alles drei. Postgres mit Row-Level-Security, Supabase Auth mit E-Mail und Passwort (A-02), Supabase Storage mit einem privaten Bucket.

**Rationale**: Vom Briefing vorgegeben. Die Zugriffsgrenze aus Prinzip II lässt sich damit in der Datenbank selbst verankern statt in der Anwendungsschicht — eine vergessene Prüfung im Code führt dann nicht zum Datenabfluss.

**Alternatives considered**: Zugriffsprüfung ausschließlich in der Anwendung (widerspricht Prinzip II, weil eine einzige vergessene Abfrage die Grenze aufhebt).

## D-03 Abrufverfahren

**Decision**: Zerlegung der Dokumente in Textabschnitte, Einbettung je Abschnitt, Ähnlichkeitssuche über `pgvector`. Kein Übergeben ganzer Dokumente an das Sprachmodell.

**Rationale**: `pgvector` ist Bestandteil von Supabase, also kein zusätzlicher Dienst. Verweise brauchen ohnehin eine abgegrenzte Passage mit Seitenbezug (FR-028); Abschnitte sind genau diese Einheit. Die Kosten bleiben unabhängig von der Dokumentgröße.

**Alternatives considered**: Ganze Dokumente im Kontext eines Modells mit großem Kontextfenster — einfacher zu bauen, aber jede Frage kostet die volle Dokumentmenge, und die Belegstelle muss trotzdem nachträglich lokalisiert werden. Zusätzliche Stichwortsuche neben der Vektorsuche — heute nicht enthalten; **Auslöser für Nachrüstung**: verfehlt der Bewertungslauf SC-004 (Belegtreue) bei Fragen nach Eigennamen, Zahlen oder Aktenzeichen, wird eine Volltextsuche ergänzt und mit der Vektorsuche kombiniert.

## D-04 Modellanbieter — entschieden 2026-09-15

**Decision**: Antworterzeugung über Anthropic Claude, Einbettungen über OpenAI (`text-embedding-3-small`). Beide angebunden über das Vercel AI SDK.

**Rationale**: Der Maintainer verfügt über beide Konten, damit entfällt das Argument, das in der ersten Fassung für einen einzigen Anbieter sprach. Anthropic stellt keine Schnittstelle für Einbettungen bereit, weshalb diese ohnehin von einem zweiten Anbieter kommen müssen. Das AI SDK kapselt die Erzeugung, ein späterer Wechsel des Antwortmodells betrifft eine Konfigurationsstelle.

**Folge, die im Entwurf abgedeckt sein muss**: zwei Anbieter bedeuten **zwei unabhängige Ausfallpfade**. Sie treffen verschiedene Abläufe und müssen getrennt behandelt werden:

| Ausfall | Betroffener Ablauf | Verhalten |
|---|---|---|
| Einbettungen nicht erreichbar | Aufnahme neuer Quellen | Verarbeitungsauftrag scheitert in Phase `embed`, Wiederholung nach FR-037; bestehende Quellen bleiben nutzbar |
| Antwortmodell nicht erreichbar | Fragen stellen | Nachricht erhält `failed`, erneuter Versuch wird angeboten (FR-025); Aufnahme läuft weiter |

SC-010 ist damit in zwei Prüffällen nachzuweisen, nicht in einem. Nachweislauf 9 in quickstart.md deckt beide ab.

**Alternatives considered**: OpenAI für beides — heute nur noch ein Argument der Bequemlichkeit, nicht der Notwendigkeit, da beide Konten vorhanden sind. Gemini für die Erzeugung — gleichwertig, kein Grund zu wechseln.

**Bleibt zu beachten**: Ein Wechsel des Einbettungsmodells erzwingt die Neuberechnung aller Abschnitte. Vor dem ersten Import ist das folgenlos, danach kostet es einen vollständigen Durchlauf über den Bestand.

## D-05 Hintergrundverarbeitung

**Decision**: Eine Tabelle `ingestion_jobs` ist die Zustandsmaschine. Ein Route Handler holt sich einen Auftrag atomar (`FOR UPDATE SKIP LOCKED`), führt ihn in Phasen aus und schreibt den Fortschritt zurück. Drei Auslöser: unmittelbar nach dem Upload, ein wiederholender Aufruf für hängengebliebene Aufträge, und der manuelle Wiederholversuch aus der Oberfläche.

**Rationale**: FR-011, FR-012, FR-014 und FR-037 verlangen zusammen sichtbaren Fortschritt, manuelle Wiederholung, begrenzte automatische Wiederholung und Idempotenz. Die Datenbank als Zustandshalter erfüllt alle vier: der Versuchszähler liegt neben dem Auftrag, `SKIP LOCKED` verhindert Doppelverarbeitung, und ein abgestürzter Lauf wird vom wiederholenden Aufruf eingesammelt statt dauerhaft „wird verarbeitet" anzuzeigen.

**Alternatives considered**: Verarbeitung direkt im Upload-Aufruf — stirbt mit der Zeitgrenze der Umgebung und kennt keinen Wiederanlauf. Supabase Edge Functions — eigene Laufzeit in Deno, dadurch eine zweite Sprache und eine zweite Umgebung für dieselbe PDF-Bibliothek; der Nutzen rechtfertigt das hier nicht.

## D-06 Idempotenz der Verarbeitung

**Decision**: Ein Verarbeitungsauftrag löscht vor dem Schreiben alle Textabschnitte seiner Quelle und schreibt sie neu. Der Schlüssel ist die Quellen-Kennung, nicht der Lauf.

**Rationale**: FR-014 verbietet doppelte Abschnitte bei wiederholter Verarbeitung. Löschen-und-neu-schreiben innerhalb einer Transaktion ist die einfachste Form, die das garantiert, auch wenn ein früherer Lauf mitten in der Arbeit abgebrochen ist.

**Alternatives considered**: Abschnitte vergleichen und nur Unterschiede schreiben — mehr Code für einen Fall, der bei unverändertem Dokument ohnehin dasselbe Ergebnis liefert.

## D-07 Prüfung der Belege — **tragender Entwurfsteil**

**Decision**: Das Modell liefert zu jeder belegten Aussage die Kennung des Abschnitts **und den wörtlichen Auszug**, auf den es sich stützt. Vor der Anzeige prüft der Server für jeden Verweis, ob dieser Auszug — nach Vereinheitlichung von Leerraum — wörtlich im genannten Abschnitt vorkommt. Verweise, die das nicht bestehen, werden verworfen. Bleibt danach kein Verweis übrig, gilt die Aussage als unbelegt und fällt unter FR-022.

**Rationale**: FR-030 verlangt, dass eine Quellenkennung allein nicht als Beleg zählt. Ohne diesen Schritt prüft nur das Modell sich selbst. Der Abgleich ist deterministisch, schnell und unabhängig vom Anbieter — er verwandelt eine Qualitätshoffnung in eine Zusicherung. Zusätzlich liefert er genau den Wortlaut, den FR-028a beim Verweis speichern muss.

**Alternatives considered**: Dem Modell vertrauen — die von FR-030 ausgeschlossene Variante. Ein zweites Modell als Prüfer — teurer, langsamer und selbst wieder probabilistisch.

## D-08 Streamen und Belegmarken

**Decision**: Die Antwort wird als Text gestreamt. Belege stehen als Marken im Text, die Abschnittskennung und wörtlichen Auszug tragen. Der Server löst die Marken nach Abschluss auf, prüft sie nach D-07 und speichert Antwort samt geprüften Verweisen.

**Rationale**: FR-020 verlangt schrittweises Erscheinen. Reiner Text streamt ohne Zwischenzustände; ein teilweise gefülltes Objekt erzeugt beim Rendern Sprünge. Die Prüfung nach D-07 braucht ohnehin die vollständige Antwort.

**Alternatives considered**: Strukturierte Ausgabe im Strom — sauberere Typen, aber unruhige Darstellung während der Erzeugung. Nachgelagerter zweiter Modellaufruf zur Belegzuordnung — verdoppelt Kosten und Wartezeit.

## D-09 Umgang mit Anweisungen in Dokumenten

**Decision**: Drei Ebenen. Erstens steht Dokumenttext in klar abgegrenzten Blöcken, und die Systemanweisung benennt ihn als Daten. Zweitens wird der Abruf immer auf die vom Benutzer ausgewählten Quellen eingegrenzt — die Auswahl entsteht im Server aus der Sitzung, nie aus dem Modellergebnis. Drittens greift die Belegprüfung aus D-07.

**Rationale**: FR-024 verlangt, dass Anweisungen im Dokument weder Antwortverhalten noch Zugriffsgrenzen verändern. Die erste Ebene allein ist eine Bitte an das Modell. Erst die zweite macht daraus eine Grenze: kein erzeugter Text kann den Abruf auf fremde Daten ausweiten, weil die Filterung vor dem Modell stattfindet und an der Sitzung hängt.

**Alternatives considered**: Ausschließlich Formulierungen in der Systemanweisung — genügt Prinzip III nicht, weil keine mechanische Schranke entsteht.

## D-10 Erhöhte Rechte im Hintergrundlauf

**Decision**: Der Verarbeitungslauf nutzt die Dienstrolle, weil er ohne Benutzersitzung arbeitet. Jede Abfrage darin MUSS zusätzlich explizit auf den Eigentümer des Auftrags eingeschränkt werden. Die Dienstrolle wird ausschließlich in `lib/supabase/service.ts` erzeugt; kein anderer Pfad darf sie verwenden, und sie erreicht niemals den Browser.

**Rationale**: Die Dienstrolle umgeht RLS. Prinzip II verlangt, privilegierte Zugriffe auf den autorisierten Verarbeitungskontext zu beschränken. Ein einziger Einstiegspunkt macht diese Regel prüfbar statt zur Disziplinfrage.

**Alternatives considered**: Verarbeitung mit der Benutzersitzung — scheitert, weil der Lauf nach dem Abmelden weiterläuft. Dienstrolle frei verfügbar — dann ist jede spätere Abfrage ein möglicher Bruch der Grenze.

## D-11 Textextraktion und Belegansicht — **Zusätzliche Abhängigkeit**

**Decision**: `pdf.js` in beiden Rollen — serverseitig zur seitenweisen Textextraktion, clientseitig zur Anzeige mit hervorgehobener Passage. Gespeichert werden Abschnittstext, Seitenbereich und der Wortlaut des Belegs; die Anzeige sucht den Wortlaut in der Textebene der Seite. Wird er nicht gefunden, wird die ganze Seite geöffnet und der Abschnitt als Text daneben gezeigt.

**Rationale**: FR-029 verlangt Sprung zur Passage mit Hervorhebung. Zeichenpositionen aus der Extraktion stimmen nicht zwingend mit der gerenderten Textebene überein; die Suche nach dem Wortlaut ist robuster als gespeicherte Positionen. Der Rückfall verhindert, dass ein Beleg unbrauchbar wird, wenn die Suche scheitert.

**Alternatives considered**: Zeichenpositionen speichern und direkt hervorheben — bricht bei abweichender Textebene. Serverseitig gerenderte Seitenbilder — verliert die Textauswahl und erzeugt zusätzliche Ablage.

## D-12 Node-Version

**Decision**: Node 22 LTS, gepinnt über `.nvmrc` und das Feld `engines` in `package.json`.

**Rationale**: Lokal läuft v25.4.0. Version 25 ist eine ungerade Ausgabe ohne Langzeitunterstützung. Prinzip VII verlangt reproduzierbares Setup mit benannten Voraussetzungen; eine nicht langzeitgepflegte Laufzeit widerspricht dem und erzeugt Abweichungen zwischen Entwicklungs- und Betriebsumgebung.

**Alternatives considered**: Die vorhandene v25 nutzen — spart heute einen Schritt und kostet später die Frage, warum etwas nur auf einem Rechner läuft.

## D-13 Komponenten und Barrierefreiheit — **Zusätzliche Abhängigkeit**

**Decision**: Komponenten von neobrutalism.com über die shadcn-kompatible Befehlszeile nach `components/ui/` kopieren. Tailwind CSS v4. Die Primitive stammen von Radix UI, Base UI und React Aria.

**Rationale**: FR-034 und SC-009 verlangen Tastaturbedienung, sichtbaren Fokus, beschriftete Bedienelemente und zugeordnete Fehlermeldungen. Die genannten Primitive bringen Fokusführung, Tastaturmuster und ARIA-Zuordnung mit; das selbst zu bauen wäre Aufwand ohne Gegenwert. Die Komponenten liegen als Quelltext im Repository, unterliegen damit denselben Anforderungen wie eigener Code (Prinzip I).

**Zu prüfen vor Verwendung**: Erstens die Lizenz der offenen Komponenten — die Seite nennt sie als quelloffen, ohne dass ich die Lizenzbezeichnung geprüft habe. Zweitens Kontrastwerte und die Sichtbarkeit des Fokusrings, weil die kräftige Gestaltung Umrandungen und Schatten stark verändert; der Fokus darf dabei nicht verschwinden.

**Alternatives considered**: Komponenten selbst schreiben — verlagert Aufwand in Barrierefreiheitsdetails statt in die Fachlichkeit. Eine Bibliothek als Paketabhängigkeit — weniger Kontrolle über Anpassungen, und das Briefing nennt diese Quelle ausdrücklich.

## D-14 Betriebsumgebung — entschieden 2026-09-15

**Decision**: Supabase läuft als gehostetes Projekt in der Cloud. Die Next.js-Anwendung läuft vorerst lokal. Die automatisierten Prüfläufe arbeiten gegen eine **eigene lokale Supabase-Instanz**, nicht gegen die Cloud.

**Rationale**: Die Cloud-Instanz hält Daten über Sitzungen hinweg und ist damit die Umgebung, in der sich das Projekt vorführen lässt. Für die Entwicklung genügt die lokal laufende Anwendung. Die Prüfläufe brauchen dagegen eine Datenbank, die man ohne Bedenken leeren kann — sie legen Benutzerkonten an, prüfen verweigerte Zugriffe und setzen das Schema zurück. Gegen die Vorführinstanz gerichtet würde das deren Inhalt zerstören.

**Folge für die Wiederaufnahme hängender Aufträge**: Eine Datenbank in der Cloud kann eine lokal laufende Anwendung nicht erreichen. Ein Zeitplan auf Datenbankseite scheidet damit aus. Der wiederholende Aufruf wird lokal ausgelöst — über `pnpm worker:sweep` oder ein Intervall während der Entwicklung. Das **entfernt einen Mechanismus aus dem Entwurf**, statt einen hinzuzufügen: der Endpunkt bleibt, der Zeitplandienst in der Datenbank entfällt. Wird die Anwendung später veröffentlicht, ruft ein Zeitplan dort denselben Endpunkt auf.

**Sicherheitsregel, die daraus folgt**: `supabase db reset` wirkt auf die **lokale** Instanz. Es darf im Projekt an keiner Stelle mit dem Zusatz für die verknüpfte Instanz versehen werden, weil es sonst die Cloud-Datenbank leert. Schemaänderungen gelangen ausschließlich über `supabase db push` in die Cloud.

**Alternatives considered**: Alles lokal — verliert die dauerhafte Vorführumgebung. Prüfläufe gegen die Cloud — zerstört Vorführdaten und macht die Läufe voneinander abhängig. Eine zweite Cloud-Instanz nur für Tests — möglich, aber die lokale Instanz leistet dasselbe ohne Kosten und ohne Netzabhängigkeit.

## D-15 Fortschrittsanzeige

**Decision**: Die Oberfläche fragt den Zustand offener Verarbeitungsaufträge in kurzen Abständen ab, solange mindestens einer offen ist, und hört danach auf.

**Rationale**: FR-011 verlangt sichtbare Zustandswechsel ohne Neuladen. Abfragen im Sekundentakt genügen dafür und brauchen keine dauerhafte Verbindung. Die Zahl gleichzeitiger Aufträge ist durch A-09 klein.

**Alternatives considered**: Ereignisse über eine dauerhafte Verbindung — eleganter, aber ein weiterer Mechanismus mit eigenen Zugriffsregeln und eigenem Wiederverbindungsverhalten. **Auslöser für Wechsel**: wenn die Abfragen spürbare Last erzeugen oder mehrere Benutzer gleichzeitig arbeiten sollen.

## D-16 Prüfwerkzeuge — **Zusätzliche Abhängigkeit**

**Decision**: Vitest für reine Logik, Playwright für Abläufe im Browser. Zugriffsgrenzen werden als eigener Integrationslauf gegen eine lokale Supabase-Instanz mit zwei echten Benutzerkonten und einem anonymen Zugriff geprüft. Der Bewertungslauf am Referenzdatensatz ist ein getrenntes Kommando.

**Rationale**: Prinzip II verlangt positive und negative Prüfungen der Zugriffsgrenzen; das ist nur gegen eine echte Datenbank mit echten Regeln aussagekräftig, nicht gegen Attrappen. Prinzip VI verlangt die getrennte Ausweisung deterministischer und probabilistischer Prüfungen — deshalb ein eigenes Kommando außerhalb der Freigabetore.

**Alternatives considered**: Zugriffsgrenzen mit Attrappen prüfen — prüft den Code, nicht die Regel, und hätte den Fehler, den Prinzip II verhindern soll, nicht gefunden. Antwortqualität in dieselbe Testsuite legen — macht das Freigabetor von schwankenden Ergebnissen abhängig und verletzt Prinzip VI.
