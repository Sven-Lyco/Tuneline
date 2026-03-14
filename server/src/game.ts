import type { SongFull, AudioMode } from '@tuneline/shared';
import type { Room, InternalPlayer, SimpleResult, PlaceResult } from './types.js';
import { isValidAudioMode, MAX_FIELD_LENGTH, MAX_SONGS } from './types.js';
import { shuffle } from './utils.js';

function isCorrectPlacement(timeline: SongFull[], song: SongFull, position: number): boolean {
  const left = timeline[position - 1] ?? null;
  const right = timeline[position] ?? null;
  return (left === null || left.year <= song.year) && (right === null || right.year >= song.year);
}

export function startGame(
  room: Room,
  songs: SongFull[],
  rounds: number,
  audioMode: AudioMode,
): SimpleResult {
  if (!Array.isArray(songs) || songs.length < 2) {
    return { ok: false, error: 'Zu wenige Songs (min. 2).' };
  }
  if (songs.length > MAX_SONGS) {
    return { ok: false, error: `Zu viele Songs (max. ${MAX_SONGS}).` };
  }
  if (!isValidAudioMode(audioMode)) {
    return { ok: false, error: 'Ungültiger Audio-Modus.' };
  }
  for (const song of songs) {
    if (
      typeof song.id !== 'string' ||
      song.id.length > MAX_FIELD_LENGTH ||
      typeof song.title !== 'string' ||
      song.title.length > MAX_FIELD_LENGTH ||
      typeof song.artist !== 'string' ||
      song.artist.length > MAX_FIELD_LENGTH ||
      typeof song.year !== 'number' ||
      song.year < 1900 ||
      song.year > 2100
    ) {
      return { ok: false, error: 'Ungültige Song-Daten.' };
    }
  }

  const playerList = room.playerOrder
    .map((id) => room.players.get(id))
    .filter((p): p is InternalPlayer => p !== undefined);

  for (const p of playerList) {
    p.timeline = [];
    p.score = 0;
  }

  const shuffled = shuffle([...songs]);
  playerList.forEach((p, i) => {
    if (shuffled[i]) p.timeline = [shuffled[i]];
  });

  room.deck = shuffled.slice(playerList.length);
  room.currentSongIndex = 0;
  room.currentPlayerIndex = 0;
  room.round = 1;
  room.rounds = Math.max(1, Math.min(rounds, 20));
  room.audioMode = audioMode;
  room.status = 'playing';
  room.lastCorrectSong = new Map();
  return { ok: true };
}

export function placeSong(room: Room, playerId: string, position: number): PlaceResult {
  if (room.status !== 'playing') return { ok: false, error: 'Spiel läuft nicht.' };

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

  room.currentSongIndex++;
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.playerOrder.length;
  if (room.currentPlayerIndex === 0) room.round++;

  const gameOver =
    room.currentSongIndex >= room.deck.length ||
    (room.currentPlayerIndex === 0 && room.round > room.rounds);

  if (gameOver) room.status = 'finished';
  return { ok: true, correct, song, gameOver, lastPlayerId: playerId };
}

export function skipDisconnectedPlayer(room: Room): SimpleResult {
  if (!room.paused || !room.pausedForPlayerId) {
    return { ok: false, error: 'Spiel ist nicht pausiert.' };
  }

  const skippedId = room.pausedForPlayerId;
  room.playerOrder = room.playerOrder.filter((id) => id !== skippedId);

  if (room.currentPlayerIndex >= room.playerOrder.length) {
    room.currentPlayerIndex = 0;
  }
  if (room.playerOrder.length > 0 && room.currentPlayerIndex === 0) {
    room.round++;
  }

  room.paused = false;
  room.pausedForPlayerId = null;

  const gameOver =
    room.playerOrder.length <= 1 ||
    room.currentSongIndex >= room.deck.length ||
    (room.currentPlayerIndex === 0 && room.round > room.rounds);

  if (gameOver) room.status = 'finished';
  return { ok: true };
}

export function returnToLobby(room: Room): void {
  room.status = 'lobby';
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
  room.paused = false;
  room.pausedForPlayerId = null;
}
