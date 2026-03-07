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
      types.ts              Song, SpotifyPlaylist, Screen, Feedback, GameResult
      constants.ts          PLAYER_COLORS
      socket.ts             Socket.io-Singleton (typed mit Shared-Events)
      api/
        spotify.ts          PKCE auth + Token-Management + Playlist/Track-Laden
        itunes.ts           iTunes Preview-Suche pro Song
      utils/
        shuffle.ts          shuffle<T>()
        audio.ts            playAudio, stopAudio, toggleAudio, getVolume, setVolume
                            (iTunes Preview via HTMLAudioElement; Lautstärke in localStorage)
      hooks/
        useGameAudio.ts     playing, volume, startSong, stopSong, toggle, changeVolume
        useSocketEvents.ts  alle Socket-Events + abgeleiteter State (screen, gameState …)
      components/
        GlobalStyles.tsx    Emotion Global — @keyframes + CSS Reset
        Vinyl.tsx           Drehendes Vinyl mit Cover-Art
        Wave.tsx            Animierte Equalizer-Welle
        DropZone.tsx        Platzierungs-Slot in der Timeline
        Confetti.tsx        Gewinner-Konfetti
        Label.tsx           Beschriftungs-Komponente
        game/
          GameHeader.tsx    Header-Leiste (Runde, Spieler-Chips, Raum-Code)
          SongCard.tsx      Vinyl + Song-Info + Audio-Controls + Wave
          MyTimeline.tsx    Eigene Timeline mit DropZones
          OtherPlayers.tsx  Mini-Panels der anderen Spieler
          DisconnectOverlay.tsx  Overlay bei Verbindungsverlust
      screens/
        LoginScreen.tsx     Spotify-Login + Gast-Join-Button
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
      index.ts              HTTP-Server, Socket.io-Setup, CORS, Rate-Limiting
      rooms.ts              RoomManager: create, join, kick, cleanup (2h TTL)
      utils.ts              shuffle<T>(), generateCode()
    tsconfig.json
    package.json            @tuneline/server

  shared/                   ← Gemeinsame TypeScript-Typen
    src/
      index.ts              SongMeta, SongFull, RoomPlayer, GameStateForClient,
                            LobbyState, ClientToServerEvents, ServerToClientEvents
    package.json            @tuneline/shared

  Dockerfile                Multi-stage: baut client + server, served von Express
  docker-compose.yml        Lokales Dev mit Docker (optional)
  .env.example              Alle Env-Variablen dokumentiert
  package.json              Workspace-Root (npm workspaces + concurrently)
```

## Spotify Setup

- Spotify Developer App benötigt: Client ID in `client/.env.local` als `VITE_SPOTIFY_CLIENT_ID`
- Redirect URI: `http://[::1]:5174/callback` — muss exakt so in der Developer Console stehen
- Vite läuft auf `host: '::1', port: 5174` — kein `localhost` (Spotify akzeptiert das nicht)
- PKCE-Flow: Verifier in sessionStorage, Token in localStorage als `{ accessToken, refreshToken, expiresAt }`

## Multiplayer-Architektur

- **Server ist Source of Truth** — alle Spielzustände liegen im Server-Memory (RoomManager)
- **Room-Code**: 6 Zeichen alphanumerisch (z.B. `6ER2T5`), 2h TTL
- **Spieler-Token**: 48-Zeichen-Token für Reconnect-Fähigkeit ohne erneuten Join
- **Anti-Cheat**: `SongMeta` (ohne Jahr) wird an aktiven Spieler gesendet; Jahr erst nach Platzierung via `placement_result`
- **Audio-Modus**: `'all'` (jeder hört auf eigenem Gerät) oder `'host-only'` (nur Host-Gerät)
- **Spotify-Token bleibt beim Client**: Host fetcht Songs und übergibt `SongFull[]` an Server via `start_game`
- Server validiert Song-Daten (Pflichtfelder, Jahr zwischen 1900–2100)
- Socket-Events rate-limitiert (15 Events/Sekunde pro Socket)

### Socket.io Events (Überblick)

```text
Client → Server: create_room, join_room, start_loading, start_game,
                  update_settings, place_song, skip_player, kick_player,
                  return_to_lobby
Server → Client: room_created, room_joined, room_updated, game_loading,
                  game_started, turn_started, placement_result, game_over,
                  game_paused, game_resumed, player_disconnected,
                  player_reconnected, player_kicked, error
```

## Spiellogik

- **Server** (`rooms.ts`): `startGame()` verteilt Startsongs, `placeSong()` prüft Platzierung und gibt `correct`/`gameOver` zurück
- **Client** (`App.tsx`): verwaltet Socket-State, leitet Events an Screens weiter — nicht verändern ohne Rückfrage
- Gameover-Bedingung: `currentSongIndex >= deck.length || (currentPlayerIndex === 0 && round > rounds)`
- Songs ohne iTunes-Preview werden vor `start_game` herausgefiltert (garantiert Ton für jeden Song)
- Bei Punktgleichstand am Ende: `ResultScreen` zeigt "Unentschieden!" statt arbiträrem Sieger
- Server trackt `lastCorrectSong` pro Spieler → `winnerLastSong` wird mit `game_over` gesendet und in ResultScreen hervorgehoben
- Lautstärke-Regler im GameScreen (pro Gerät), gespeichert in localStorage

## Deployment (Coolify)

- `Dockerfile` baut Client (Vite) + Server (tsup CJS) in einem Multi-Stage-Build
  - Builder-Stage: `NODE_ENV=development npm ci` (damit devDependencies nicht übersprungen werden)
  - `VITE_*`-Variablen sind Build-Zeit-Variablen → als `ARG` im Dockerfile deklariert, in Coolify als Build-Args setzen
- Server serviert in Production das Client-Build als statische Dateien
- Env-Variablen in Coolify setzen: `PORT`, `FRONTEND_ORIGIN`, `NODE_ENV=production`
- Health-Check: `GET /health` → `{ ok: true }`
- `app.set('trust proxy', 1)` — nötig hinter Coolify-Nginx für Rate-Limiter
- `helmet({ contentSecurityPolicy: false })` + `compression()` — CSP deaktiviert wegen Spotify/iTunes/Google Fonts
- Sticky Sessions empfohlen bei mehreren Instanzen (Socket.io)

## Geplante Features (Backlog)

- **Weitere Spielmodi**: Team-Modus, Zeitlimit pro Zug
- **Soundeffekte** bei richtigem/falschem Platzieren

## Scripts

```bash
# Lokal (ohne Docker)
npm run dev          # startet client + server parallel (concurrently)
npm run dev:client   # nur Vite Dev-Server → http://[::1]:5174
npm run dev:server   # nur Express/Socket.io → http://[::1]:3001
npm run build        # baut client + server für Production
npm run typecheck    # tsc --noEmit für client + server

# Im jeweiligen Unterordner
npm run lint         # ESLint (client)
npm run format       # Prettier (client)
```
