# Tuneline

Digitales Musik-Timeline-Partyspiel, inspiriert von Hitster.

Spieler horen einen Song-Ausschnitt und mussen ihn chronologisch in ihre wachsende Timeline einordnen. Wer richtig platziert, behalt die Karte und bekommt einen Punkt. Je mehr Karten auf der Timeline, desto schwieriger wird es.

## Spielprinzip

1. Der Host wahlt Playlisten aus seinem Spotify-Account aus
2. Songs werden mit Metadaten (Titel, Interpret, Jahr) von Spotify geladen
3. Audio-Vorschau (30s) kommt von der iTunes Search API
4. 2-6 Spieler, konfigurierbare Rundenzahl
5. Wer den Song chronologisch korrekt platziert, bekommt einen Punkt

## Tech Stack

- **React 19 + TypeScript 5** mit Vite
- **Emotion** (`@emotion/styled`) fur CSS-in-JS
- **Spotify Web API** (PKCE OAuth) fur Playlist-Metadaten
- **iTunes Search API** fur 30s Audio-Previews (geplant, ersetzt aktuell Spotify SDK)
- **Design**: Dunkles Neon-Theme, Space Mono + Outfit Fonts

## Setup

1. Spotify Developer App erstellen unter [developer.spotify.com](https://developer.spotify.com)
2. Redirect URI eintragen: `http://[::1]:5174/callback`
3. `.env.local` anlegen:

```env
VITE_SPOTIFY_CLIENT_ID=deine_client_id_hier
VITE_REDIRECT_URI=http://[::1]:5174/callback
```

4. Dependencies installieren und starten:

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev        # Vite Dev-Server -> http://[::1]:5174
npm run build      # Production Build
npm run preview    # Preview Build -> http://[::1]:5174
npm run typecheck  # TypeScript-Prufung
npm run lint       # ESLint
npm run format     # Prettier
```

## Geplante Features

- **Online-Multiplayer** via WebSockets / Socket.io mit Einladungslinks
- **iTunes Audio-Previews** als Ersatz fur Spotify Web Playback SDK (kein Premium benotigt, multiplayer-fahig)
- **Weitere Spielmodi** (Jahrzehnt-Modus, nur ein Genre, etc.)
- **Soundeffekte** bei richtigem/falschem Platzieren
