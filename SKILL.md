---
name: tuneline
description: >
  Project context and development guidelines for Tuneline, a digital music timeline party game 
  (inspired by Hitster). Use this skill whenever working on any part of the Tuneline codebase — 
  React frontend, Node.js/Socket.io backend, Deezer API integration, game logic, UI/UX changes, 
  or feature additions. Also trigger when the user mentions "Tuneline", "music timeline game", 
  "song sorting game", Deezer preview integration, or multiplayer game features with invite links. 
  Even if the user just says "fix a bug" or "add a feature" while in the Tuneline project directory, 
  use this skill.
---

# Tuneline — Project Skill

Tuneline is a digital music timeline party game where players hear a song snippet (30s preview via
Deezer API) and must place it chronologically on their growing timeline. The more cards on your
timeline, the harder it gets. 2–6 players, 5 genres, points for correct placements.

## Architecture Overview

```
tuneline/
├── frontend/          # React SPA (Vite + React)
│   ├── src/
│   │   ├── Tuneline.jsx      # Main game component (single-file)
│   │   └── ...
│   └── package.json
├── backend/           # Planned: Node.js + Socket.io server
│   ├── server.js
│   └── package.json
├── SKILL.md
└── README.md
```

## Tech Stack

- **Frontend**: React 18+ with Vite, inline styles (no CSS framework), Google Fonts (Outfit + Space Mono)
- **Audio**: Deezer API for 30s preview URLs and album metadata — no API key needed for search/previews
- **CORS Proxy**: `corsproxy.io` for browser-side Deezer requests (replace with own backend proxy in production)
- **Planned Backend**: Node.js + Express + Socket.io for real-time online multiplayer
- **Planned State Sync**: WebSocket rooms with invite links for remote play

## Design System

The UI follows a dark neon aesthetic. Stick to these principles:

- **Background**: `#08080d` with subtle grid overlay and blurred color orbs
- **Surfaces**: `#12121a` (cards), `#1a1a26` (secondary)
- **Borders**: `#2a2a3a`
- **Text**: `#e8e8f0` (primary), `#7a7a8e` (dimmed)
- **Accent colors**: `#ff2d78` (pink/primary), `#06d6a0` (green/success), `#a855f7` (purple), `#fbbf24` (gold)
- **Fonts**: `Space Mono` for mono/labels/numbers, `Outfit` for body/UI
- **Player colors**: `["#ff2d78", "#06d6a0", "#a855f7", "#fbbf24", "#38bdf8", "#f97316"]`
- **Animations**: CSS keyframes only — spin, wave, float, bob, pop, slideIn, glow, confetti fall
- **Components**: Vinyl spinner (rotating disc with album art), waveform visualizer, drop zones with hover glow

Never use generic AI aesthetics (Inter font, purple-on-white gradients, cookie-cutter cards). Every element should feel like a music app, not a dashboard.

## Deezer API Integration

Songs are loaded dynamically at game start via the Deezer Search API. The flow:

1. Per selected genre, there are ~25 curated search queries (artist names, decade hits, etc.)
2. Queries are shuffled and fetched via `/search?q=...&limit=25`
3. Each track result provides: `title`, `artist.name`, `album.cover_medium`, `preview` (30s mp3 URL)
4. The release year is extracted from `album.release_date` (format `"YYYY-MM-DD"`)
5. Songs without a valid preview URL or year are filtered out
6. If the API is unreachable, a hardcoded fallback list (20 songs, no audio) is used

Important API details:

- Base URL: `https://api.deezer.com`
- No authentication needed for search and track endpoints
- CORS proxy needed for browser requests: `https://corsproxy.io/?{encoded_url}`
- Rate limits exist — don't hammer the API. Load songs in batches, stop when enough are collected
- The `preview` field is a direct MP3 URL, playable via `new Audio(url)`

When adding new genres or expanding the song pool, add search queries to `GENRE_QUERIES` in the format of well-known artist names or decade-based hit descriptions.

## Game Logic

The core game loop works as follows:

1. **Setup**: Each player gets one random song placed on their timeline as a starting card
2. **Turn**: The current player hears a song. They see title + artist but NOT the year
3. **Place**: Player clicks a drop zone between existing timeline cards to place the song
4. **Check**: If the placement maintains chronological order → correct (+1 point, card stays). Otherwise → wrong (no point, card discarded)
5. **Next**: Turn passes to the next player. After all players had a turn, the round counter increments
6. **End**: Game ends after the configured number of rounds or when the deck runs out
7. **Result**: Ranking screen with scores, crown for winner, confetti animation

Edge cases to be aware of:

- Songs with the same year are valid in any relative order to each other
- The timeline is always displayed sorted by year, left (oldest) to right (newest)
- Drop zones appear between every card and at both ends of the timeline

## Planned Features (Not Yet Implemented)

Read `references/roadmap.md` for full details on planned features. Key items:

1. **Online Multiplayer** — Node.js + Socket.io backend with room codes / invite links. Each player connects from their own device. Real-time scoreboard sync via WebSocket events. The host creates a room, others join via link.

2. **Spotify Web Playback SDK** — Alternative to Deezer for users with Spotify Premium. Requires OAuth login. Would replace the 30s preview with full track playback controlled via SDK.

3. **Highscore Persistence** — Store scores in localStorage or backend database. Show all-time leaderboard.

4. **More Genres & Localization** — Expandable genre system. Add French, Spanish, Korean pop, etc. Also decade-specific modes (only 80s, only 2010s).

5. **Sound Effects** — Correct/wrong placement SFX, countdown timer sounds, game start jingle.

## Code Conventions

- Single-file components preferred for game screens (keep it contained)
- Inline styles with style objects (no CSS-in-JS library, no Tailwind)
- State management via React hooks (useState, useCallback, useRef) — no Redux
- Audio playback via native `Audio` API, managed through module-level functions (not in React state)
- German language for all UI text (the primary audience is German-speaking)
- Component naming: PascalCase. Helper functions: camelCase
- Keep the dependency footprint minimal — avoid adding packages unless truly necessary
