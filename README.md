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

Diagrams of the room states, turns, reconnects and pause rules (German): [docs/architecture.md](docs/architecture.md)

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

**Spotify limits for apps in Development Mode** (as of 2026, see Spotify's [quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)):

- The account that owns the app needs an active **Spotify Premium** subscription. If it lapses, login and playlist loading stop working.
- At most **5 Spotify users** can use the app. Add everyone who should be able to host under **Settings → User Management** (name and the e-mail address of their Spotify account). Hosts who aren't on the list can log in but get no playlists. Players who join via room code never log in to Spotify.
- Apps created since February 2026 only get the songs of playlists the host **owns or collaborates on**. Spotify-owned playlists (editorial lists, Discover Weekly, Daily Mix …) can't be loaded by any Development Mode app — copy their songs into a playlist of your own instead.

Audio previews come from the iTunes Search API, which Apple limits to roughly **20 requests per minute** per IP — here, the server's. Only original recordings make it into the game: remixes, live takes, re-recordings and remasters are skipped, as are songs without a preview of the original. The year is the earliest release Spotify or iTunes knows, so a best-of or reissue doesn't move a song into the wrong decade.

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

Requires Node.js 22+.

```bash
npm install
npm run dev
```

This starts both the Vite dev server (`http://[::1]:5174`) and the Express/Socket.io server (`http://[::1]:3001`) in parallel.

Alternatively, `docker-compose up` runs the same two processes in containers with file watching for local development (see `docker-compose.yml`). Use the `Dockerfile` directly for a production-style build.

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

## Contributing

Issues and pull requests use templates:

- **Issues:** pick a form when you open one (bug report, feature request or question). Please report security problems privately via *Report a security vulnerability*, not as a public issue.
- **Pull requests:** the description follows [`.github/pull_request_template.md`](.github/pull_request_template.md). The *PR description* check fails until the required sections are filled in and the checklist is ticked.

## License

[MIT](LICENSE)
