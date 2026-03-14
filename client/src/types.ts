export type { SpotifyPlaylist } from '@tuneline/shared';

export type Screen =
  | 'login'
  | 'join'
  | 'playlists'
  | 'menu'
  | 'loading'
  | 'lobby'
  | 'game'
  | 'result'
  | 'help';

export type Feedback = 'ok' | 'no' | null;

export interface GameResult {
  players: import('@tuneline/shared').RoomPlayer[];
  lastSong: import('@tuneline/shared').SongFull | null;
  lastCorrect: boolean;
  lastPlayerId: string;
  winnerLastSong: import('@tuneline/shared').SongFull | null;
}
