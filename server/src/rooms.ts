import type {
  SongFull,
  SongMeta,
  RoomPlayer,
  LobbyState,
  GameStateForClient,
  AudioMode,
  RoomStatus,
} from '@tuneline/shared';
import { shuffle, generateCode } from './utils.js';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_PLAYERS = 10;
const MAX_NAME_LENGTH = 30;

interface InternalPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
  token: string;
  socketId: string;
  score: number;
  timeline: SongFull[];
}

interface Room {
  code: string;
  players: Map<string, InternalPlayer>; // playerId → player
  socketToPlayer: Map<string, string>;  // socketId → playerId
  playerOrder: string[];                // ordered player ids
  status: RoomStatus;
  deck: SongFull[];
  currentSongIndex: number;
  currentPlayerIndex: number;
  round: number;
  rounds: number;
  audioMode: AudioMode;
  cleanupTimer: ReturnType<typeof setTimeout>;
}

type JoinResult =
  | { ok: true; playerId: string; playerToken: string }
  | { ok: false; error: string };

type StartResult = { ok: true } | { ok: false; error: string };

type PlaceResult =
  | { ok: false; error: string }
  | { ok: true; correct: boolean; song: SongFull; gameOver: boolean; lastPlayerId: string };

type KickResult =
  | { ok: true; kickedSocketId: string | null }
  | { ok: false; error: string };

function isCorrectPlacement(
  timeline: SongFull[],
  song: SongFull,
  position: number,
): boolean {
  const left = timeline[position - 1] ?? null;
  const right = timeline[position] ?? null;
  return (
    (left === null || left.year <= song.year) &&
    (right === null || right.year >= song.year)
  );
}

export class RoomManager {
  private rooms = new Map<string, Room>();

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
    room.cleanupTimer = setTimeout(() => {
      this.rooms.delete(room.code);
    }, ROOM_TTL_MS);
  }

  createRoom(socketId: string, hostName: string, rounds: number, audioMode: AudioMode): { roomCode: string; playerId: string; playerToken: string } {
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
      audioMode,
      cleanupTimer: setTimeout(() => {}, 0),
    };

    this.scheduleCleanup(room);
    this.rooms.set(code, room);
    return { roomCode: code, playerId, playerToken: token };
  }

  joinRoom(
    socketId: string,
    roomCode: string,
    playerName: string,
    playerToken?: string,
  ): JoinResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    if (room.status !== 'lobby') return { ok: false, error: 'Das Spiel läuft bereits.' };
    if (room.players.size >= MAX_PLAYERS) return { ok: false, error: 'Der Raum ist voll.' };

    // Reconnect via token
    if (playerToken) {
      for (const [id, player] of room.players) {
        if (player.token === playerToken) {
          player.socketId = socketId;
          player.isConnected = true;
          room.socketToPlayer.set(socketId, id);
          return { ok: true, playerId: id, playerToken };
        }
      }
    }

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
    this.scheduleCleanup(room);
    return { ok: true, playerId, playerToken: token };
  }

  startGame(
    socketId: string,
    roomCode: string,
    songs: SongFull[],
    rounds: number,
    audioMode: AudioMode,
  ): StartResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };

    const playerId = room.socketToPlayer.get(socketId);
    const player = playerId ? room.players.get(playerId) : null;
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann das Spiel starten.' };

    if (!Array.isArray(songs) || songs.length < 2) {
      return { ok: false, error: 'Zu wenige Songs.' };
    }

    // Validate song structure
    for (const song of songs) {
      if (
        typeof song.id !== 'string' ||
        typeof song.title !== 'string' ||
        typeof song.artist !== 'string' ||
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

    // Give each player one starter song in their timeline (mirrors local game behaviour)
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

    return { ok: true };
  }

  placeSong(socketId: string, roomCode: string, position: number): PlaceResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };
    if (room.status !== 'playing') return { ok: false, error: 'Spiel läuft nicht.' };

    const playerId = room.socketToPlayer.get(socketId);
    if (!playerId) return { ok: false, error: 'Nicht autorisiert.' };

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
    }

    room.currentSongIndex++;
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.playerOrder.length;

    if (room.currentPlayerIndex === 0) {
      room.round++;
    }

    const gameOver =
      room.currentSongIndex >= room.deck.length ||
      (room.currentPlayerIndex === 0 && room.round > room.rounds);

    if (gameOver) {
      room.status = 'finished';
    }

    return { ok: true, correct, song, gameOver, lastPlayerId: playerId };
  }

  updateSettings(
    socketId: string,
    roomCode: string,
    rounds: number,
    audioMode: AudioMode,
  ): { ok: true } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };

    const playerId = room.socketToPlayer.get(socketId);
    const player = playerId ? room.players.get(playerId) : null;
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann Einstellungen ändern.' };
    if (room.status !== 'lobby') return { ok: false, error: 'Einstellungen können nur in der Lobby geändert werden.' };

    room.rounds = Math.max(1, Math.min(rounds, 20));
    room.audioMode = audioMode;
    return { ok: true };
  }

  returnToLobby(socketId: string, roomCode: string): { ok: true } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };

    const playerId = room.socketToPlayer.get(socketId);
    const player = playerId ? room.players.get(playerId) : null;
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann das Spiel neu starten.' };

    room.status = 'lobby';
    room.deck = [];
    room.currentSongIndex = 0;
    room.currentPlayerIndex = 0;
    room.round = 1;
    for (const p of room.players.values()) {
      p.timeline = [];
      p.score = 0;
    }
    return { ok: true };
  }

  kickPlayer(socketId: string, roomCode: string, targetPlayerId: string): KickResult {
    const room = this.rooms.get(roomCode);
    if (!room) return { ok: false, error: 'Raum nicht gefunden.' };

    const playerId = room.socketToPlayer.get(socketId);
    const player = playerId ? room.players.get(playerId) : null;
    if (!player?.isHost) return { ok: false, error: 'Nur der Host kann Spieler entfernen.' };
    if (targetPlayerId === playerId) return { ok: false, error: 'Der Host kann sich nicht selbst entfernen.' };

    const target = room.players.get(targetPlayerId);
    if (!target) return { ok: false, error: 'Spieler nicht gefunden.' };

    const kickedSocketId = target.socketId;
    room.socketToPlayer.delete(target.socketId);
    room.players.delete(targetPlayerId);
    room.playerOrder = room.playerOrder.filter((id) => id !== targetPlayerId);

    if (room.currentPlayerIndex >= room.playerOrder.length) {
      room.currentPlayerIndex = 0;
    }

    return { ok: true, kickedSocketId };
  }

  handleDisconnect(socketId: string): { roomCode: string; playerId: string } | null {
    for (const room of this.rooms.values()) {
      const playerId = room.socketToPlayer.get(socketId);
      if (!playerId) continue;
      const player = room.players.get(playerId);
      if (player) player.isConnected = false;
      room.socketToPlayer.delete(socketId);
      return { roomCode: room.code, playerId };
    }
    return null;
  }

  getRoomCodeForSocket(socketId: string): string | null {
    for (const room of this.rooms.values()) {
      if (room.socketToPlayer.has(socketId)) return room.code;
    }
    return null;
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
}
