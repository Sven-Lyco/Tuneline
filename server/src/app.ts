import express from 'express';
import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { ClientToServerEvents, ServerToClientEvents, SongsResponse } from '@tuneline/shared';
import {
  FAILED_JOIN_WINDOW_MS,
  MAX_FAILED_JOINS,
  MAX_SOCKETS_PER_IP,
  type TurnResult,
} from './types.js';
import { AttemptLimiter, ConnectionCounter } from './limits.js';
import { REACTION_EMOJIS } from '@tuneline/shared';
import { join } from 'path';

import { RoomManager } from './rooms.js';
import { httpLogger, logger } from './logger.js';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  createSession,
  getSession,
  deleteSession,
} from './auth.js';
import { getAuthUrl, exchangeCode, getValidToken, getUserPlaylists, loadSongs } from './spotify.js';

export interface TunelineServerOptions {
  /** Allowed CORS origin for Socket.io. */
  frontendOrigin: string;
  /** Serves the built client and marks cookies secure. */
  isProd: boolean;
  /** Where the built client lives (tests point this at a temp folder). */
  clientDist?: string;
}

/**
 * Content-Security-Policy for the built client (in dev Vite serves the page, so it doesn't apply).
 * Every external source the browser loads is listed here — add new ones (fonts, CDNs) here too.
 * No upgrade-insecure-requests: HSTS already enforces HTTPS, and a local production run uses http.
 */
export function cspDirectives(frontendOrigin: string) {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    scriptSrcAttr: ["'none'"],
    // Emotion injects <style> tags at runtime and the app sets style attributes.
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ['https://fonts.gstatic.com'],
    // Song covers (i.scdn.co) and playlist covers (mosaic.scdn.co, image-cdn-*.spotifycdn.com).
    imgSrc: ["'self'", 'data:', 'https://*.scdn.co', 'https://*.spotifycdn.com'],
    mediaSrc: ['https://audio-ssl.itunes.apple.com'],
    connectSrc: ["'self'", ...socketOrigins(frontendOrigin)],
    manifestSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };
}

/** The frontend origin and its WebSocket twin for Socket.io (Safari doesn't match ws: via 'self'). */
function socketOrigins(frontendOrigin: string): string[] {
  try {
    const url = new URL(frontendOrigin);
    // CSP can't express IPv6 literals like [::1]; 'self' covers the local setup.
    if (url.hostname.startsWith('[')) return [];
    return [url.origin, `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}`];
  } catch {
    return [];
  }
}

/** Builds the HTTP + Socket.io server without listening, so tests can run it on any port. */
export function createTunelineServer({
  frontendOrigin,
  isProd,
  clientDist = join(__dirname, '../../client/dist'),
}: TunelineServerOptions) {
  const app = express();
  const httpServer = createServer(app);

  app.set('trust proxy', 1); // Trust Coolify's reverse proxy for correct client IPs
  app.use(helmet({ contentSecurityPolicy: { useDefaults: false, directives: cspDirectives(frontendOrigin) } }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json());
  app.use(httpLogger);

  type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

  const io: IoServer = new Server(httpServer, {
    cors: {
      origin: frontendOrigin,
      methods: ['GET', 'POST'],
    },
    // The largest valid message is start_game: MAX_SONGS songs of at most ~1 KB each.
    maxHttpBufferSize: 640 * 1024,
  });

  // Per-IP rate limiting for HTTP endpoints
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ── Auth routes ───────────────────────────────────────────────────────────────

  app.get('/api/auth/login', (_req, res) => {
    const authUrl = getAuthUrl();
    res.json({ authUrl });
    logger.debug('auth_login_requested');
  });

  app.get('/api/auth/callback', async (req, res) => {
    const code = String(req.query.code ?? '');
    const state = String(req.query.state ?? '');

    if (!code || !state) {
      res.redirect('/?auth_error=true');
      return;
    }

    const session = await exchangeCode(code, state);
    if (!session) {
      logger.warn('auth_callback_exchange_failed');
      res.redirect('/?auth_error=true');
      return;
    }

    const sessionId = createSession(session);
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });

    logger.info('auth_callback_success');
    res.redirect('/?authenticated=true');
  });

  app.post('/api/auth/logout', (req, res) => {
    const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (sessionId) deleteSession(sessionId);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
    logger.debug('auth_logout');
  });

  app.get('/api/auth/status', (req, res) => {
    const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const authenticated = !!sessionId && !!getSession(sessionId);
    res.json({ authenticated });
  });

  // ── Spotify data routes ───────────────────────────────────────────────────────

  app.get('/api/playlists', async (req, res) => {
    const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!sessionId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    const token = await getValidToken(sessionId);
    if (!token) {
      deleteSession(sessionId);
      res.clearCookie(SESSION_COOKIE, { path: '/' });
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    const result = await getUserPlaylists(token);
    if (!result.ok) {
      logger.warn({ problem: result.problem }, 'playlists_refused');
      const status = { not_allowlisted: 403, quota: 429, unavailable: 502 }[result.problem];
      res.status(status).json({ error: result.problem });
      return;
    }
    logger.debug({ count: result.playlists.length }, 'playlists_fetched');
    res.json(result.playlists);
  });

  app.post('/api/songs', async (req, res) => {
    const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!sessionId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    const token = await getValidToken(sessionId);
    if (!token) {
      deleteSession(sessionId);
      res.clearCookie(SESSION_COOKIE, { path: '/' });
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    const { playlistIds, target, excludeIds = [] } = req.body as {
      playlistIds?: unknown;
      target?: unknown;
      excludeIds?: unknown;
    };
    const isIdList = (v: unknown, max: number): v is string[] =>
      Array.isArray(v) && v.length <= max && v.every((id) => typeof id === 'string' && id.length <= 64);

    if (
      !isIdList(playlistIds, 10) ||
      playlistIds.length === 0 ||
      !isIdList(excludeIds, 1000) ||
      typeof target !== 'number' ||
      target < 1 ||
      target > 500
    ) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    // The host can cancel loading; stop hitting Spotify/iTunes once nobody waits for the answer.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });

    const { songs, unavailablePlaylists, previewStats, yearsCorrected, duplicatesRemoved, previewsUnavailable } =
      await loadSongs(token, playlistIds, target, new Set(excludeIds), abort.signal);
    if (abort.signal.aborted) return;
    logger.info(
      {
        playlists: playlistIds.length,
        songs: songs.length,
        unavailablePlaylists,
        // Measures whether loading hits iTunes' ~20 requests/min before adding a throttle.
        itunesLookups: previewStats.lookups,
        itunesFailed: previewStats.failed,
        itunesWaitedMs: previewStats.waitedMs,
        yearsCorrected,
        duplicatesRemoved,
      },
      'songs_loaded',
    );
    res.json({ songs, unavailablePlaylists, previewsUnavailable } satisfies SongsResponse);
  });

  // Serve built client in production. The client only uses "/" (state lives in the app and
  // in ?room=), so there is no catch-all: unknown paths — mostly scanners probing for /.env,
  // /wp-admin and the like — get a plain 404 instead of the app with a misleading 200.
  if (isProd) {
    app.use(express.static(clientDist));
  }

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) res.status(404).json({ error: 'Not found' });
    else res.status(404).type('text/plain').send('Not found');
  });

  const rooms = new RoomManager({
    onHostTimeout: (roomCode) => {
      emitGameOver(io, roomCode, null);
      logger.warn({ roomCode }, 'host_timeout_game_over');
    },
    onTurnTimeout: (roomCode, result) => {
      emitTurnResult(io, roomCode, result);
      logger.info({ roomCode, playerId: result.lastPlayerId }, 'turn_timed_out');
    },
  });

  // ── Per-socket rate limiter ───────────────────────────────────────────────

  function makeRateLimiter(limit = 15, windowMs = 1000) {
    let count = 0;
    let resetAt = Date.now() + windowMs;

    return function isLimited(): boolean {
      const now = Date.now();
      if (now > resetAt) {
        count = 0;
        resetAt = now + windowMs;
      }
      return ++count > limit;
    };
  }

  const PAYLOAD_EVENTS = new Set<keyof ClientToServerEvents>([
    'create_room',
    'join_room',
    'rejoin_room',
    'start_game',
    'update_settings',
    'place_song',
    'kick_player',
    'send_reaction',
  ]);

  // Same single-proxy assumption as `trust proxy 1`: the last X-Forwarded-For entry is set by Coolify.
  function clientIp(handshake: Socket['handshake']): string {
    const forwarded = handshake.headers['x-forwarded-for'];
    const last = typeof forwarded === 'string' ? forwarded.split(',').pop()?.trim() : undefined;
    return last || handshake.address;
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  /** `last` is the turn that ended the game, if a turn did (not a skip or the host leaving). */
  function emitGameOver(io: IoServer, roomCode: string, last: TurnResult | null, target: string = roomCode) {
    const players = rooms.getPlayers(roomCode);
    if (!players) return;
    const winner = [...players].sort((a, b) => b.score - a.score)[0];
    const winnerLastSong = winner ? rooms.getLastCorrectSong(roomCode, winner.id) : null;
    io.to(target).emit('game_over', {
      players,
      lastSong: last?.song ?? null,
      lastCorrect: last?.correct ?? false,
      lastTimedOut: last?.timedOut ?? false,
      lastPlayerId: last?.lastPlayerId ?? '',
      winnerLastSong,
    });
  }

  /** Broadcasts the outcome of a finished turn (placement or timeout). */
  function emitTurnResult(io: IoServer, roomCode: string, result: TurnResult) {
    if (result.gameOver) {
      emitGameOver(io, roomCode, result);
      const players = rooms.getPlayers(roomCode);
      const scores = Object.fromEntries(players?.map((p) => [p.name, p.score]) ?? []);
      logger.info({ roomCode, scores }, 'game_over');
      return;
    }

    const gameState = rooms.getGameState(roomCode);
    if (!gameState) return;
    io.to(roomCode).emit('placement_result', {
      correct: result.correct,
      timedOut: result.timedOut,
      song: result.song,
      gameState,
      nextSong: rooms.getCurrentSongPreview(roomCode),
    });
    // The next player may be offline; clients apply the pause once the reveal is over.
    if (rooms.getPausedPlayer(roomCode)) emitPauseOrResume(io, roomCode);
  }

  /** Sends game_paused while the host or the current player is offline, else game_resumed. */
  function emitPauseOrResume(io: IoServer, roomCode: string, target: string = roomCode) {
    const gameState = rooms.getGameState(roomCode);
    const currentSong = rooms.getCurrentSongPreview(roomCode);
    if (!gameState || !currentSong) return;

    const paused = rooms.getPausedPlayer(roomCode);
    if (paused) {
      io.to(target).emit('game_paused', {
        disconnectedPlayerId: paused.id,
        disconnectedPlayerName: paused.name,
        isHostDisconnected: paused.isHost,
        gameState,
        currentSong,
      });
      logger.info({ roomCode, playerName: paused.name }, 'game_paused');
    } else {
      io.to(target).emit('game_resumed', { gameState, currentSong });
      logger.info({ roomCode, currentPlayerId: gameState.currentPlayerId }, 'game_resumed');
    }
  }

  function onDisconnect(socketId: string, io: IoServer) {
    logger.debug({ socketId }, 'socket_disconnect');
    const info = rooms.handleDisconnect(socketId);
    if (!info) return;

    logger.info(
      { roomCode: info.roomCode, playerId: info.playerId, isHost: info.isHost },
      'player_disconnected'
    );

    if (!info.wasPlaying) {
      // A host who drops mid-load can't finish starting the game.
      if (info.isHost) io.to(info.roomCode).emit('game_loading_cancelled');
      const lobby = rooms.getLobbyState(info.roomCode);
      if (lobby) io.to(info.roomCode).emit('room_updated', { room: lobby });
      return;
    }

    // Only the host or the player on turn pauses the game (a host only for HOST_RECONNECT_GRACE_MS,
    // see RoomManager); anyone else just shows up as offline until their turn comes.
    if (rooms.getPausedPlayer(info.roomCode)) {
      emitPauseOrResume(io, info.roomCode);
    } else {
      const gameState = rooms.getGameState(info.roomCode);
      if (gameState) io.to(info.roomCode).emit('game_state_updated', { gameState });
    }
  }

  // ── Socket.io event handlers ──────────────────────────────────────────────

  // A whole party on one Wi-Fi shares an IP, so the cap is generous; it stops one machine from
  // opening thousands of sockets. Refused here, the client gets connect_error 'too_many_connections'.
  const socketsPerIp = new ConnectionCounter(MAX_SOCKETS_PER_IP);
  io.use((socket, next) => {
    const ip = clientIp(socket.handshake);
    if (!socketsPerIp.tryAdd(ip)) {
      logger.warn({ ip }, 'too_many_connections');
      next(new Error('too_many_connections'));
      return;
    }
    socket.once('disconnect', () => socketsPerIp.remove(ip));
    next();
  });

  // Unknown room codes and tokens per IP: stops guessing room codes to crash other games.
  const failedJoins = new AttemptLimiter(MAX_FAILED_JOINS, FAILED_JOIN_WINDOW_MS);
  const TOO_MANY_FAILED_JOINS = 'Zu viele fehlgeschlagene Beitrittsversuche. Bitte warte ein paar Minuten.';

  io.on('connection', (socket) => {
    const isLimited = makeRateLimiter();
    logger.debug({ socketId: socket.id }, 'socket_connect');

    // Dropping a packet here (no next()) means its handler never runs.
    socket.use(([event, payload], next) => {
      if (isLimited()) return;
      const needsPayload = PAYLOAD_EVENTS.has(event as keyof ClientToServerEvents);
      if (needsPayload && (typeof payload !== 'object' || payload === null)) return;
      rooms.touch(socket.id);
      next();
    });

    socket.on('create_room', ({ hostName, rounds, audioMode, turnLimit }) => {
      if (typeof hostName !== 'string' || !hostName.trim()) return;

      const result = rooms.createRoom(
        socket.id,
        clientIp(socket.handshake),
        hostName,
        rounds,
        audioMode,
        turnLimit
      );
      if (!result.ok) {
        socket.emit('error', { message: result.error });
        logger.warn({ error: result.error }, 'create_room_denied');
        return;
      }

      const { roomCode, playerId, playerToken } = result;
      socket.join(roomCode);
      socket.emit('room_created', { roomCode, playerId, playerToken });
      const lobby = rooms.getLobbyState(roomCode);
      if (lobby) io.to(roomCode).emit('room_updated', { room: lobby });
      logger.info({ roomCode, hostName: hostName.trim(), playerId }, 'create_room');
    });

    /** Puts a freshly joined or reconnected socket into the room and syncs everyone. */
    const finishJoin = (
      code: string,
      joined: { playerId: string; playerToken: string; replacedSocketId?: string },
      wasPaused: boolean
    ) => {
      // The player was still active in another tab/device: tell that one it's over.
      if (joined.replacedSocketId) {
        io.to(joined.replacedSocketId).emit('session_replaced');
        io.sockets.sockets.get(joined.replacedSocketId)?.disconnect(true);
      }

      socket.join(code);
      const lobby = rooms.getLobbyState(code);
      if (!lobby) return;

      socket.emit('room_joined', {
        playerId: joined.playerId,
        playerToken: joined.playerToken,
        room: lobby,
      });

      if (lobby.status === 'playing') {
        if (wasPaused) {
          // Others were waiting: tell everyone whether the game goes on.
          emitPauseOrResume(io, code);
        } else {
          // Only sync the newcomer; a game_resumed for all would restart everyone's song.
          emitPauseOrResume(io, code, socket.id);
          const gameState = rooms.getGameState(code);
          if (gameState) socket.to(code).emit('game_state_updated', { gameState });
        }
      } else if (lobby.status === 'finished') {
        emitGameOver(io, code, null, socket.id);
      } else {
        io.to(code).emit('room_updated', { room: lobby });
      }
    };

    socket.on('join_room', ({ roomCode, playerName, playerToken }) => {
      if (typeof roomCode !== 'string' || typeof playerName !== 'string') return;

      const code = roomCode.toUpperCase().trim();
      const ip = clientIp(socket.handshake);
      if (failedJoins.isBlocked(ip)) {
        socket.emit('error', { message: TOO_MANY_FAILED_JOINS });
        return;
      }
      const wasPaused = rooms.getPausedPlayer(code) !== null;
      const result = rooms.joinRoom(socket.id, code, playerName, playerToken);

      if (!result.ok) {
        // Only an unknown code counts as guessing — not a full room or a taken name.
        if (!rooms.getLobbyState(code)) failedJoins.recordFailure(ip);
        logger.warn({ roomCode: code, playerName, error: result.error }, 'join_room_denied');
        socket.emit('error', { message: result.error });
        return;
      }

      finishJoin(code, result, wasPaused);
      logger.info(
        { roomCode: code, playerName: playerName.trim(), playerId: result.playerId },
        'join_room'
      );
    });

    socket.on('rejoin_room', ({ roomCode, playerToken }) => {
      if (typeof roomCode !== 'string' || typeof playerToken !== 'string') {
        socket.emit('rejoin_failed');
        return;
      }

      const code = roomCode.toUpperCase().trim();
      const ip = clientIp(socket.handshake);
      if (failedJoins.isBlocked(ip)) {
        socket.emit('rejoin_failed');
        return;
      }
      const wasPaused = rooms.getPausedPlayer(code) !== null;
      const result = rooms.rejoinRoom(socket.id, code, playerToken);
      if (!result.ok) {
        failedJoins.recordFailure(ip);
        socket.emit('rejoin_failed');
        logger.info({ roomCode: code }, 'rejoin_failed');
        return;
      }

      finishJoin(code, result, wasPaused);
      logger.info({ roomCode: code, playerId: result.playerId }, 'rejoin_room');
    });

    socket.on('leave_room', () => {
      const result = rooms.leaveRoom(socket.id);
      if (!result) return;

      socket.leave(result.roomCode);
      if (result.closed) {
        io.to(result.roomCode).emit('room_closed');
        io.in(result.roomCode).socketsLeave(result.roomCode);
        logger.info({ roomCode: result.roomCode }, 'room_closed_by_host');
        return;
      }

      const lobby = rooms.getLobbyState(result.roomCode);
      if (lobby) io.to(result.roomCode).emit('room_updated', { room: lobby });
      logger.info({ roomCode: result.roomCode }, 'leave_room');
    });

    socket.on('start_loading', () => {
      const roomCode = rooms.getRoomCodeForSocket(socket.id);
      if (!roomCode || !rooms.isHost(socket.id, roomCode)) return;
      socket.to(roomCode).emit('game_loading');
      logger.debug({ roomCode }, 'start_loading');
    });

    socket.on('cancel_loading', () => {
      const roomCode = rooms.getRoomCodeForSocket(socket.id);
      if (!roomCode || !rooms.isHost(socket.id, roomCode)) return;
      socket.to(roomCode).emit('game_loading_cancelled');
      logger.debug({ roomCode }, 'cancel_loading');
    });

    socket.on('start_game', ({ songs, rounds, audioMode }) => {
      const roomCode = rooms.getRoomCodeForSocket(socket.id);
      if (!roomCode || !rooms.isHost(socket.id, roomCode)) return;

      const result = rooms.startGame(socket.id, roomCode, songs, rounds, audioMode);
      if (!result.ok) {
        logger.warn({ roomCode, error: result.error }, 'start_game_denied');
        socket.emit('error', { message: result.error });
        io.to(roomCode).emit('game_loading_cancelled');
        return;
      }

      const gameState = rooms.getGameState(roomCode);
      const currentSong = rooms.getCurrentSongPreview(roomCode);
      if (!gameState || !currentSong) return;

      io.to(roomCode).emit('game_started', { gameState, currentSong });
      logger.info(
        { roomCode, songs: songs.length, rounds, audioMode, players: gameState.players.length },
        'start_game'
      );
    });

    socket.on('update_settings', ({ rounds, audioMode, turnLimit }) => {
      const roomCode = rooms.getRoomCodeForSocket(socket.id);
      if (!roomCode) return;

      const result = rooms.updateSettings(socket.id, roomCode, rounds, audioMode, turnLimit);
      if (!result.ok) {
        socket.emit('error', { message: result.error });
        return;
      }

      const lobby = rooms.getLobbyState(roomCode);
      if (lobby) io.to(roomCode).emit('room_updated', { room: lobby });
      logger.info({ roomCode, rounds, audioMode, turnLimit }, 'update_settings');
    });

    socket.on('place_song', ({ position }) => {
      if (typeof position !== 'number') return;
      const roomCode = rooms.getRoomCodeForSocket(socket.id);
      if (!roomCode) return;

      const result = rooms.placeSong(socket.id, roomCode, position);
      if (!result.ok) {
        logger.warn({ roomCode, error: result.error }, 'place_song_denied');
        socket.emit('error', { message: result.error });
        return;
      }

      emitTurnResult(io, roomCode, result);
      logger.info(
        { roomCode, playerId: result.lastPlayerId, song: result.song.title, position, correct: result.correct },
        'place_song'
      );
    });

    socket.on('return_to_lobby', () => {
      const roomCode = rooms.getRoomCodeForSocket(socket.id);
      if (!roomCode) return;

      const result = rooms.returnToLobby(socket.id, roomCode);
      if (!result.ok) {
        logger.warn({ roomCode, error: result.error }, 'return_to_lobby_denied');
        socket.emit('error', { message: result.error });
        return;
      }

      const lobby = rooms.getLobbyState(roomCode);
      if (lobby) io.to(roomCode).emit('room_updated', { room: lobby });
      logger.info({ roomCode }, 'return_to_lobby');
    });

    socket.on('skip_player', () => {
      const roomCode = rooms.getRoomCodeForSocket(socket.id);
      if (!roomCode) return;

      const result = rooms.skipDisconnectedPlayer(socket.id, roomCode);
      if (!result.ok) {
        socket.emit('error', { message: result.error });
        return;
      }

      if (result.gameOver) {
        emitGameOver(io, roomCode, null);
        logger.warn({ roomCode }, 'skip_player_game_over');
        return;
      }

      emitPauseOrResume(io, roomCode);
      logger.info({ roomCode }, 'skip_player');
    });

    socket.on('kick_player', ({ playerId }) => {
      if (typeof playerId !== 'string') return;
      const roomCode = rooms.getRoomCodeForSocket(socket.id);
      if (!roomCode) return;

      const result = rooms.kickPlayer(socket.id, roomCode, playerId);
      if (!result.ok) {
        logger.warn({ roomCode, playerId, error: result.error }, 'kick_player_denied');
        socket.emit('error', { message: result.error });
        return;
      }

      if (result.kickedSocketId) {
        io.to(result.kickedSocketId).emit('player_kicked', { playerId });
        io.sockets.sockets.get(result.kickedSocketId)?.leave(roomCode);
      }

      const lobby = rooms.getLobbyState(roomCode);
      if (lobby) io.to(roomCode).emit('room_updated', { room: lobby });
      logger.info({ roomCode, playerId }, 'kick_player');
    });

    socket.on('send_reaction', ({ emoji }) => {
      if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) return;
      const roomCode = rooms.getRoomCodeForSocket(socket.id);
      if (!roomCode) return;
      const player = rooms.getPlayerForSocket(socket.id);
      if (!player) return;
      io.to(roomCode).emit('reaction_received', { playerId: player.id, playerName: player.name, emoji });
      logger.debug({ roomCode, playerName: player.name, emoji }, 'send_reaction');
    });

    socket.on('disconnect', () => onDisconnect(socket.id, io));
  });

  return { app, httpServer, io, rooms };
}
