#!/usr/bin/env node
// Bot players for a Tuneline room: they join, place a song when it's their turn and log
// every event they get. Run in the background and stop with Ctrl+C / TaskStop.
//
// Usage: node bots.mjs <ROOM> [count=2] [options]
//   --names "Anna,Ben"     player names instead of "Bot 1", "Bot 2", … (max 30 chars each)
//   --songs songs.json     the list the host started with: bots look up each song's year by
//                          its preview URL and place correctly, so timelines grow. Without it
//                          they place at random (players only ever get the preview during a turn).
//   --leave-after-game     leave the room from the result screen 2 s after game_over
//   --think MS             wait this long after a turn starts before placing (default 1000);
//                          raise it to look at a turn's start before the next reveal begins
//   --server URL           default http://[::1]:3001

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// socket.io-client is a devDependency of the server workspace.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { io } = createRequire(path.join(repoRoot, 'server/package.json'))('socket.io-client');

const REVEAL_DURATION_MS = 3000; // keep in sync with shared/src/index.ts

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const flag = (name) => {
  const i = args.indexOf(name);
  if (i !== -1) args.splice(i, 1);
  return i !== -1;
};

const server = option('--server') ?? 'http://[::1]:3001';
const songsFile = option('--songs');
const names = option('--names')?.split(',').map((n) => n.trim());
const leaveAfterGame = flag('--leave-after-game');
const thinkMs = Number(option('--think') ?? 1000);
const [roomCode, countArg] = args;
if (!roomCode) {
  console.error('Usage: node bots.mjs <ROOM> [count] [--names a,b] [--songs file] [--think ms] [--leave-after-game]');
  process.exit(1);
}
const botNames = names ?? Array.from({ length: Number(countArg) || 2 }, (_, i) => `Bot ${i + 1}`);
const yearByPreview = songsFile
  ? new Map(JSON.parse(readFileSync(songsFile, 'utf8')).map((s) => [s.preview, s.year]))
  : null;

function startBot(name, index) {
  const socket = io(server, { transports: ['websocket'] });
  const log = (...msg) => console.log(`[${name}]`, ...msg);
  let playerId = null;
  let playerToken = null;
  let turnTimer = null;

  /** Places after a pause, like a person who listens first — and after the reveal. */
  const playIfMyTurn = (gameState, song, delayMs) => {
    clearTimeout(turnTimer);
    if (!gameState || !song || gameState.currentPlayerId !== playerId) return;
    turnTimer = setTimeout(() => {
      const timeline = gameState.players.find((p) => p.id === playerId)?.timeline ?? [];
      const year = yearByPreview?.get(song.preview);
      const position =
        year === undefined
          ? Math.floor(Math.random() * (timeline.length + 1))
          : timeline.filter((s) => s.year < year).length;
      log(`places at position ${position}${year === undefined ? ' (random)' : ` (year ${year})`}`);
      socket.emit('place_song', { position });
    }, delayMs);
  };

  socket.on('connect', () => {
    if (playerToken) socket.emit('rejoin_room', { roomCode, playerToken });
    else socket.emit('join_room', { roomCode, playerName: name });
  });
  socket.on('disconnect', (reason) => log('disconnected:', reason));
  socket.on('room_joined', (d) => {
    playerId = d.playerId;
    playerToken = d.playerToken;
    log(`joined ${d.room.roomCode} (${d.room.status}, ${d.room.players.length} players)`);
  });
  // Every bot gets every room update; one log line per update is enough.
  if (index === 0) {
    socket.on('room_updated', ({ room }) =>
      log(`room_updated: ${room.status}, players: ${room.players.map((p) => p.name).join(', ')}`)
    );
  }
  socket.on('game_started', ({ gameState, currentSong }) => {
    log(`game_started, round ${gameState.round}/${gameState.rounds}`);
    playIfMyTurn(gameState, currentSong, thinkMs);
  });
  socket.on('placement_result', ({ correct, timedOut, song, gameState, nextSong }) => {
    const who = gameState.players.find((p) => p.timeline.some((s) => s.id === song.id))?.name;
    log(`placement_result: ${song.title} (${song.year}) ${timedOut ? 'timed out' : correct ? `correct${who ? ` for ${who}` : ''}` : 'wrong'}`);
    playIfMyTurn(gameState, nextSong, REVEAL_DURATION_MS + thinkMs);
  });
  socket.on('game_paused', ({ disconnectedPlayerName }) => {
    clearTimeout(turnTimer);
    log(`game_paused (${disconnectedPlayerName} offline)`);
  });
  socket.on('game_resumed', ({ gameState, currentSong }) => {
    log('game_resumed');
    playIfMyTurn(gameState, currentSong, thinkMs);
  });
  socket.on('game_over', ({ players }) => {
    clearTimeout(turnTimer);
    log(`game_over: ${players.map((p) => `${p.name} ${p.score}`).join(', ')}`);
    if (leaveAfterGame) setTimeout(() => (log('leaves the room'), socket.emit('leave_room')), 2000);
  });
  for (const event of ['room_closed', 'player_kicked', 'session_replaced', 'rejoin_failed']) {
    socket.on(event, () => {
      log(event);
      socket.disconnect();
    });
  }
  socket.on('error', ({ message }) => log('error:', message));
  return socket;
}

const sockets = botNames.map(startBot);
process.on('SIGINT', () => {
  for (const s of sockets) s.disconnect();
  process.exit(0);
});
process.on('SIGTERM', () => process.emit('SIGINT'));
