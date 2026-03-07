---
name: tuneline
description: >
  Project context and development guidelines for Tuneline, a digital music timeline party game
  (inspired by Hitster). Use this skill whenever working on any part of the Tuneline codebase —
  React frontend, Express/Socket.io backend, Spotify integration, iTunes audio previews,
  game logic, UI/UX changes, or feature additions. Also trigger when the user mentions "Tuneline",
  "music timeline game", "song sorting game", Spotify playlist integration, iTunes preview, or
  multiplayer game features. Even if the user just says "fix a bug" or "add a feature" while in
  the Tuneline project directory, use this skill.
---

# Tuneline — Project Skill

Tuneline is a digital music timeline party game where players hear a 30s song preview and must
place it chronologically on their growing timeline. The more cards on a timeline, the harder it
gets. 2–10 players, points for correct placements. Online multiplayer via Socket.io.

## Architecture Overview

```
Tuneline/                     ← npm Workspaces Monorepo
  client/                     ← React-Frontend (Vite, @tuneline/client)
    src/
      types.ts                Screen, Feedback, SpotifyPlaylist
      constants.ts            PLAYER_COLORS
      socket.ts               Socket.io singleton
      api/
        spotify.ts            PKCE auth, getUserPlaylists, loadSongsFromPlaylists
        itunes.ts             iTunes Preview-Suche pro Song
      utils/
        shuffle.ts            shuffle<T>()
        audio.ts              playAudio, stopAudio, toggleAudio (HTMLAudioElement)
      components/
        GlobalStyles.tsx      Emotion Global — @keyframes + CSS Reset
        Vinyl.tsx             Drehendes Vinyl mit Cover-Art
        Wave.tsx              Animierte Equalizer-Welle
        DropZone.tsx          Platzierungs-Slot in der Timeline
        Confetti.tsx          Gewinner-Konfetti
        Label.tsx             Beschriftungs-Komponente
      screens/
        LoginScreen.tsx       Spotify-Login + Gast-Join-Button
        JoinScreen.tsx        Raum-Code + Name eingeben
        PlaylistScreen.tsx    Playlist-Auswahl des Hosts
        MenuScreen.tsx        Host-Name, Runden, Audio-Modus, Raum erstellen
        LoadingScreen.tsx     Ladebildschirm mit Spinner
        LobbyScreen.tsx       Spielerliste, Kick, Einstellungen, Start
        GameScreen.tsx        Hauptspiel (Header + SongCard + Timeline + PlaceButton)
        ResultScreen.tsx      Rangliste + Gewinner-Timeline
      App.tsx                 State-Management + Socket-Event-Handler
      main.tsx                Entry Point
    vite.config.js            Host: [::1], Port: 5174

  server/                     ← Express + Socket.io (@tuneline/server)
    src/
      index.ts                HTTP-Server, Socket.io-Setup, CORS, Rate-Limiting, Logging
      rooms.ts                RoomManager: create, join, start, place, kick, returnToLobby
      utils.ts                shuffle<T>(), generateCode()

  shared/                     ← Gemeinsame TypeScript-Typen (@tuneline/shared)
    src/
      index.ts                SongMeta, SongFull, RoomPlayer, GameStateForClient,
                              LobbyState, ClientToServerEvents, ServerToClientEvents

  Dockerfile                  Multi-stage: baut client + server, served von Express
  docker-compose.yml          Lokales Dev mit Docker (optional)
  .env.example                Alle Env-Variablen dokumentiert
  package.json                Workspace-Root (npm workspaces + concurrently)
```

## Tech Stack

- **Frontend**: React 19 + TypeScript 5, Vite, Emotion CSS-in-JS
- **Backend**: Node.js + Express + Socket.io
- **Auth**: Spotify PKCE OAuth — Token in localStorage, kein Backend nötig
- **Metadaten**: Spotify Web API — Playlisten, Track-Titel, Interpret, Erscheinungsjahr, Cover
- **Audio**: iTunes Search API — 30s Previews, kein Auth, CORS nativ, kein Premium nötig
- **Shared Types**: `@tuneline/shared` Paket im Monorepo

## Design System

- **Background**: `#08080d` mit Grid-Overlay und Farbglow-Orbs
- **Surfaces**: `#12121a` (Cards), `#1a1a26` (sekundär)
- **Borders**: `#2a2a3a`
- **Text**: `#e8e8f0` (primär), `#7a7a8e` (gedimmt)
- **Akzentfarben**: `#ff2d78` (Pink), `#06d6a0` (Grün), `#a855f7` (Lila), `#fbbf24` (Gold)
- **Fonts**: `Space Mono` für Labels/Zahlen, `Outfit` für Body/UI
- **Spielerfarben**: `["#ff2d78", "#06d6a0", "#a855f7", "#fbbf24", "#38bdf8", "#f97316"]`
- **Kein CSS** — ausschließlich Emotion styled components

## Spotify Integration

Der Host loggt sich mit seinem Spotify-Account via PKCE OAuth ein. Das Flow:

1. `redirectToSpotify()` generiert Code-Verifier/Challenge, leitet zu Spotify weiter
2. Callback landet auf `http://[::1]:5174/callback` — Vite serviert index.html (SPA)
3. `handleAuthCallback(code)` tauscht Code gegen Token, speichert in localStorage
4. `getUserPlaylists()` lädt die Playlisten des Hosts
5. `loadSongsFromPlaylists(ids, limit)` lädt Track-Metadaten + iTunes Previews
6. Token-Refresh erfolgt automatisch über den gespeicherten `refresh_token`

Wichtige Details:

- Spotify Developer Console erlaubt keinen `localhost`-Eintrag — es muss `[::1]` sein
- Vite ist entsprechend auf `host: '::1', port: 5174` konfiguriert
- Songs ohne gültige Jahreszahl (< 1900 oder > 2030) werden herausgefiltert
- Maximal 300 Songs pro Playlist werden geladen (Pagination)

## iTunes Audio

Für jeden Song wird via iTunes Search API nach einem 30s Preview gesucht:
`https://itunes.apple.com/search?term={artist}+{title}&entity=song&limit=5`

- Kein Auth, kein Premium, CORS nativ erlaubt, direkt via `new Audio(url)` abspielbar
- Preview-URL wird als `preview: string | null` im Song-Objekt gespeichert
- Im Multiplayer sendet der Server die gleiche Preview-URL an alle Clients

## Multiplayer-Architektur

- **Server ist Source of Truth** — Spielzustand liegt im Server-Memory (RoomManager, 2h TTL)
- **Room-Code**: 6 Zeichen alphanumerisch (z.B. `6ER2T5`)
- **Spieler-Token**: 48 Zeichen für Reconnect ohne erneuten Join
- **Anti-Cheat**: `SongMeta` (ohne Jahr) an aktiven Spieler; Jahr erst nach Platzierung via `placement_result`
- **Audio-Modus**: `'all'` (jeder hört auf eigenem Gerät) oder `'host-only'` (nur Host-Gerät)

Socket-Events:
```
Client → Server: create_room, join_room, start_loading, start_game,
                  update_settings, place_song, skip_player, kick_player,
                  return_to_lobby
Server → Client: room_created, room_joined, room_updated, game_loading,
                  game_started, turn_started, placement_result, game_over,
                  game_paused, game_resumed, player_disconnected,
                  player_reconnected, player_kicked, error
```

## Game Logic

1. **Setup**: Jeder Spieler bekommt einen Startsong auf seiner Timeline (server-seitig)
2. **Zug**: Aktueller Spieler hört einen Song — sieht Titel + Interpret, NICHT das Jahr
3. **Platzieren**: Spieler klickt einen Drop-Zone-Slot zwischen bestehenden Timeline-Karten
4. **Prüfung**: Chronologische Reihenfolge korrekt? Ja: +1 Punkt, Karte bleibt. Nein: Karte weg
5. **Weiter**: Nächster Spieler. Nach einer Runde aller Spieler: Rundenzähler +1
6. **Ende**: Nach konfigurierten Runden oder wenn das Deck leer ist
7. **Ergebnis**: Rangliste + Gewinner-Timeline mit gehighlighteter letzter Karte + Konfetti

Edge Cases:

- Songs mit gleichem Jahr sind in beliebiger Reihenfolge zueinander gültig
- Timeline wird immer nach Jahr sortiert angezeigt (links = ältester Song)
- Drop-Zones erscheinen zwischen jeder Karte und an beiden Enden

## Code Conventions

- Emotion styled components — keine `.css`-Dateien
- `data-*`-Attribute für konditionelles Styling (kein prop-forwarding)
- TypeScript strict — Client-Typen in `client/src/types.ts`, gemeinsame Typen in `shared/src/index.ts`
- Deutsche UI-Texte (Zielgruppe deutschsprachig)
- Minimale Dependencies — kein Redux, kein Router (SPA mit Screen-State in `App.tsx`)
