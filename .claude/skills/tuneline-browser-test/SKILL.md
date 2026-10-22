---
name: tuneline-browser-test
description: Tuneline Ende-zu-Ende im echten Chrome prüfen (Claude in Chrome) — Dev-Server sicher starten und stoppen, Raum ohne Spotify-Login anlegen, gültige iTunes-Testsongs, Bot-Mitspieler, Szenarien mit mehreren Tabs (Reload, Pause, Duplikat-Tab, Resume-Banner, Ergebnis-Screen), Handy-Breite und Aufräumen. Verwende diesen Skill immer, wenn eine Änderung an client/ oder server/ im Browser bestätigt, ein Bug im Spielablauf nachgestellt, das Layout auf Handy-Breite geprüft oder die App "live"/"im Browser" getestet werden soll — auch wenn der Skill nicht genannt wird (z. B. "prüf das mal im Browser", "stell den Bug nach", "run the app", "teste das mit zwei Spielern").
---

# Tuneline im Browser testen

Unit-Tests decken die Logik ab, aber viele Fehler zeigen sich erst im Zusammenspiel: zwei Tabs, ein Reload, ein Server-Event, das ein Screen ignoriert. Dieser Skill beschreibt, wie du so etwas schnell und reproduzierbar im echten Chrome nachstellst, **ohne Spotify-Login**.

Hilfsskripte liegen in `scripts/` neben dieser Datei:

| Datei | Zweck |
|-------|-------|
| `scripts/songs.mjs` | Gültige Testsongs (`SongFull[]`) von der iTunes Search API |
| `scripts/bots.mjs` | Bot-Spieler per `socket.io-client`, die selbst platzieren |
| `scripts/page-helpers.js` | `window.__tl` im Tab: Raum anlegen, Spiel starten, platzieren — mit Timeouts |

## Grundregeln

- **Nie Zugangsdaten eingeben.** Für den echten Spotify-Flow (Playlists, Song-Laden, Lade-Abbruch) loggt sich der User selbst ein. Alles andere geht ohne Login (siehe unten).
- Alles liegt nur im Server-Speicher: Ein Neustart des Servers (auch durch `tsx watch` nach einer Server-Änderung) beendet Räume **und** Spotify-Sessions.
- Arbeite in eigenen Tabs (`tabs_context_mcp` mit `createIfEmpty`, dann `tabs_create_mcp`) und räume am Ende auf.
- Die Chrome-Erweiterung blendet Werte „sensibler“ Storage-Keys in Tool-Ausgaben aus (`[BLOCKED: Sensitive key]`). Prüfe sie deshalb auf vorhanden/`null` statt auf ihren Wert.

## 1. Dev-Server

```bash
# Läuft schon etwas? (alte Sessions blockieren 3001/5174 → EADDRINUSE)
lsof -nP -iTCP:3001 -iTCP:5174 | grep LISTEN
# Alte Prozesse einzeln beenden – zsh teilt "$pids" nicht an Zeilenumbrüchen auf
for p in $(ps -axo pid,command | grep -E "concurrently|tsx watch src/index.ts|node_modules/.bin/vite" | grep -v grep | awk '{print $1}'); do kill "$p"; done
```

`npm run dev` mit `run_in_background` starten. Bereitschaft prüfen — **URL in Anführungszeichen und `-g`**, sonst wertet zsh bzw. curl `[::1]` als Glob aus und der Befehl bricht ab oder hängt:

```bash
until curl -sgf "http://[::1]:3001/health" >/dev/null && curl -sgf -o /dev/null "http://[::1]:5174/"; do sleep 0.5; done; echo ready
```

Die App läuft unter `http://[::1]:5174/` (nicht `localhost` — so ist der Spotify-Redirect konfiguriert).

## 2. Testsongs

```bash
node .claude/skills/tuneline-browser-test/scripts/songs.mjs queen 12 > "$SCRATCH/songs.json"
```

Speichere die Datei im Scratchpad und verwende sie wieder (iTunes erlaubt ca. 20 Suchen pro Minute). `start_game` braucht mindestens 2 Songs pro Spieler; für lange Timelines oder viele Runden entsprechend mehr. Die Previews sind echt, man hört also Musik.

## 3. Host ohne Spotify

Im Host-Tab `http://[::1]:5174/` öffnen, dann `scripts/page-helpers.js` lesen und den **gesamten Inhalt** als Code an `javascript_tool` geben. Danach:

```js
const code = await __tl.createRoom({ audioMode: 'host-only', rounds: 1, turnLimit: 0 });
```

- Der Helfer nutzt die Socket-Instanz der App, deshalb reagiert die UI auf alles. Nach `room_created` bleibt die UI aber auf dem Login-Screen — das ist erwartet (im echten Ablauf wechselt `App.tsx` den Screen). Mit `game_started` springt sie ins Spiel.
- **Host-Lobby sehen:** Spiel starten und sofort `await __tl.request('return_to_lobby', undefined, 'room_updated')` — dann zeigt die UI die Lobby mit allen Host-Einstellungen und Kick-Buttons.
- Songs übergibst du als JSON-Literal im Code: `window.__songs = <Inhalt von songs.json>; await __tl.startGame(__songs, { rounds: 1, audioMode: 'host-only' })`. Auf `window` abgelegt überleben sie Reloads eines iframes.
- **Lange Spiele ohne Klicken:** `__tl.autoPlay(__songs)` vor `createRoom` aufrufen — der Host platziert dann nach jedem Reveal selbst richtig, so wie die Bots.
- Nach einem Reload oder `navigate` ist `window.__tl` weg (bzw. hängt im iframe am alten Socket) — Helfer erneut ausführen.

## 4. Mitspieler

**Echte Gäste (UI-Tests):** neuer Tab mit `http://[::1]:5174/?room=CODE`, Feld „Spielername eingeben“, Button „Beitreten →“. Für jeden Gast ein eigener Tab (sessionStorage ist pro Tab).

**Bots (Füllspieler, lange Timelines, viele Spieler):**

```bash
node .claude/skills/tuneline-browser-test/scripts/bots.mjs CODE 4 --songs "$SCRATCH/songs.json"
```

Mit `run_in_background` starten, Ausgabe über die Output-Datei lesen, mit `TaskStop` beenden. Bots platzieren nach dem 3-s-Reveal selbst. Mit `--songs` platzieren sie richtig (Timelines wachsen), ohne zufällig. Weitere Optionen: `--names "Maximilian-Alexander,Bo"` (lange Namen für Layout-Tests), `--leave-after-game`, `--think 4000` (Bedenkzeit pro Zug, Standard 1000 ms). Mit der Standard-Bedenkzeit beginnt schon 1 s nach Zugbeginn die nächste Auflösung — wer den Zustand *zu Beginn* eines Zugs messen will, erhöht sie.

## 5. Beobachten

- **Sichtbarer Zustand:** `__tl.text()` bzw. `document.body.innerText`; Screenshots mit `scale: 0.5`, Details per `zoom`.
- **Läuft Audio wirklich?** `read_network_requests` mit `urlPattern: "audio-ssl"` (vor der Aktion mit `clear: true` leeren). Ein Request mit Status 206 heißt: die Preview wird abgespielt. Die UI zeigt dann „⏸ Pause“.
- **Storage:** Keys stehen in `client/src/constants.ts` (`STORAGE_KEYS`): `tuneline_room_code` und `tuneline_player_token` (sessionStorage), `tuneline_last_room` (localStorage). Nur `=== null` prüfen.
- **Server-Log:** Output-Datei des `npm run dev`-Tasks (pino, Events wie `leave_room`, `start_game_denied`).

## 6. Szenarien

| Szenario | So stellst du es her | Erwartung |
|----------|----------------------|-----------|
| Reload Host im Modus „nur Host“ | Host-Tab per `navigate` auf dieselbe URL | Automatisch zurück im Spiel, Preview-Request (206), „⏸ Pause“ |
| Reload Gast | Gast-Tab neu laden | Zurück im Spiel; beim Gast im Modus „nur Host“: „Die Musik läuft beim Host“ |
| Pause | Host-Tab schließen, oder Spieler am Zug offline | Alle sehen die Pause. Anderer Spieler offline → nur „offline“-Markierung, keine Pause |
| Resume-Banner | Tab schließen (`tabs_close_mcp`), neuer Tab auf `/` | Banner „Zurück ins Spiel“ → Klick → wieder im Spiel |
| Resume-Fehlerfall | `localStorage.setItem('tuneline_last_room', JSON.stringify({ roomCode: 'ZZ9ZZ9', playerToken: 'x'.repeat(48), playerName: 'Anna', savedAt: Date.now() }))`, neu laden, Banner klicken | Toast „Der Raum existiert nicht mehr.“, Banner weg, Key gelöscht, nach Reload kein Banner |
| Duplikat-Tab | Im Original-Tab Raumcode und Token in einen temporären localStorage-Key kopieren (nur im Seitenkontext, nicht ausgeben), im neuen Tab in sessionStorage schreiben, Key löschen, neu laden | Neuer Tab startet ohne Spieler, Original spielt weiter |
| Platz übernehmen | Im zweiten Tab mit kopiertem Token `__tl.request('rejoin_room', { roomCode, playerToken }, 'room_joined')` | Alter Tab: „Du spielst jetzt in einem anderen Tab weiter.“ |
| Ergebnis-Screen | `rounds: 1`, jeder platziert einmal (`__tl.place(0)`, beim Gast nach dem Reveal) | „Spiel beendet“; verlässt ein Gast den Raum, sieht der Host ihn als „verlassen“ |
| Zeitlimit | `createRoom({ turnLimit: 30 })` | Countdown im Spiel; nach Ablauf zählt der Zug als falsch |
| Zentrieren bei Zugbeginn | Lange Timelines per `bots.mjs --songs`, Host mit `__tl.autoPlay`; im iframe `Element.prototype.scrollTo` umhüllen und Ziel, Vorher- und Nachher-Wert protokollieren | Bei jedem Zugbeginn (nach der Auflösung) ein Aufruf je Scroller: eigene Timeline zur Mitte (nur im eigenen Zug), Panel und Chip des Spielers am Zug mittig, an den Rändern begrenzt. Positionen nachträglich messen ist unzuverlässig, weil schnelle Bots schon die nächste Auflösung starten |

Host-Timeout (2 Minuten offline → Spielende) und Timer-Grenzfälle sind in `server/src/rooms.test.ts` mit Fake-Timern abgedeckt — dafür nicht im Browser warten.

## 7. Handy-Breite

`resize_window` ändert ein maximiertes Fenster nicht (`innerWidth` bleibt bei der Bildschirmbreite) — prüfe kurz `innerWidth` und nimm sonst direkt iframes auf einer Seite des Dev-Servers. Media Queries greifen auf die iframe-Breite; Screenshots mit `zoom` auf die iframe-Region. Die iframes zeigen eine Scrollleiste, sind also ~16 px schmaler als ein echtes Handy — eher strenger als die Realität.

**Screens ohne Raum** (Login, Beitreten mit `/?room=ABC123`, Anleitung): drei Breiten nebeneinander.

```js
const frames = (src) => [320, 375, 414].map((w) => `<div style="display:inline-block;vertical-align:top;margin-right:12px"><div style="color:#888;font:12px monospace">${w}px</div><iframe src="${src}" style="width:${w}px;height:700px;border:1px solid #333"></iframe></div>`).join('');
document.open(); document.write(`<body style="margin:8px;background:#000">${frames('/')}</body>`); document.close();
```

In den iframes per `f.contentDocument` klicken (z. B. `querySelector('[title="Spielanleitung"]').click()`).

**Screens im Raum** (Lobby, Spiel, Ergebnis): **ein** iframe — mehrere iframes teilen sich das sessionStorage des Tabs und würden um denselben Platz streiten (Duplikat-Schutz). Breite per `iframe.style.width = '320px'` wechseln, die App bleibt dabei im Zustand.

```js
document.open(); document.write('<body style="margin:8px;background:#000"><iframe id="m" src="/" style="width:375px;height:700px;border:1px solid #333"></iframe></body>'); document.close();
// nach dem Laden:
window.__tlTarget = document.getElementById('m').contentWindow;  // dann page-helpers.js ausführen
```

Vor dem Wechsel zwischen den Aufbauten die Raum-Keys im iframe löschen, sonst landen alle iframes per Auto-Rejoin im alten Raum.

**Prüfen:** `__tl.layoutIssues()` je Breite (320, 375, 414) liefert seitliches Scrollen, Elemente über den Rand (Inhalt horizontaler Scroller wird ignoriert) und kleine Tap-Ziele. Dazu Screenshots: überlappende Elemente (der schwebende Reaktions-Button unten rechts!), abgeschnittene Texte, lange Namen (`bots.mjs --names`), viele Spieler (Kopfzeile), lange Timelines (`--songs`, mehrere Runden), Toasts.

Ohne Spotify-Login nicht erreichbar: Menü- und Playlist-Screen — dafür den User einloggen lassen.

## Stolperfallen

- **Emits ohne Verbindung werden gepuffert** und beim späteren `connect()` nachgeholt — so entstehen doppelte Räume („Du bist bereits in einem Raum.“). Deshalb immer über `__tl` (verbindet zuerst, hat Timeouts).
- **Limits des Servers:** 5 offene Räume pro IP, 1 pro Socket, 15 Events/s pro Socket, 30 Socket-Verbindungen pro IP, und nach 20 Beitritten mit unbekanntem Raum-Code bzw. fehlgeschlagenen Rejoins pro IP ist Beitreten 10 Minuten gesperrt. Alle Tabs und Bots laufen über dieselbe IP — bei vielen Testläufen (z. B. mehrfach „Resume-Fehlerfall“) den Server neu starten, statt die Zähler zu füllen.
- **Production-Modus mit Spotify-Login lokal:** `npm run build` mit `VITE_SERVER_URL='http://[::1]:5174' npm run build -w @tuneline/client`, dann `set -a && . server/.env.local && set +a && NODE_ENV=production PORT=5174 FRONTEND_ORIGIN='http://[::1]:5174' SPOTIFY_REDIRECT_URI='http://[::1]:5174/api/auth/callback' node server/dist/index.js` (Hintergrund). Ohne `VITE_SERVER_URL` verbindet der Build den Socket zu Port 3001. `page-helpers.js` geht dort nicht (kein `/src/socket.ts` im Build) — über die Oberfläche klicken, Bots mit `--server 'http://[::1]:5174'`.
- **CSP-Verstöße** tauchen **nicht** in `read_console_messages` auf. Abfragen mit `ReportingObserver` und `buffered: true` (liefert alles seit dem Laden der Seite): `new ReportingObserver(cb, { types: ['csp-violation'], buffered: true })`; zur Kontrolle einmal absichtlich ein Bild von `https://example.com` laden — das muss als `img-src`-Verstoß erscheinen.
- **Platzierungen während des Reveals** (3 s nach `placement_result`) bringen die UI durcheinander — erst danach platzieren.
- **Prettier nur auf `client/src`** anwenden: `npx prettier --write` auf Server-Dateien formatiert sie mit der Client-Konfiguration um.
- **Autoplay:** Ohne echten Klick kann Chrome die Wiedergabe blockieren (im iframe-Aufbau praktisch immer) — „▶ Play“ statt „⏸ Pause“ nach einem per Skript ausgelösten Start ist dann kein Bug. Ob Audio grundsätzlich lädt, zeigt `read_network_requests`.
- Server-Änderungen starten den Server per `tsx watch` neu → laufende Räume und Logins sind weg; Szenario neu aufbauen.

## Aufräumen

1. In jedem eigenen Tab die Storage-Keys löschen (`sessionStorage.removeItem(...)`, `localStorage.removeItem('tuneline_last_room')`), damit der User nicht in einem Testraum landet.
2. Eigene Tabs mit `tabs_close_mcp` schließen.
3. Bots und Dev-Server mit `TaskStop` beenden und prüfen: `lsof -nP -iTCP:3001 -iTCP:5174 | grep LISTEN` ist leer.
4. Dem User berichten, was im Browser tatsächlich gesehen wurde — und was nicht geprüft werden konnte (z. B. echte Handys, Spotify-Flows ohne Login).
