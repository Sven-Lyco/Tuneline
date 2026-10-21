import type { SongFull, AudioMode } from '@tuneline/shared';
import type {
  Room,
  InternalPlayer,
  SimpleResult,
  PlaceResult,
  SkipResult,
  TurnResult,
} from './types.js';
import { clampRounds, isValidAudioMode, MAX_FIELD_LENGTH, MAX_SONGS } from './types.js';
import { shuffle } from './utils.js';

function isCorrectPlacement(timeline: SongFull[], song: SongFull, position: number): boolean {
  const left = timeline[position - 1] ?? null;
  const right = timeline[position] ?? null;
  return (left === null || left.year <= song.year) && (right === null || right.year >= song.year);
}

function removeFromOrder(room: Room, playerId: string): void {
  const idx = room.playerOrder.indexOf(playerId);
  if (idx === -1) return;
  room.playerOrder.splice(idx, 1);
  if (idx < room.currentPlayerIndex) {
    room.currentPlayerIndex--;
  } else if (room.currentPlayerIndex >= room.playerOrder.length) {
    room.currentPlayerIndex = 0;
    room.round++;
  }
}

function songsLeft(room: Room): number {
  return room.deck.length - room.currentSongIndex;
}

function isGameOver(room: Room): boolean {
  if (songsLeft(room) <= 0) return true;
  // Only end at a round boundary so everyone gets the same number of turns.
  return (
    room.currentPlayerIndex === 0 &&
    (room.round > room.gameRounds || songsLeft(room) < room.playerOrder.length)
  );
}

function endTurn(
  room: Room,
  playerId: string,
  song: SongFull,
  correct: boolean,
  timedOut: boolean,
): TurnResult {
  room.currentSongIndex++;
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.playerOrder.length;
  if (room.currentPlayerIndex === 0) room.round++;

  const gameOver = isGameOver(room);
  if (gameOver) room.status = 'finished';
  return { correct, timedOut, song, gameOver, lastPlayerId: playerId };
}

const isShortText = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_FIELD_LENGTH;

/**
 * Songs come from the host's client, so everything that's broadcast to others is checked:
 * audio only from iTunes, covers only from Spotify's image CDN (no tracking pixels).
 */
function isValidSong(song: SongFull): boolean {
  return (
    !!song &&
    typeof song === 'object' &&
    isShortText(song.id) &&
    isShortText(song.title) &&
    isShortText(song.artist) &&
    typeof song.year === 'number' &&
    song.year >= 1900 &&
    song.year <= 2100 &&
    isShortText(song.preview) &&
    song.preview.startsWith('https://audio-ssl.itunes.apple.com/') &&
    (song.cover === null || (isShortText(song.cover) && song.cover.startsWith('https://i.scdn.co/')))
  );
}

/**
 * A running game waits while the host is offline (only the host can skip, and in
 * host-only mode the music plays on the host's device) or while the player whose
 * turn it is is offline. Other players dropping out don't stop the game.
 */
export function pausedPlayerId(room: Room): string | null {
  if (room.status !== 'playing') return null;
  const host = [...room.players.values()].find((p) => p.isHost);
  if (host && !host.isConnected) return host.id;
  const currentId = room.playerOrder[room.currentPlayerIndex];
  return currentId && room.players.get(currentId)?.isConnected === false ? currentId : null;
}

export function startGame(
  room: Room,
  songs: SongFull[],
  rounds: number,
  audioMode: AudioMode,
): SimpleResult {
  // A second start (double click, slow load, modified client) must not wipe a running game.
  if (room.status !== 'lobby') return { ok: false, error: 'Das Spiel läuft bereits.' };
  if (!Array.isArray(songs) || songs.length < 2) {
    return { ok: false, error: 'Zu wenige Songs (min. 2).' };
  }
  if (songs.length > MAX_SONGS) {
    return { ok: false, error: `Zu viele Songs (max. ${MAX_SONGS}).` };
  }
  if (!isValidAudioMode(audioMode)) {
    return { ok: false, error: 'Ungültiger Audio-Modus.' };
  }
  if (!songs.every((s) => isValidSong(s))) return { ok: false, error: 'Ungültige Song-Daten.' };

  // Offline players sit this game out; they're seated again if they come back.
  const playerList = room.playerOrder
    .map((id) => room.players.get(id))
    .filter((p): p is InternalPlayer => p?.isConnected === true);
  if (playerList.length < 2) {
    return { ok: false, error: 'Es müssen mindestens 2 Spieler verbunden sein.' };
  }
  if (songs.length < playerList.length * 2) {
    return { ok: false, error: `Zu wenige Songs für ${playerList.length} Spieler.` };
  }
  room.playerOrder = playerList.map((p) => p.id);

  for (const p of room.players.values()) {
    p.timeline = [];
    p.score = 0;
  }

  const shuffled = shuffle([...songs]);
  playerList.forEach((p, i) => {
    p.timeline = [shuffled[i]];
  });

  room.deck = shuffled.slice(playerList.length);
  room.currentSongIndex = 0;
  room.currentPlayerIndex = 0;
  room.round = 1;
  // Never promise more rounds than the deck can cover for everyone; the setting itself stays.
  const affordableRounds = Math.floor(room.deck.length / playerList.length);
  room.rounds = clampRounds(rounds);
  room.gameRounds = Math.max(1, Math.min(room.rounds, affordableRounds));
  room.audioMode = audioMode;
  room.status = 'playing';
  room.lastCorrectSong = new Map();
  return { ok: true };
}

export function placeSong(room: Room, playerId: string, position: number): PlaceResult {
  if (room.status !== 'playing') return { ok: false, error: 'Spiel läuft nicht.' };
  if (pausedPlayerId(room)) return { ok: false, error: 'Das Spiel ist pausiert.' };
  if (!Number.isInteger(position)) return { ok: false, error: 'Ungültige Position.' };

  const currentPlayerId = room.playerOrder[room.currentPlayerIndex];
  if (playerId !== currentPlayerId) return { ok: false, error: 'Du bist nicht dran.' };

  const song = room.deck[room.currentSongIndex];
  if (!song) return { ok: false, error: 'Kein Song verfügbar.' };

  const player = room.players.get(playerId)!;
  const clampedPosition = Math.max(0, Math.min(position, player.timeline.length));
  const correct = isCorrectPlacement(player.timeline, song, clampedPosition);

  if (correct) {
    player.score++;
    player.timeline.splice(clampedPosition, 0, song);
    room.lastCorrectSong.set(playerId, song);
  }

  return { ok: true, ...endTurn(room, playerId, song, correct, false) };
}

/** Resolves the current turn as wrong because its time ran out. */
export function timeoutTurn(room: Room): TurnResult | null {
  if (room.status !== 'playing' || pausedPlayerId(room)) return null;
  const playerId = room.playerOrder[room.currentPlayerIndex];
  const song = room.deck[room.currentSongIndex];
  if (!playerId || !song) return null;
  return endTurn(room, playerId, song, false, true);
}

export function skipDisconnectedPlayer(room: Room): SkipResult {
  const skippedId = pausedPlayerId(room);
  if (!skippedId) return { ok: false, error: 'Spiel ist nicht pausiert.' };

  removeFromOrder(room, skippedId);

  const gameOver = room.playerOrder.length <= 1 || isGameOver(room);
  if (gameOver) room.status = 'finished';
  return { ok: true, gameOver };
}

/**
 * Puts a player who isn't in the turn order (late join, skipped, offline at start)
 * back in. Without cards they get a starting card from the deck, if it can spare one;
 * otherwise they watch until the next game.
 */
export function seatPlayer(room: Room, player: InternalPlayer): void {
  if (room.status !== 'playing' || room.playerOrder.includes(player.id)) return;
  if (player.timeline.length === 0) {
    if (songsLeft(room) <= room.playerOrder.length) return;
    player.timeline = [room.deck.pop()!];
  }
  room.playerOrder.push(player.id);
}

export function returnToLobby(room: Room): void {
  room.status = 'lobby';
  room.playerOrder = [...room.players.keys()];
  room.deck = [];
  room.currentSongIndex = 0;
  room.currentPlayerIndex = 0;
  room.round = 1;
  room.lastCorrectSong = new Map();
  for (const p of room.players.values()) {
    p.timeline = [];
    p.score = 0;
  }
}

export function finishGame(room: Room): void {
  room.status = 'finished';
}
