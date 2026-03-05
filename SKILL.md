---
name: tuneline
description: >
  Project context and development guidelines for Tuneline, a digital music timeline party game
  (inspired by Hitster). Use this skill whenever working on any part of the Tuneline codebase —
  React frontend, Spotify integration, iTunes audio previews, game logic, UI/UX changes,
  or feature additions. Also trigger when the user mentions "Tuneline", "music timeline game",
  "song sorting game", Spotify playlist integration, iTunes preview, or multiplayer game features
  with invite links. Even if the user just says "fix a bug" or "add a feature" while in the
  Tuneline project directory, use this skill.
---

# Tuneline — Project Skill

Tuneline is a digital music timeline party game where players hear a 30s song preview and must
place it chronologically on their growing timeline. The more cards on a timeline, the harder it
gets. 2-6 players, points for correct placements.

## Architecture Overview

```
tuneline/
  src/
    types.ts              Song, Player, Screen, Feedback, SpotifyPlaylist
    constants.ts          PLAYER_COLORS
    api/
      spotify.ts          PKCE auth, getUserPlaylists, loadSongsFromPlaylists
    utils/
      shuffle.ts          shuffle<T>()
      audio.ts            initSpotifyPlayer, playTrack, stopTrack, toggleTrack
    components/
      GlobalStyles.tsx    Emotion Global — @keyframes + CSS Reset
      Vinyl.tsx           Drehendes Vinyl mit Cover-Art
      Wave.tsx            Animierte Equalizer-Welle
      DropZone.tsx        Platzierungs-Slot in der Timeline
      Confetti.tsx        Gewinner-Konfetti
      Label.tsx           Beschriftungs-Komponente
    screens/
      LoginScreen.tsx     Spotify-Login-Button
      PlaylistScreen.tsx  Playlist-Auswahl des Hosts
      MenuScreen.tsx      Spieler/Runden-Konfiguration
      LoadingScreen.tsx   Ladebildschirm mit Spinner
      GameScreen.tsx      Hauptspiel (Header + SongCard + Timeline + PlaceButton)
      ResultScreen.tsx    Ergebnisanzeige mit Rangliste
    App.tsx               Spiellogik + State-Management
    main.tsx              Entry Point
  vite.config.js          Host: [::1], Port: 5174
  .env.example            VITE_SPOTIFY_CLIENT_ID, VITE_REDIRECT_URI
```

## Tech Stack

- **Frontend**: React 19 + TypeScript 5, Vite, Emotion CSS-in-JS
- **Auth**: Spotify PKCE OAuth (kein Backend benotigt) — Token in localStorage
- **Metadaten**: Spotify Web API — Playlisten, Track-Titel, Interpret, Erscheinungsjahr, Cover
- **Audio (aktuell)**: Spotify Web Playback SDK — In-Browser-Playback ab 60s (erfordert Premium)
- **Audio (geplant)**: iTunes Search API — kostenlos, kein Auth, CORS-freundlich, 30s Previews
- **Geplantes Backend**: Node.js + Express + Socket.io fur Echtzeit-Multiplayer

## Design System

- **Background**: `#08080d` mit Grid-Overlay und Farbglow-Orbs
- **Surfaces**: `#12121a` (Cards), `#1a1a26` (sekundar)
- **Borders**: `#2a2a3a`
- **Text**: `#e8e8f0` (prim), `#7a7a8e` (gedimmt)
- **Akzentfarben**: `#ff2d78` (Pink), `#06d6a0` (Grun), `#a855f7` (Lila), `#fbbf24` (Gold)
- **Fonts**: `Space Mono` fur Labels/Zahlen, `Outfit` fur Body/UI
- **Spielerfarben**: `["#ff2d78", "#06d6a0", "#a855f7", "#fbbf24", "#38bdf8", "#f97316"]`
- **Kein CSS** — ausschliesslich Emotion styled components

## Spotify Integration

Der Host loggt sich mit seinem Spotify-Account via PKCE OAuth ein. Das Flow:

1. `redirectToSpotify()` generiert Code-Verifier/Challenge, leitet zu Spotify weiter
2. Callback landet auf `http://[::1]:5174/callback` — Vite serviert index.html (SPA)
3. `handleAuthCallback(code)` tauscht Code gegen Token, speichert in localStorage
4. `getUserPlaylists()` ladt die Playlisten des Hosts
5. `loadSongsFromPlaylists(ids, limit)` ladt Track-Metadaten (Titel, Interpret, Jahr, URI, Cover)
6. Token-Refresh erfolgt automatisch uber den gespeicherten `refresh_token`

Wichtige Details:
- Spotify Developer Console erlaubt keinen `localhost`-Eintrag — es muss `[::1]` sein
- Vite ist entsprechend auf `host: '::1', port: 5174` konfiguriert
- Songs ohne gultige Jahreszahl (< 1900 oder > 2030) werden herausgefiltert
- Maximal 300 Songs pro Playlist werden geladen (Pagination)

## iTunes Audio (geplant)

Die aktuell genutzte Spotify Web Playback SDK-Losung erfordert Spotify Premium und ist nicht
multiplayer-fahig (jeder Spieler musste sein eigenes Gerat haben). Die geplante Losung:

1. Song-Metadaten weiterhin von Spotify (Titel, Interpret, Jahr)
2. Fur jeden Song wird parallel via iTunes Search API nach einem Preview gesucht:
   `https://itunes.apple.com/search?term={artist}+{title}&entity=song&limit=5`
3. Das beste Ergebnis (Titel/Interpret-Match) liefert eine 30s Preview-URL
4. Diese URL wird im `Song`-Objekt als `preview: string | null` gespeichert
5. Vorteil: Kein Auth, kein Premium, CORS nativ erlaubt, URL direkt via `new Audio()` abspielbar
6. Im Multiplayer kann der Server die gleiche Preview-URL an alle Clients senden

## Geplante Architektur: Online-Multiplayer

```
Host-Browser                 Server (Node.js + Socket.io)      Spieler-Browser
     |                               |                               |
     |-- create room ---------------->|                               |
     |<-- roomCode -------------------                               |
     |                               |<-- join(roomCode) ------------|
     |                               |-- playerJoined() ------------>|
     |-- startGame() --------------->|                               |
     |                               |-- gameState() --------------->|
     |                               |  (song, timeline, scores)     |
     |                               |<-- placeSong(slot) ------------|
     |                               |-- feedback() ---------------->|
```

- Der Host kontrolliert den Spielfluss (Playlist-Auswahl, Spielstart)
- Spieler verbinden sich uber einen Einladungslink mit Room-Code
- Der Server synchronisiert Spielzustand (aktueller Song, Timelines, Scores)
- Audio wird clientseitig uber die iTunes-Preview-URL abgespielt (gleiche URL fur alle)

## Game Logic

1. **Setup**: Jeder Spieler bekommt einen Startsong auf seiner Timeline
2. **Zug**: Aktueller Spieler hort einen Song — sieht Titel + Interpret, NICHT das Jahr
3. **Platzieren**: Spieler klickt einen Drop-Zone-Slot zwischen bestehenden Timeline-Karten
4. **Prufung**: Chronologische Reihenfolge korrekt? Ja: +1 Punkt, Karte bleibt. Nein: Karte weg
5. **Weiter**: Nachster Spieler. Nach einer Runde aller Spieler: Rundenzahler +1
6. **Ende**: Nach konfigurierten Runden oder wenn der Deck leer ist
7. **Ergebnis**: Rangliste mit Scores und Konfetti-Animation

Edge Cases:
- Songs mit gleichem Jahr sind in beliebiger Reihenfolge zueinander gultig
- Timeline wird immer nach Jahr sortiert angezeigt (links = altester Song)
- Drop-Zones erscheinen zwischen jeder Karte und an beiden Enden

## Code Conventions

- Emotion styled components — keine `.css`-Dateien
- `data-*`-Attribute fur konditionelles Styling (kein prop-forwarding)
- TypeScript strict — alle Typen in `src/types.ts`
- Spiellogik bleibt in `App.tsx` — nicht auslagern ohne Rucksprache
- Deutsche UI-Texte (Zielgruppe deutschsprachig)
- Minimale Dependencies — kein Redux, kein Router (SPA mit Screen-State)
