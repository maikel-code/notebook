# AGENTS.md

Lies vor der Arbeit `.specify/memory/constitution.md` und die Artefakte des
aktiven Features. Die Constitution regelt Qualität, Prüfung und Ausnahmen;
diese Datei regelt Zuständigkeiten und Übergaben.

## Schreibstil

Schreibe kurz, dicht und konkret: eine Aussage pro Regel, jede Regel nur an
einer Stelle. Verweise auf bestehende Vorgaben statt sie zu wiederholen.
Streiche Einleitungen, Füllsätze und Erklärungen ohne Entscheidungsnutzen.
Erhalte beim Kürzen Verbindlichkeit, Bedingungen, Ausnahmen und Nachweise;
Lesbarkeit geht vor Telegrammstil.

## Rollen

- **Maintainer:** entscheidet Scope, Stack, Daten- und Zugriffsmodell, neue
  Abhängigkeiten, Ausnahmen und Merge. Gibt `spec.md` und `plan.md` frei.
- **Claude Code:** erstellt Spezifikation, Plan und Aufgaben; prüft die
  Implementierung in einer separaten Sitzung. Ändert keinen Anwendungscode.
- **Codex:** implementiert freigegebene Aufgaben und behebt Review-Befunde.
- Agenten mergen nicht. Der Autor ist nie alleiniger Prüfer seiner Änderung.
- Constitution, `AGENTS.md` und `.specify/templates/` ändert nur der Maintainer.

## Arbeitsablauf

1. Originalaufgabe lesen; fehlende Vorgaben als offene Fragen markieren.
2. Claude: `specify` → bei Bedarf `clarify` → `plan`.
3. Maintainer: Spezifikation und Plan freigeben.
4. Claude: `tasks`; Codex: `analyze` vor der Implementierung.
5. Codex: vereinbarte Aufgaben umsetzen und Verifikation ausführen.
6. Claude: unabhängiges Review; Befunde zur Behebung an Codex zurückgeben.
7. Maintainer: Abnahme und Merge.

Skill-Aufrufe: Claude `/speckit-<name>`, Codex `$speckit-<name>`.
Akzeptanzkriterien stehen vor dem ersten Code-Edit fest. Aufgaben gelten nur
mit Nachweis als abgeschlossen. Es gelten die Qualitätsgates der Constitution.

## Worktrees

- Vor jedem Auftrag Feature-Verzeichnis, Task-IDs, Branch und Worktree benennen.
- Parallele Agenten verwenden getrennte Worktrees mit eigenen Branches;
  ein Feature darf mehrere Arbeits- oder Review-Branches haben.
- Branches und Worktrees ausdrücklich anlegen; ihre Erstellung nicht als
  automatische Wirkung von `speckit-specify` voraussetzen.
- Nur im zugewiesenen Worktree und Aufgabenbereich ändern. Fremde
  Feature-Verzeichnisse nicht bearbeiten; Befunde außerhalb des Bereichs melden.
- Vor Übergaben den Arbeitsstand übertragen und den zu prüfenden Commit benennen.
  Worktrees teilen keine uncommittierten Änderungen.

## Review und Handoff

Reviews beginnen in einer frischen Sitzung. Grundlage sind Originalaufgabe,
Constitution, freigegebene Feature-Artefakte und der tatsächliche Code samt Diff.
Der Handoff ist ein Wegweiser und ersetzt keine unabhängige Prüfung.
Der Reviewer meldet Befunde mit Belegen und korrigiert Anwendungscode nicht selbst.

Jeder Handoff enthält knapp:

- **Stand:** Feature, Task-IDs, Branch und Commit; uncommittierte Änderungen benennen.
- **Änderung:** Ergebnis und wesentliche Entscheidung mit Begründung.
- **Prüfung:** ausgeführte Befehle und Ergebnisse oder reproduzierbare manuelle Schritte.
- **Offen:** Einschränkungen, fehlende Prüfungen und nächste Aufgabe.

Offene Projektentscheidungen stehen bei den zugehörigen Feature-Artefakten.
Mit der Stack-Festlegung MUSS eine README mit Voraussetzungen sowie Setup-, Start-
und Prüfkommandos entstehen.
