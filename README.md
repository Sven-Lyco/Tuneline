# Tuneline

> This project was fully written by [Claude](https://claude.ai) (Anthropic) in collaboration with the repository owner.
> Use at your own risk.

A digital music timeline party game inspired by Hitster.

Players listen to a 30-second song preview and place it chronologically on their growing timeline. Correct placement earns a point and keeps the card — the longer the timeline, the harder it gets. 2–10 players, configurable number of rounds, online multiplayer.

## How it works

1. The host logs in with their Spotify account (OAuth handled server-side) and selects playlists
2. Song metadata (title, artist, year, cover) is fetched from the Spotify Web API via the server
3. Audio previews (30s) come from the iTunes Search API — no auth, no Premium required
4. Players join via room code or invite link
5. Each turn: listen to the preview, place the song in the right spot on your timeline
6. Correct placement → +1 point and the card stays. Wrong → card is discarded

## Tech Stack

- **React 19 + TypeScript 5** with Vite
- **Emotion** (`@emotion/styled`) for CSS-in-JS — no `.css` files
- **Spotify Web API** — server-side PKCE OAuth, session via httpOnly cookie
- **iTunes Search API** for 30s audio previews
- **Socket.io** for real-time multiplayer
- **Express** as the backend server

## Setup

### 1. Create a Spotify Developer App

Go to [developer.spotify.com](https://developer.spotify.com), create an app and add the following redirect URI:

```text
http://[::1]:5174/api/auth/callback
```

> **Note:** Spotify does not accept `localhost` — the URI must use `[::1]` exactly as shown.

### 2. Configure the server

Create `server/.env.local`:

```env
PORT=3001
FRONTEND_ORIGIN=http://[::1]:5174
NODE_ENV=development
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_REDIRECT_URI=http://[::1]:5174/api/auth/callback
```

### 3. Install and run

```bash
npm install
npm run dev
```

This starts both the Vite dev server (`http://[::1]:5174`) and the Express/Socket.io server (`http://[::1]:3001`) in parallel.

## Scripts

```bash
npm run dev          # start client + server in parallel
npm run dev:client   # Vite dev server only → http://[::1]:5174
npm run dev:server   # Express/Socket.io server only → http://[::1]:3001
npm run build        # production build (client + server)
npm run typecheck    # TypeScript check (client + server)
npm run lint         # ESLint (client)
npm run format       # Prettier (client)
```

## Deployment

A multi-stage `Dockerfile` is included for deployment on Coolify or any container platform. The Express server serves the client build as static files in production.

Required environment variables (runtime):

| Variable               | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `PORT`                 | Port the server listens on                         |
| `FRONTEND_ORIGIN`      | Allowed CORS origin (frontend URL)                 |
| `NODE_ENV`             | Set to `production`                                |
| `SPOTIFY_CLIENT_ID`    | Spotify Developer App client ID                    |
| `SPOTIFY_REDIRECT_URI` | Redirect URI registered in Spotify Developer App   |

## Planned Features

- Team mode, time limit per turn
- Sound effects for correct/incorrect placements
