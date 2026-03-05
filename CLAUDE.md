# Tuneline — Claude Code Instructions

## Projekt
Digitales Musik-Timeline-Partyspiel (ähnlich Hitster). Der Host wählt Spotify-Playlisten aus.
Song-Metadaten (Titel, Interpret, Jahr, Cover) kommen von der Spotify Web API. Audio-Previews
kommen künftig über die iTunes Search API — aktuell noch über den Spotify Web Playback SDK.
Spieler ordnen Songs chronologisch in ihre persönliche Timeline ein. Wer richtig platziert, bekommt einen Punkt.

## Tech Stack
- **React 19 + TypeScript 5** — Vite als Build-Tool
- **Emotion** (`@emotion/styled`, `@emotion/react`) — CSS-in-JS, **keine `.css`-Dateien**
- **Spotify Web API** — PKCE OAuth, Playlisten-Auswahl, Track-Metadaten
- **Spotify Web Playback SDK** — aktuell für Audio (erfordert Premium, startet ab 60s)
- **iTunes Search API** — geplant als Audio-Quelle (30s Previews, kein Auth, multiplayer-fähig)
- **ESLint v9** (flat config) + `typescript-eslint` + `eslint-config-prettier`
- **Prettier** für Formatierung
- Google Fonts (Space Mono + Outfit) direkt in `index.html` via `<link>`

## Wichtige Konventionen
- **Kein CSS** — ausschließlich Emotion (`styled`, `Global`, inline `style` für dynamische Werte)
- **data-Attribute** für conditional CSS in styled components (z.B. `data-active`, `data-disabled`)
  statt prop-forwarding, um React DOM-Warnings zu vermeiden
- **TypeScript strict** — alle Typen in `src/types.ts`
- Entry point: `src/main.tsx`

## Dateistruktur
```
src/
  types.ts              Song, Player, Screen, Feedback, SpotifyPlaylist
  constants.ts          PLAYER_COLORS
  api/
    spotify.ts          PKCE auth + Token-Management + Playlist/Track-Laden
  utils/
    shuffle.ts          shuffle<T>()
    audio.ts            initSpotifyPlayer, playTrack, stopTrack, toggleTrack (Spotify SDK)
  components/
    GlobalStyles.tsx    Emotion Global — @keyframes + CSS Reset
    Vinyl.tsx           Drehendes Vinyl mit Cover-Art
    Wave.tsx            Animierte Equalizer-Welle
    DropZone.tsx        Platzierungs-Slot in der Timeline
    Confetti.tsx        Gewinner-Konfetti
    Label.tsx           Beschriftungs-Komponente
  screens/
    LoginScreen.tsx     Spotify-Login
    PlaylistScreen.tsx  Playlist-Auswahl des Hosts
    MenuScreen.tsx      Spieler/Runden-Konfiguration
    LoadingScreen.tsx   Ladebildschirm mit Spinner
    GameScreen.tsx      Hauptspiel (Header + SongCard + Timeline + PlaceButton)
    ResultScreen.tsx    Ergebnisanzeige mit Rangliste
  App.tsx               Spiellogik + State-Management
  main.tsx              Entry Point
  vite-env.d.ts         Vite-Umgebungsvariablen-Typen
```

## Spotify Setup

- Spotify Developer App benötigt: Client ID in `.env.local` als `VITE_SPOTIFY_CLIENT_ID`
- Redirect URI: `http://[::1]:5174/callback` — muss exakt so in der Developer Console stehen
- Vite läuft auf `host: '::1', port: 5174` — kein `localhost` (Spotify akzeptiert das nicht)
- PKCE-Flow: Verifier in sessionStorage, Token in localStorage als `{ accessToken, refreshToken, expiresAt }`

## Spiellogik (App.tsx — nicht verändern ohne Rückfrage)

- `start()`: Lädt Songs via Spotify API, verteilt Startsongs an Spieler, initialisiert State
- `place()`: Prüft ob Song korrekt in Timeline eingeordnet, zeigt 2.2s Feedback, wechselt Spieler
- Gameover-Bedingung: `nextSongIndex >= deck.length || (nextPlayerIndex === 0 && round >= rounds)`

## Geplante Features (Backlog)

- **iTunes Audio-Previews**: Spotify Web Playback SDK durch iTunes Search API ersetzen.
  Metadaten bleiben von Spotify — für jeden Song wird zusätzlich via iTunes nach einem 30s Preview
  gesucht (`https://itunes.apple.com/search?term={artist}+{title}&entity=song&limit=5`).
  Kein Premium nötig, CORS nativ erlaubt, direkt via `new Audio(url)` abspielbar.
  Wichtig für Multiplayer: gleiche Preview-URL kann an alle Clients gesendet werden.
- **Online-Multiplayer** via WebSockets / Socket.io: Host erstellt Raum, andere Spieler joinen
  per Einladungslink. Server synchronisiert Spielzustand in Echtzeit.
- **Weitere Spielmodi**: Jahrzehnt-Filter, Team-Modus, Zeitlimit pro Zug

## Scripts

```bash
npm run dev        # Vite Dev-Server → http://[::1]:5174
npm run build      # Production Build
npm run preview    # Preview → http://[::1]:5174
npm run typecheck  # tsc --noEmit
npm run format     # Prettier
npm run lint       # ESLint
```
