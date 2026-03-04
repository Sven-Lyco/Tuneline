# Tuneline — Claude Code Instructions

## Projekt
Digitales Musik-Timeline-Partyspiel (ähnlich Hitster). Spieler ordnen Songs chronologisch in ihre
persönliche Timeline ein. Wer es richtig platziert, bekommt einen Punkt.

## Tech Stack
- **React 19 + TypeScript 5** — Vite als Build-Tool
- **Emotion** (`@emotion/styled`, `@emotion/react`) — CSS-in-JS, **keine `.css`-Dateien**
- **ESLint v9** (flat config) + `typescript-eslint` + `eslint-config-prettier`
- **Prettier** für Formatierung
- Deezer API (über `corsproxy.io`) für 30s Song-Previews
- Google Fonts (Space Mono + Outfit) direkt in `index.html` via `<link>`

## Wichtige Konventionen
- **Kein CSS** — ausschließlich Emotion (`styled`, `Global`, inline `style` für dynamische Werte)
- **data-Attribute** für conditional CSS in styled components (z.B. `data-active`, `data-disabled`)
  statt prop-forwarding, um React DOM-Warnings zu vermeiden
- **TypeScript strict** — alle Typen in `src/types.ts`
- Entry point: `src/main.tsx` (nicht `main.jsx`)

## Dateistruktur
```
src/
  types.ts              Song, Player, Screen, Feedback, Genre, GenreMeta
  constants.ts          PLAYER_COLORS, GENRE_META, GENRE_QUERIES, FALLBACK_SONGS
  api/deezer.ts         loadSongsForGenres() — Deezer API Layer
  utils/shuffle.ts      shuffle<T>()
  utils/audio.ts        playAudio / stopAudio / toggleAudio (globaler Singleton)
  components/
    GlobalStyles.tsx    Emotion Global — @keyframes + CSS Reset
    Vinyl.tsx           Drehendes Vinyl mit Cover-Art
    Wave.tsx            Animierte Equalizer-Welle
    DropZone.tsx        Platzierungs-Slot in der Timeline
    Confetti.tsx        Gewinner-Konfetti
    Label.tsx           Beschriftungs-Komponente
  screens/
    MenuScreen.tsx      Genre/Spieler/Runden-Auswahl
    LoadingScreen.tsx   Ladebildschirm mit Spinner
    GameScreen.tsx      Hauptspiel (Header + SongCard + Timeline + PlaceButton)
    ResultScreen.tsx    Ergebnisanzeige mit Rangliste
  App.tsx               Spiellogik + State-Management
  main.tsx              Entry Point
```

## Spiellogik (App.tsx — nicht verändern ohne Rückfrage)
- `start()`: Lädt Songs via Deezer API, verteilt Startsongs an Spieler, initialisiert State
- `place()`: Prüft ob Song korrekt in Timeline eingeordnet, zeigt 2.2s Feedback, wechselt Spieler
- Gameover-Bedingung: `nextSongIndex >= deck.length || (nextPlayerIndex === 0 && round >= rounds)`
- Fallback-Songs wenn Deezer nicht erreichbar

## Scripts
```bash
npm run dev        # Vite Dev-Server → http://localhost:5173
npm run build      # Production Build
npm run typecheck  # tsc --noEmit
npm run format     # Prettier
npm run lint       # ESLint
```

## Geplante Features (Backlog)
- Online-Multiplayer via WebSockets / Socket.io mit Einladungslinks
- Weitere Genres
