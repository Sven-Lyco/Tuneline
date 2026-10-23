# Tuneline — Claude Code Instructions

## Projekt

Digitales Musik-Timeline-Partyspiel (ähnlich Hitster). Der Host wählt Spotify-Playlisten aus.
Song-Metadaten (Titel, Interpret, Jahr, Cover) kommen von der Spotify Web API. Audio-Previews
kommen über die iTunes Search API (30s Previews, kein Premium nötig).
Spieler ordnen Songs chronologisch in ihre persönliche Timeline ein. Wer richtig platziert, bekommt einen Punkt.

## Tech Stack

- **React 19 + TypeScript 5** — Vite als Build-Tool
- **Emotion** (`@emotion/styled`, `@emotion/react`) — CSS-in-JS, **keine `.css`-Dateien**
- **Spotify Web API** — PKCE OAuth, Playlisten-Auswahl, Track-Metadaten
- **iTunes Search API** — Audio-Previews (30s, kein Auth, CORS nativ, kein Premium nötig)
- **Socket.io** — Echtzeit-Kommunikation Client ↔ Server
- **Express** — HTTP-Server + Static Serving des Client-Builds in Production
- **ESLint v9** (flat config) + `typescript-eslint` + `eslint-config-prettier`
- **Prettier** für Formatierung
- Google Fonts (Space Mono + Outfit) direkt in `index.html` via `<link>`

## Wichtige Konventionen

- **Kein CSS** — ausschließlich Emotion (`styled`, `Global`, inline `style` für dynamische Werte)
- **data-Attribute** für conditional CSS in styled components (z.B. `data-active`, `data-disabled`)
  statt prop-forwarding, um React DOM-Warnings zu vermeiden
- **TypeScript strict** — Client-Typen in `client/src/types.ts`, gemeinsame Typen in `shared/src/index.ts`
- Entry point: `client/src/main.tsx`

## Monorepo-Struktur

```text
Tuneline/
  client/                   ← React-Frontend (Vite)
    src/
      types.ts              Screen, Feedback, GameResult (SpotifyPlaylist re-export aus @tuneline/shared)
      constants.ts          PLAYER_COLORS, RANK_MEDALS, STORAGE_KEYS
      socket.ts             Socket.io-Singleton (typed mit Shared-Events)
      api/
        spotify.ts          Server-API-Wrapper: /api/auth/*, /api/playlists, /api/songs
      utils/
        shuffle.ts          sortByYear<T>()
        audio.ts            playAudio, stopAudio, toggleAudio, getVolume, setVolume
                            (iTunes Preview via HTMLAudioElement; Lautstärke in localStorage)
        roomStorage.ts      Sitzplatz in sessionStorage (Reload) + lastRoom in localStorage (Zurück-Button)
        playedSongs.ts      Gespielte Song-IDs in localStorage (max. 1000, 24 h) → excludeIds auch im nächsten Raum
        spotifyMessages.ts  Texte, wenn Spotify Playlists oder Songs verweigert
        tabPresence.ts      BroadcastChannel: hält ein anderer Tab diesen Platz? (Duplikat-Schutz)
      hooks/
        useGameAudio.ts     playing, volume, startSong, stopSong, toggle, changeVolume
        useSocketEvents.ts  alle Socket-Events + abgeleiteter State (screen, gameState …)
        useRoomCodeCopy.ts  Clipboard-Copy + Feedback-State für Raum-Code
      components/
        GlobalStyles.tsx    Emotion Global — @keyframes + CSS Reset
        ErrorBoundary.tsx   React Error Boundary
        Vinyl.tsx           Drehendes Vinyl mit Cover-Art
        Wave.tsx            Animierte Equalizer-Welle
        DropZone.tsx        Platzierungs-Slot in der Timeline
        Confetti.tsx        Gewinner-Konfetti
        Label.tsx           Beschriftungs-Komponente
        PlaylistBadge.tsx   Playlist-Cover + Name Badge
        Reactions.tsx       Emoji-Reaktionen während des Spiels
        RoomCodeCopy.tsx    Raum-Code Anzeige mit Copy-Button
        InviteQr.tsx        Einladungslink als QR-Code (Overlay; Lobby + Spiel-Header), qrcode.react
        ResumeBanner.tsx    „Zurück ins Spiel“ nach geschlossenem Tab
        TurnLimitPicker.tsx Zeitlimit-Auswahl (Aus/30/60/90 s)
        game/
          GameHeader.tsx    Header-Leiste (Runde, Spieler-Chips, Raum-Code)
          SongCard.tsx      Vinyl + Song-Info + Audio-Controls + Wave
          MyTimeline.tsx    Eigene Timeline mit DropZones
          OtherPlayers.tsx  Mini-Panels der anderen Spieler
          DisconnectOverlay.tsx  Overlay bei Verbindungsverlust
          TurnTimer.tsx     Countdown für das Zeitlimit
      screens/
        LoginScreen.tsx     Spotify-Login + Gast-Join-Button
        HelpScreen.tsx      Spielanleitung (Host + Spieler Tabs)
        JoinScreen.tsx      Raum-Code + Name eingeben (Gäste)
        PlaylistScreen.tsx  Playlist-Auswahl des Hosts
        MenuScreen.tsx      Host-Name, Runden, Audio-Modus, Raum erstellen
        LoadingScreen.tsx   Ladebildschirm mit Spinner
        LobbyScreen.tsx     Spielerliste, Kick, Einstellungen, Start
        GameScreen.tsx      Hauptspiel — orchestriert game/ Sub-Komponenten
        ResultScreen.tsx    Ergebnisanzeige mit Rangliste
      App.tsx               Routing + Handler — State via useSocketEvents/useGameAudio
      main.tsx              Entry Point
    index.html
    vite.config.js
    tsconfig.json
    eslint.config.js
    package.json            @tuneline/client

  server/                   ← Express + Socket.io Server
    src/
      index.ts              Einstieg: Env laden, Server starten (listen), Prozess-Signale
      app.ts                createTunelineServer(): Express-Routen, Socket.io-Handler, Rate-Limiting (ohne listen → testbar)
      rooms.ts              RoomManager: create, join, kick, cleanup (2h TTL)
      game.ts               Spiellogik: startGame, placeSong, skipPlayer, returnToLobby
      types.ts              Interne Server-Typen + Konstanten (Room, InternalPlayer, MAX_*)
      auth.ts               Session-Management (httpOnly Cookies, in-memory Map, 7 Tage TTL)
      spotify.ts            PKCE OAuth server-seitig, Token-Refresh, Playlist/Track-Laden
      preview.ts            iTunes Preview-Suche (Originalaufnahme + Originaljahr) + in-memory Cache (nur serverseitig, kein HTTP-Endpunkt)
      versions.ts           Versionen erkennen (Original / Remaster / Remix, Live …), songKey() für Duplikate
      limits.ts             ConnectionCounter, AttemptLimiter (Socket-Verbindungen und Fehlversuche pro IP), TokenBucket (iTunes-Budget)
      playlistCache.ts      Pro Session: Playlist-Liste (snapshot_id, gefolgt?) + gelesene Playlist-Seiten (6 h)
      logger.ts             pino-Logger
      utils.ts              shuffle<T>(), generateCode()
    tsconfig.json
    package.json            @tuneline/server

  shared/                   ← Gemeinsame TypeScript-Typen
    src/
      index.ts              SpotifyPlaylist, SongMeta, SongFull, RoomPlayer, GameStateForClient,
                            LobbyState, AudioMode, RoomStatus, ClientToServerEvents, ServerToClientEvents
    package.json            @tuneline/shared

  docs/
    architecture.md         Mermaid-Diagramme: Datenfluss, Raum-Zustände, Zug, Sitzplatz, Pause

  .claude/skills/
    tuneline-browser-test/  Projekt-Skill: Ende-zu-Ende-Tests in Chrome (Testsongs, Bots, Handy-Breite)

  .github/
    ISSUE_TEMPLATE/         Issue-Formulare (Bug, Feature, Frage); leere Issues aus, Sicherheit privat melden
    pull_request_template.md  PR-Vorlage (Pflicht, siehe unten)
    scripts/check-pr-description.mjs  prüft die PR-Beschreibung gegen die Vorlage
    workflows/              ci.yml, pr-description.yml, osv-scan*.yml

  Dockerfile                Multi-stage: baut client + server, served von Express
  docker-compose.yml        Lokales Dev mit Docker (optional)
  server/.env.example       Alle Server-Env-Variablen dokumentiert
  client/.env.example       Client Build-Variablen dokumentiert
  package.json              Workspace-Root (npm workspaces + concurrently)
```

## Spotify Setup

- Spotify Developer App benötigt: Client ID in `server/.env.local` als `SPOTIFY_CLIENT_ID`
- Redirect URI: `http://[::1]:5174/api/auth/callback` — muss exakt so in der Developer Console stehen
- Vite läuft auf `host: '::1', port: 5174` — kein `localhost` (Spotify akzeptiert das nicht)
- PKCE-Flow läuft **server-seitig**: Verifier im Server-Memory, Token im Server (nie im Browser)
- Session via httpOnly-Cookie (`tuneline_session`), Token nie an den Client weitergegeben
- **Development Mode (Stand 2026):** App-Besitzer braucht Premium, max. 5 Spotify-Nutzer (Hosts) über die User-Management-Allowlist im Dashboard; Gäste loggen sich nie bei Spotify ein
- Client-IDs ab 11.02.2026 bekommen Songs nur aus eigenen/kollaborativen Playlists; Spotify-eigene Playlists sind für Dev-Mode-Apps gesperrt
- **Gefolgte Playlists** (weder eigene — `owner.id` ≠ `userId` aus `/me` beim Login — noch kollaborativ) werden angeboten, bis Spotify eine davon mit 403 ablehnt; danach blendet `getUserPlaylists` sie aus (`followedPlaylistsRefused`, Log `followed_playlists_refused`, nur im Speicher → nach Neustart erst wieder nach einer Ablehnung)
- **Playlist-Cache** (`server/src/playlistCache.ts`): gelesene Seiten pro Session + Playlist + `snapshot_id`, 6 h, max. 2000 Seiten; geänderte Playlist = neuer Snapshot = neu lesen; Logout/Session-Ende löscht ihn (`deleteSession`). `songs_loaded` loggt `spotifyPagesFetched`/`spotifyPagesCached`
- **Spotify 429**: `Retry-After` ≤ 5 s wird einmal abgewartet und der Request wiederholt; länger → keine Spotify-API-Anfrage mehr bis dahin, für alle Hosts (Log `spotify_rate_limited`); ohne Header scheitert nur dieser Request
- `server/src/spotify.ts` liest Songs über `/playlists/{id}/items` (max. 50 pro Seite, Song unter `item` oder `track`); wird die erste Seite abgelehnt, Rückfall auf das alte `/tracks` (Log: `playlist_items_fallback`)
- Spotify-Fehler gehen mit Grund an den Client: `/api/playlists` → `not_allowlisted` (403) / `quota` (429) / `unavailable` (502); `/api/songs` → `SongsResponse.unavailablePlaylists` mit `not_owned` / `spotify_owned` / `quota` / `unavailable` (Texte in `client/src/utils/spotifyMessages.ts`)
- iTunes Search API: offiziell ca. 20 Anfragen/Minute pro IP (gilt für die Server-IP); `songs_loaded` loggt `itunesLookups`/`itunesFailed` (außerdem `yearsCorrected`, `duplicatesRemoved`) — Tests (Okt. 2026): 40 Suchen in ~5 s ohne Fehler, aber ~70 in ~1 min → 403/429 und Sperre > 30 min (Nachfragen verlängert sie). **Drosselung** in `preview.ts`: ein `TokenBucket` für den ganzen Server, bis 40 Suchen sofort, dann eine alle 3 s (Cache-Treffer frei); nach 403/429 Pause von 2 min, bei erneuter Sperre doppelt bis 30 min, nach einem Erfolg wieder 2 min (Log `itunes_throttled`). `songs_loaded` loggt `itunesWaitedMs`. `loadSongs()` bricht nach 5 gescheiterten Suchen ab (`MAX_ITUNES_FAILURES`) und meldet `SongsResponse.previewsUnavailable`; reichen die Songs dann nicht, sagt der Client „Die Hörproben sind gerade nicht erreichbar …“ statt „andere Playlisten wählen“. Der Client fordert 1,2× die nötigen Songs an; der Ladescreen erklärt nach 8 s, dass iTunes bremst
- Hintergrund mit Quellen (Quota, Playlist-Zugriff, Developer Policy, iTunes-Bedingungen, Spotify-Wiedergabe statt iTunes, Stand Oktober 2026): `docs/research/spotify-itunes-api-regeln.md`, Rohnotizen in `docs/research/notes/`

## Multiplayer-Architektur

- **Diagramme** der Abläufe (Raum-Zustände, Zug, Sitzplatz, Pause-Regel): `docs/architecture.md` — bei Änderungen an dieser Logik mitpflegen
- **Server ist Source of Truth** — alle Spielzustände liegen im Server-Memory (RoomManager)
- **Room-Code**: 6 Zeichen alphanumerisch (z.B. `6ER2T5`), 2h TTL
- **Spieler-Token**: 48-Zeichen-Token für Reconnect-Fähigkeit ohne erneuten Join (`client/src/utils/roomStorage.ts`)
  - `sessionStorage` (pro Tab): `rejoin_room` (nur Token, legt nie Spieler an) läuft automatisch beim Socket-Reconnect und beim Neuladen; schlägt er fehl → `rejoin_failed` → Start-Screen
  - `localStorage` (`lastRoom`, max. 2 h): nach Tab-Schließen bietet `ResumeBanner` „Zurück ins Spiel“ an — nur per Klick, nie automatisch
  - Duplizierter Tab (kopiert sessionStorage): `utils/tabPresence.ts` fragt per `BroadcastChannel`, ob ein anderer Tab den Platz hält → Duplikat startet ohne Spieler. Übernimmt trotzdem ein Socket einen verbundenen Spieler, bekommt der alte `session_replaced` und wird getrennt
  - Bewusstes Verlassen (`leave_room` in Lobby/Ergebnis, Kick, Raum geschlossen) löscht beide Einträge
- **Anti-Cheat / kein Vorsagen**: Während eines Zugs geht nur `SongMeta = { preview }` an alle Clients; Titel, Interpret, Cover und Jahr erst mit `placement_result.song`/`game_over`
- **Audio-Modus**: `'all'` (jeder hört auf eigenem Gerät) oder `'host-only'` (nur Host-Gerät)
- **Spotify-Token bleibt beim Server**: Host ruft `/api/songs` auf → Server fetcht via Spotify+iTunes → Client empfängt `SongFull[]` und übergibt sie via `start_game` an den Server
- Server validiert Song-Daten (Pflichtfelder, Jahr zwischen 1900–2100)
- Socket-Events rate-limitiert (15 Events/Sekunde pro Socket); max. 5 offene Räume pro IP, 1 pro Socket
- Missbrauchs-Limits (`server/src/limits.ts`, Konstanten in `types.ts`): max. 30 gleichzeitige Socket-Verbindungen pro IP (`connect_error` `too_many_connections`); nach 20 Beitritten mit unbekanntem Raum-Code bzw. Rejoins mit unbekanntem Raum/Token pro IP in 10 min ist Beitreten für diese IP gesperrt (gegen Raum-Code-Raten); Socket-Nachrichten max. 640 KB
- **Alles nur im Speicher**: Ein Server-Neustart/Deploy beendet alle Spiele und Spotify-Logins. Bei `SIGTERM` bekommen Clients `server_restarting` → Deploys außerhalb von Spielzeiten

### Socket.io Events (Überblick)

```text
Client → Server: create_room, join_room, rejoin_room, leave_room, start_loading,
                  cancel_loading, start_game, update_settings, place_song,
                  skip_player, kick_player, return_to_lobby, send_reaction
Server → Client: room_created, room_joined, rejoin_failed, session_replaced, room_updated,
                  room_closed, game_loading, game_loading_cancelled, game_started,
                  placement_result, game_over, game_paused, game_resumed,
                  game_state_updated, player_kicked, server_restarting, error,
                  reaction_received
```

## Spiellogik

- **Server** (`game.ts`): `startGame()` verteilt Startsongs, `placeSong()` prüft Platzierung und gibt `correct`/`gameOver` zurück; `rooms.ts` orchestriert via `RoomManager`
- **Client** (`App.tsx`): verwaltet Socket-State, leitet Events an Screens weiter — nicht verändern ohne Rückfrage
- Gameover-Bedingung (`isGameOver` in `game.ts`): nur an Rundengrenzen (`currentPlayerIndex === 0`), wenn `round > rounds` oder der Stapel keine volle Runde mehr hergibt; mitten in der Runde nur, wenn gar kein Song mehr da ist
- `startGame()` startet nur aus der Lobby und setzt `gameRounds` auf das, was der Stapel für alle hergibt; `rounds` bleibt die Einstellung des Hosts (Client zeigt dem Host einen Hinweis)
- Songs vom Host-Client werden geprüft (`isValidSong`): Audio nur von `audio-ssl.itunes.apple.com`, Cover nur von `i.scdn.co` oder `null`
- **Pause** (`pausedPlayerId`): nur wenn der Host oder der Spieler am Zug offline ist. Andere Disconnects → `game_state_updated` (Spieler erscheint „offline“). Kommt der Host nicht binnen 2 Min. zurück → Spielende
- Übersprungene, beim Start offline gewesene und spät beitretende Spieler werden per `seatPlayer()` wieder in die Reihenfolge aufgenommen (ohne Karten: Startkarte vom Stapel, sonst Zuschauer bis zur nächsten Partie)
- **Zeitlimit pro Zug** (`turnLimit`: 0/30/60/90 s): Server-Timer in `RoomManager.syncTurnTimer`, läuft nicht während Pausen; Ablauf zählt als falsch (`placement_result.timedOut`)
- **Nur Originalversionen** (`server/src/versions.ts`): Versionshinweise zählen nur in Klammern bzw. nach „ - “ („Live and Let Die“ bleibt). Spotify-Tracks, die Remix, Live, Acoustic, Instrumental, re-recorded/„Taylor's Version“, Karaoke, Sped up … oder Remaster sind, fliegen in `parseTrack()` raus, ebenso Compilations, Neuauflage-Alben (Deluxe, Greatest Hits …) und Alben wie „Screwed & Chopped“/„MTV Unplugged“. „Radio Edit“, „Single Version“, „feat.“, „7\" Mix“/„Radio Mix“/„Original Mix“ gelten als Original
- **iTunes-Preview** (`findPreview`, 25 Treffer): gleicher Interpret und `baseTitle`, keine Variante, Länge höchstens 40 % neben der Spotify-Länge; Original vor Remaster, dann nächste Länge, dann ältestes Datum. Ohne passende Preview fällt der Song raus
- **Jahr** = früheres von Spotify-Albumjahr und iTunes-Originaljahr. Für das iTunes-Jahr zählen keine Best-ofs/Reissues (`isCompilationAlbum`: Hits, Gold, Anthology, Collection, No. 1's, Jahresspannen …), weil sie fremde Daten tragen („Nightshift“ auf Commodores-Best-ofs: 1977 statt 1985). Daten auf den 1. Januar sind oft Platzhalter und zählen nur, wenn es kein genaues Datum gibt. Kennt iTunes kein Original, bleibt das Spotify-Jahr (lieber zu wenig korrigieren als falsch; z. B. bleibt „Sugar Baby“ auf Spotifys 1989 statt 1958)
- **Duplikate**: ein Song pro Partie über alle Playlists und Versionen — gleiche Spotify-ID, gleiche ISRC, gleicher `songKey` (Interpret + Titel ohne Zusätze) oder gleiche Preview-URL
- „Nochmal spielen“ und neue Räume: Der Host-Client schickt gespielte Song-IDs (`utils/playedSongs.ts`, localStorage, 24 h) als `excludeIds` an `/api/songs`; der Server nutzt sie – samt anderer Versionen desselben Songs – nur als Reserve
- Bei Punktgleichstand am Ende: `ResultScreen` zeigt "Unentschieden!" statt arbiträrem Sieger
- Server trackt `lastCorrectSong` pro Spieler → `winnerLastSong` wird mit `game_over` gesendet und in ResultScreen hervorgehoben
- Lautstärke-Regler im GameScreen (pro Gerät), gespeichert in localStorage

## Deployment (Coolify)

- `Dockerfile` baut Client (Vite) + Server (tsup CJS) in einem Multi-Stage-Build
  - Builder-Stage: `NODE_ENV=development npm ci` (damit devDependencies nicht übersprungen werden)
  - `VITE_SERVER_URL` ist die einzige Build-Zeit-Variable → als `ARG` im Dockerfile, in Coolify als Build-Arg setzen
  - `VITE_SERVER_URL` (Build) und `FRONTEND_ORIGIN` (Laufzeit) müssen dieselbe öffentliche Adresse der App sein — die CSP erlaubt Socket.io nur dorthin, sonst blockiert der Browser die Verbindung
  - `NODE_ENV` in Coolify auf **Runtime only** stellen (nicht Build-time), sonst überschreibt es das `development` im Dockerfile
- Server serviert in Production das Client-Build als statische Dateien
- Runtime-Env-Variablen in Coolify setzen: `PORT`, `FRONTEND_ORIGIN`, `NODE_ENV=production`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_REDIRECT_URI`
- Health-Check: `GET /health` → `{ ok: true }`
- `app.set('trust proxy', 1)` — nötig hinter Coolify-Nginx für Rate-Limiter
- `helmet` mit **Content-Security-Policy** (`cspDirectives()` in `app.ts`): nur eigene Skripte, Emotion-Inline-Styles + Google Fonts, Cover von `*.scdn.co`/`*.spotifycdn.com`, Audio von `audio-ssl.itunes.apple.com`, Socket.io auf `FRONTEND_ORIGIN`. **Neue externe Quellen dort eintragen**, sonst blockiert der Browser sie (nur im Production-Build sichtbar, im Dev liefert Vite die Seite)
- Keine SPA-Fallback-Route: der Client nutzt nur `/` (+ `?room=`), unbekannte Pfade → 404 (Scanner wie `/.env`, `/wp-admin` landen dort; 404 wird als `info` geloggt)
- Kein öffentlicher iTunes-Endpunkt: Previews sucht nur `loadSongs()` serverseitig
- Container läuft als User `node`, spielt beim Build Alpine-Sicherheitsupdates ein und enthält kein npm (`osv-scanner scan image <image>` lokal zum Prüfen)
- `compression()` für Antworten
- Sticky Sessions empfohlen bei mehreren Instanzen (Socket.io)

## Geplante Features (Backlog)

- **Weitere Spielmodi**: Team-Modus
- **Soundeffekte** bei richtigem/falschem Platzieren

## Tests

- **Vitest** in beiden Workspaces, Testdateien liegen als `*.test.ts(x)` neben dem Code
- **Server** (`server/vitest.config.mts`): Unit-Tests für Spiellogik, `RoomManager` (Timer mit `vi.useFakeTimers()`), Preview, Spotify (`fetch` gemockt), Sessions; Integrationstests starten echte Server über `createTunelineServer()` auf Port 0 (`src/test/server.ts`, `socket.io-client`)
- **Client** (`client/vite.config.js`, Block `test`): jsdom + Testing Library; `src/test/setup.ts` mockt `src/socket.ts` global durch `src/test/fakeSocket.ts` (`serverEmit()` simuliert Server-Events, `emittedPayloads()` prüft Emits)
- **Coverage-Schwelle 80 %** (Statements, Branches, Functions, Lines) je Workspace — `npm run coverage` bricht darunter ab
- **Pre-Commit-Hook** führt nach lint-staged `npm test` aus (~13 s); **CI** führt `npm run coverage` aus
- **PR-Beschreibungen** (auch eigene per `gh pr create --body`) folgen `.github/pull_request_template.md`: Abschnitte „What and why“, „Related issue“, „How was this tested“ ausgefüllt, mindestens ein „Type of change“ und alle „Checklist“-Punkte angehakt — sonst schlägt der Check „PR description“ fehl (Bots ausgenommen)
- **Browser-Tests** (Mehrspieler-Szenarien, Reload, Handy-Breite) laufen über den Projekt-Skill `tuneline-browser-test` — ohne Spotify-Login, mit iTunes-Testsongs und Bot-Spielern

## Scripts

```bash
# Lokal (ohne Docker)
npm run dev          # startet client + server parallel (concurrently)
npm run dev:client   # nur Vite Dev-Server → http://[::1]:5174
npm run dev:server   # nur Express/Socket.io → http://[::1]:3001
npm run build        # baut client + server für Production
npm run typecheck    # tsc --noEmit für client + server
npm test             # Vitest für server + client
npm run coverage     # wie test, mit 80-%-Coverage-Schwelle

# Im jeweiligen Unterordner
npm run lint         # ESLint (client)
npm run format       # Prettier (client)
```
