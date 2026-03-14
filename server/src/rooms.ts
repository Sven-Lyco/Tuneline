import type {
  SongFull,
  SongMeta,
  RoomPlayer,
  LobbyState,
  GameStateForClient,
  AudioMode,
} from '@tuneline/shared';
import { generateCode } from './utils.js';
import {
  ROOM_CODE_CHARS,
  TOKEN_CHARS,
  ROOM_TTL_MS,
  MAX_PLAYERS,
  MAX_NAME_LENGTH,
  MAX_ROOMS,
  isValidAudioMode,
  type InternalPlayer,
  type Room,
  type CreateRoomResult,
  type JoinResult,
  type SimpleResult,
  type PlaceResult,
  type KickResult,
} from './types.js';
import * as game from './game.js';

export class RoomManager {
  private rooms = new Map<string, Room>();
  private socketToRoom = new Map<string, string>(); // socketId → roomCode

  // ── Private helpers ──────────────────────────────────────────────────────

  private newCode(): string {
    let code: string;
    do {
      code = generateCode(6, ROOM_CODE_CHARS);
    } while (this.rooms.has(code));
    return code;
  }

  private newToken(): string {
    return generateCode(48, TOKEN_CHARS);
  }

  private newPlayerId(): string {
    return generateCode(16, TOKEN_CHARS);
  }

  private scheduleCleanup(room: Room): void {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = setTimeout(() => this.rooms.delete(room.code), ROOM_TTL_MS);
  }

  /** Resolves socketId to the InternalPlayer within a room, or null. */
  private getPlayer(socketId: string, room: Room): InternalPlayer | null {
    const playerId = room.socketToPlayer.get(socketId);
    return playerId ? (room.players.get(playerId) ?? null) : null;
  }

  private toPublicPlayers(room: Room): RoomPlayer[] {
    return room.playerOrder
      .map((id) => room.players.get(id))
      .filter((p): p is InternalPlayer => p !== undefined)
      .map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isConnected: p.isConnected,
        score: p.score,
        timeline: p.timeline,
      }));
  }

  getPlayerForSocket(socketId: string): { id: string; name: string } | null {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const player = this.getPlayer(socketId, room);
    if (!player) return null;
    return { id: player.id, name: player.name };
  }

  // ── Room lifecycle ───────────────────────────────────────────────────────

  createRoom(
    socketId: string,
    hostName: string,
    rounds: number,
    audioMode: AudioMode,
  ): CreateRoomResult {
    if (this.rooms.size >= MAX_ROOMS) return { ok: false, error: 'Server ist ausgelastet. Bitte später erneut versuchen.' };
    const validMode: AudioMode = isValidAudioMode(audioMode) ? audioMode : 'all';
    const code = this.newCode();
    const playerId = this.newPlayerId();
    const token = this.newToken();

    const host: InternalPlayer = {
      id: playerId,
      name: hostName.trim().slice(0, MAX_NAME_LENGTH),
      isHost: true,
      isConnected: true,
      token,
      socketId,
      score: 0,
      timeline: [],
    };

    const room: Room = {
      code,
      players: new Map([[playerId, host]]),
      socketToPlayer: new Map([[socketId, playerId]]),
      playerOrder: [playerId],
      status: 'lobby',
      deck: [],
      currentSongIndex: 0,
      currentPlayerIndex: 0,
      round: 1,
      rounds: Math.max(1, Math.min(rounds, 20)),
      audioMode: validMode,
      lastCorrectSong: new Map(),
      paused: false,
      pausedForPlayerId: null,
      cleanupTimer: setTimeout(() => {}, 0),
    };

    this.scheduleCleanup(room);
    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);
    return { ok: true, roomCode: code, playerId, playerToken: token };
  }

  joinRoom(
    socketId: string,
    roomCode: string,
    playerName: string,
    playerToken?: string,
  ): JoinResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };

    // Reconnect via token — must be checked BEFORE status guard
    if (playerToken) {
      for (const [id, player] of room.players) {
        if (player.token === playerToken) {
          player.socketId = socketId;
          player.isConnected = true;
          room.socketToPlayer.set(socketId, id);
          this.socketToRoom.set(socketId, roomCode);
          if (room.paused && room.pausedForPlayerId === id) {
            room.paused = false;
            room.pausedForPlayerId = null;
          }
          return { ok: true, playerId: id, playerToken };
        }
      }
    }

    if (room.status !== 'lobby') return { ok: false, error: 'Das Spiel läuft bereits.' };
    if (room.players.size >= MAX_PLAYERS) return { ok: false, error: 'Der Raum ist voll.' };

    const playerId = this.newPlayerId();
    const token = this.newToken();

    const player: InternalPlayer = {
      id: playerId,
      name: playerName.trim().slice(0, MAX_NAME_LENGTH),
      isHost: false,
      isConnected: true,
      token,
      socketId,
      score: 0,
      timeline: [],
    };

    room.players.set(playerId, player);
    room.socketToPlayer.set(socketId, playerId);
    room.playerOrder.push(playerId);
    this.socketToRoom.set(socketId, roomCode);
    this.scheduleCleanup(room);
    return { ok: true, playerId, playerToken: token };
  }

  kickPlayer(socketId: string, roomCode: string, targetPlayerId: string): KickResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };

    const player = this.getPlayer(socketId, room);
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann Spieler entfernen.' };
    if (targetPlayerId === player.id)
      return { ok: false, error: 'Der Host kann sich nicht selbst entfernen.' };

    const target = room.players.get(targetPlayerId);
    if (!target) return { ok: false, error: 'Spieler nicht gefunden.' };

    const kickedSocketId = target.socketId;
    room.socketToPlayer.delete(target.socketId);
    this.socketToRoom.delete(target.socketId);
    room.players.delete(targetPlayerId);
    room.playerOrder = room.playerOrder.filter((id) => id !== targetPlayerId);

    if (room.currentPlayerIndex >= room.playerOrder.length) {
      room.currentPlayerIndex = 0;
    }
    return { ok: true, kickedSocketId };
  }

  handleDisconnect(socketId: string): {
    roomCode: string;
    playerId: string;
    playerName: string;
    isHost: boolean;
    wasPlaying: boolean;
    shouldPause: boolean;
  } | null {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;
    this.socketToRoom.delete(socketId);

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) return null;

    const player = room.players.get(playerId);
    if (!player) return null;

    player.isConnected = false;
    room.socketToPlayer.delete(socketId);

    const wasPlaying = room.status === 'playing';
    let shouldPause = false;

    if (wasPlaying && !room.paused) {
      room.paused = true;
      room.pausedForPlayerId = playerId;
      shouldPause = true;
    }

    return { roomCode, playerId, playerName: player.name, isHost: player.isHost, wasPlaying, shouldPause };
  }

  // ── Game actions (auth check here, logic delegated to game.ts) ───────────

  startGame(
    socketId: string,
    roomCode: string,
    songs: SongFull[],
    rounds: number,
    audioMode: AudioMode,
  ): SimpleResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    const player = this.getPlayer(socketId, room);
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann das Spiel starten.' };
    return game.startGame(room, songs, rounds, audioMode);
  }

  placeSong(socketId: string, roomCode: string, position: number): PlaceResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) return { ok: false, error: 'Nicht autorisiert.' };
    return game.placeSong(room, playerId, position);
  }

  updateSettings(
    socketId: string,
    roomCode: string,
    rounds: number,
    audioMode: AudioMode,
  ): SimpleResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    const player = this.getPlayer(socketId, room);
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann Einstellungen ändern.' };
    if (room.status !== 'lobby')
      return { ok: false, error: 'Einstellungen können nur in der Lobby geändert werden.' };
    if (!isValidAudioMode(audioMode)) return { ok: false, error: 'Ungültiger Audio-Modus.' };
    room.rounds = Math.max(1, Math.min(rounds, 20));
    room.audioMode = audioMode;
    return { ok: true };
  }

  returnToLobby(socketId: string, roomCode: string): SimpleResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    const player = this.getPlayer(socketId, room);
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann das Spiel neu starten.' };
    game.returnToLobby(room);
    return { ok: true };
  }

  skipDisconnectedPlayer(socketId: string, roomCode: string): SimpleResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    const player = this.getPlayer(socketId, room);
    if (!player?.isHost)
      return { ok: false, error: 'Nur der Host kann den Spieler überspringen.' };
    return game.skipDisconnectedPlayer(room);
  }

  finishGame(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) game.finishGame(room);
  }

  // ── State queries ────────────────────────────────────────────────────────

  getRoomCodeForSocket(socketId: string): string | null {
    return this.socketToRoom.get(socketId) ?? null;
  }

  getLobbyState(roomCode: string): LobbyState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return {
      roomCode: room.code,
      players: this.toPublicPlayers(room),
      rounds: room.rounds,
      audioMode: room.audioMode,
      status: room.status,
    };
  }

  getGameState(roomCode: string): GameStateForClient | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return {
      players: this.toPublicPlayers(room),
      currentPlayerId: room.playerOrder[room.currentPlayerIndex] ?? '',
      round: room.round,
      rounds: room.rounds,
      audioMode: room.audioMode,
      deckRemaining: room.deck.length - room.currentSongIndex,
    };
  }

  getCurrentSongPreview(roomCode: string): SongMeta | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const song = room.deck[room.currentSongIndex];
    if (!song) return null;
    // Strip year — must not be sent to active player before placement
    const { year: _year, ...preview } = song;
    return preview;
  }

  getPlayers(roomCode: string): RoomPlayer[] | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return this.toPublicPlayers(room);
  }

  getLastCorrectSong(roomCode: string, playerId: string): SongFull | null {
    return this.rooms.get(roomCode)?.lastCorrectSong.get(playerId) ?? null;
  }
}
