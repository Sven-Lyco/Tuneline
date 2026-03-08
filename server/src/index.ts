import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import type { ClientToServerEvents, ServerToClientEvents, SongFull } from '@tuneline/shared';
import { join } from 'path';
import { RoomManager } from './rooms.js';
import { previewHandler } from './preview.js';

const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://[::1]:5174';
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1); // Trust Coolify's reverse proxy for correct client IPs
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

const io: IoServer = new Server(httpServer, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// Per-IP rate limiting for HTTP endpoints
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/preview', previewHandler);

// Serve built client in production
if (IS_PROD) {
  const clientDist = join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

const rooms = new RoomManager();

// ── Logging ───────────────────────────────────────────────────────────────

function log(roomCode: string | null, event: string, detail = '') {
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const room = roomCode ? `[${roomCode}]` : '[------]';
  console.log(`${ts} ${room} ${event}${detail ? ' — ' + detail : ''}`);
}

// ── Per-socket rate limiter ───────────────────────────────────────────────

function makeRateLimiter(limit = 15, windowMs = 1000) {
  const counts = new Map<string, number>();
  let resetAt = Date.now() + windowMs;

  return function isLimited(event: string): boolean {
    const now = Date.now();
    if (now > resetAt) {
      counts.clear();
      resetAt = now + windowMs;
    }
    const n = (counts.get(event) ?? 0) + 1;
    counts.set(event, n);
    return n > limit;
  };
}

// ── Shared helpers ────────────────────────────────────────────────────────

function emitGameOver(
  io: IoServer,
  roomCode: string,
  lastSong: SongFull | null,
  lastCorrect: boolean,
  lastPlayerId: string,
) {
  const players = rooms.getPlayers(roomCode);
  if (!players) return;
  const winner = [...players].sort((a, b) => b.score - a.score)[0];
  const winnerLastSong = winner ? rooms.getLastCorrectSong(roomCode, winner.id) : null;
  io.to(roomCode).emit('game_over', { players, lastSong, lastCorrect, lastPlayerId, winnerLastSong });
}

function onDisconnect(socketId: string, io: IoServer) {
  log(null, 'disconnect', socketId);
  const info = rooms.handleDisconnect(socketId);
  if (!info) return;

  io.to(info.roomCode).emit('player_disconnected', { playerId: info.playerId });
  log(info.roomCode, 'player_disconnected', `playerId=${info.playerId} isHost=${info.isHost}`);

  if (!info.wasPlaying || !info.shouldPause) {
    const lobby = rooms.getLobbyState(info.roomCode);
    if (lobby) io.to(info.roomCode).emit('room_updated', { room: lobby });
    return;
  }

  const gameState = rooms.getGameState(info.roomCode);
  if (!gameState) return;

  if (info.isHost) {
    emitGameOver(io, info.roomCode, null, false, info.playerId);
    log(info.roomCode, 'host_disconnected → game_over');
    return;
  }

  const connectedCount = gameState.players.filter((p) => p.isConnected).length;
  if (connectedCount <= 1) {
    rooms.finishGame(info.roomCode);
    emitGameOver(io, info.roomCode, null, false, info.playerId);
    log(info.roomCode, 'last_player_disconnected → game_over');
    return;
  }

  io.to(info.roomCode).emit('game_paused', {
    disconnectedPlayerId: info.playerId,
    disconnectedPlayerName: info.playerName,
    isHostDisconnected: false,
    gameState,
  });
  log(info.roomCode, 'game_paused', `player="${info.playerName}"`);
}

// ── Socket.io event handlers ──────────────────────────────────────────────

io.on('connection', (socket) => {
  const isLimited = makeRateLimiter();
  log(null, 'connect', socket.id);

  socket.on('create_room', ({ hostName, rounds, audioMode }) => {
    if (isLimited('create_room')) return;
    if (typeof hostName !== 'string' || !hostName.trim()) return;

    const { roomCode, playerId, playerToken } = rooms.createRoom(socket.id, hostName, rounds ?? 5, audioMode ?? 'all');
    socket.join(roomCode);
    socket.emit('room_created', { roomCode, playerId, playerToken });
    const lobby = rooms.getLobbyState(roomCode);
    if (lobby) io.to(roomCode).emit('room_updated', { room: lobby });
    log(roomCode, 'create_room', `host="${hostName.trim()}" playerId=${playerId}`);
  });

  socket.on('join_room', ({ roomCode, playerName, playerToken }) => {
    if (isLimited('join_room')) return;
    if (typeof roomCode !== 'string' || typeof playerName !== 'string') return;
    if (!playerName.trim()) return;

    const code = roomCode.toUpperCase().trim();
    const result = rooms.joinRoom(socket.id, code, playerName, playerToken);

    if (!result.ok) {
      log(code, 'join_room DENIED', `name="${playerName}" — ${result.error}`);
      socket.emit('error', { message: result.error });
      return;
    }

    socket.join(code);
    const lobby = rooms.getLobbyState(code);
    if (!lobby) return;

    socket.emit('room_joined', { playerId: result.playerId, playerToken: result.playerToken, room: lobby });

    // If reconnecting to an active game, send current game state
    if (lobby.status === 'playing') {
      const gameState = rooms.getGameState(code);
      const currentSong = rooms.getCurrentSongPreview(code);
      if (gameState && currentSong) {
        io.to(code).emit('game_resumed', { gameState, currentSong });
        log(code, 'player_reconnected → game_resumed', `playerId=${result.playerId}`);
      }
      io.to(code).emit('player_reconnected', { playerId: result.playerId });
    } else {
      io.to(code).emit('room_updated', { room: lobby });
    }

    log(code, 'join_room', `name="${playerName.trim()}" playerId=${result.playerId} players=${lobby.players.length}`);
  });

  socket.on('start_loading', () => {
    if (isLimited('start_loading')) return;
    const roomCode = rooms.getRoomCodeForSocket(socket.id);
    if (!roomCode) return;
    socket.to(roomCode).emit('game_loading');
    log(roomCode, 'start_loading');
  });

  socket.on('start_game', ({ songs, rounds, audioMode }) => {
    if (isLimited('start_game')) return;
    const roomCode = rooms.getRoomCodeForSocket(socket.id);
    if (!roomCode) return;

    const result = rooms.startGame(socket.id, roomCode, songs, rounds, audioMode);
    if (!result.ok) {
      log(roomCode, 'start_game DENIED', result.error);
      socket.emit('error', { message: result.error });
      return;
    }

    const gameState = rooms.getGameState(roomCode);
    const currentSong = rooms.getCurrentSongPreview(roomCode);
    if (!gameState || !currentSong) return;

    io.to(roomCode).emit('game_started', { gameState, currentSong });
    log(roomCode, 'start_game', `songs=${songs.length} rounds=${rounds} audio=${audioMode} players=${gameState.players.length}`);
  });

  socket.on('update_settings', ({ rounds, audioMode }) => {
    if (isLimited('update_settings')) return;
    const roomCode = rooms.getRoomCodeForSocket(socket.id);
    if (!roomCode) return;

    const result = rooms.updateSettings(socket.id, roomCode, rounds, audioMode);
    if (!result.ok) {
      socket.emit('error', { message: result.error });
      return;
    }

    const lobby = rooms.getLobbyState(roomCode);
    if (lobby) io.to(roomCode).emit('room_updated', { room: lobby });
    log(roomCode, 'update_settings', `rounds=${rounds} audio=${audioMode}`);
  });

  socket.on('place_song', ({ position }) => {
    if (isLimited('place_song')) return;
    if (typeof position !== 'number') return;
    const roomCode = rooms.getRoomCodeForSocket(socket.id);
    if (!roomCode) return;

    const result = rooms.placeSong(socket.id, roomCode, position);
    if (!result.ok) {
      log(roomCode, 'place_song DENIED', result.error);
      socket.emit('error', { message: result.error });
      return;
    }

    if (result.gameOver) {
      emitGameOver(io, roomCode, result.song, result.correct, result.lastPlayerId);
      const players = rooms.getPlayers(roomCode);
      log(roomCode, 'game_over', players?.map((p) => `${p.name}=${p.score}`).join(' ') ?? '');
    } else {
      const gameState = rooms.getGameState(roomCode);
      const nextSong = rooms.getCurrentSongPreview(roomCode);
      if (!gameState) return;
      io.to(roomCode).emit('placement_result', { correct: result.correct, song: result.song, gameState, nextSong });
      const playerName = gameState.players.find((p) => p.id === result.lastPlayerId)?.name ?? '?';
      log(roomCode, 'place_song', `${playerName} "${result.song.title}" pos=${position} correct=${result.correct} round=${gameState.round}/${gameState.rounds}`);
    }
  });

  socket.on('return_to_lobby', () => {
    if (isLimited('return_to_lobby')) return;
    const roomCode = rooms.getRoomCodeForSocket(socket.id);
    if (!roomCode) return;

    const result = rooms.returnToLobby(socket.id, roomCode);
    if (!result.ok) {
      log(roomCode, 'return_to_lobby DENIED', result.error);
      socket.emit('error', { message: result.error });
      return;
    }

    const lobby = rooms.getLobbyState(roomCode);
    if (lobby) io.to(roomCode).emit('room_updated', { room: lobby });
    log(roomCode, 'return_to_lobby');
  });

  socket.on('skip_player', () => {
    if (isLimited('skip_player')) return;
    const roomCode = rooms.getRoomCodeForSocket(socket.id);
    if (!roomCode) return;

    const result = rooms.skipDisconnectedPlayer(socket.id, roomCode);
    if (!result.ok) {
      socket.emit('error', { message: result.error });
      return;
    }

    const gameState = rooms.getGameState(roomCode);
    const currentSong = rooms.getCurrentSongPreview(roomCode);

    if (!gameState || gameState.players.length <= 1 || !currentSong) {
      emitGameOver(io, roomCode, null, false, '');
      log(roomCode, 'skip_player → game_over (≤1 player left)');
      return;
    }

    io.to(roomCode).emit('game_resumed', { gameState, currentSong });
    log(roomCode, 'skip_player', `resumed, currentPlayer=${gameState.currentPlayerId}`);
  });

  socket.on('kick_player', ({ playerId }) => {
    if (isLimited('kick_player')) return;
    if (typeof playerId !== 'string') return;
    const roomCode = rooms.getRoomCodeForSocket(socket.id);
    if (!roomCode) return;

    const result = rooms.kickPlayer(socket.id, roomCode, playerId);
    if (!result.ok) {
      log(roomCode, 'kick_player DENIED', result.error);
      socket.emit('error', { message: result.error });
      return;
    }

    if (result.kickedSocketId) {
      io.to(result.kickedSocketId).emit('player_kicked', { playerId });
      io.sockets.sockets.get(result.kickedSocketId)?.leave(roomCode);
    }

    const lobby = rooms.getLobbyState(roomCode);
    if (lobby) io.to(roomCode).emit('room_updated', { room: lobby });
    log(roomCode, 'kick_player', `playerId=${playerId}`);
  });

  socket.on('disconnect', () => onDisconnect(socket.id, io));
});

httpServer.listen(PORT, () => {
  console.log(`[server] Running on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
});
