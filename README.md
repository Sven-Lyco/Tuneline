# Tuneline

Digitales Musik-Timeline-Partyspiel, inspiriert von Hitster.

Spieler hören einen Song-Ausschnitt und müssen ihn chronologisch in ihre wachsende Timeline einordnen. Wer richtig platziert, behält die Karte und bekommt einen Punkt. Je mehr Karten auf der Timeline, desto schwieriger wird es.

## Spielprinzip

1. Der Host wählt Playlisten aus seinem Spotify-Account aus
2. Songs werden mit Metadaten (Titel, Interpret, Jahr) von Spotify geladen
3. Audio-Vorschau (30s) kommt von der iTunes Search API
4. 2–10 Spieler, konfigurierbare Rundenzahl
5. Spieler verbinden sich per Einladungslink oder Raum-Code
6. Wer den Song chronologisch korrekt platziert, bekommt einen Punkt

## Tech Stack

- **React 19 + TypeScript 5** mit Vite
- **Emotion** (`@emotion/styled`) für CSS-in-JS
- **Spotify Web API** (PKCE OAuth) für Playlist-Metadaten
- **iTunes Search API** für 30s Audio-Previews (kein Auth, kein Premium nötig)
- **Socket.io** für Echtzeit-Multiplayer
- **Express** als Backend-Server
- **Design**: Dunkles Neon-Theme, Space Mono + Outfit Fonts

## Setup

1. Spotify Developer App erstellen unter [developer.spotify.com](https://developer.spotify.com)
2. Redirect URI eintragen: `http://[::1]:5174/callback`
3. `client/.env.local` anlegen:

```env
VITE_SPOTIFY_CLIENT_ID=deine_client_id_hier
VITE_REDIRECT_URI=http://[::1]:5174/callback
VITE_SERVER_URL=http://[::1]:3001
```

4. Dependencies installieren und starten:

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev          # startet client + server parallel → http://[::1]:5174
npm run dev:client   # nur Vite Dev-Server → http://[::1]:5174
npm run dev:server   # nur Express/Socket.io → http://[::1]:3001
npm run build        # Production Build (client + server)
npm run typecheck    # TypeScript-Prüfung (client + server)
npm run lint         # ESLint (client)
npm run format       # Prettier (client)
```

## Deployment

Multi-stage `Dockerfile` verfügbar für Coolify oder andere Container-Plattformen.
Der Server serviert das Client-Build als statische Dateien.
Benötigte Env-Variablen: `PORT`, `FRONTEND_ORIGIN`, `NODE_ENV=production`.
