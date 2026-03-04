export interface Song {
  id: number;
  title: string;
  artist: string;
  year: number;
  preview: string | null;
  cover: string | null;
}

export interface Player {
  name: string;
}

export type Screen = 'menu' | 'loading' | 'game' | 'result';
export type Feedback = 'ok' | 'no' | null;
export type Genre = 'pop' | 'rock' | 'hiphop' | 'electronic' | 'deutsch';

export interface GenreMeta {
  label: string;
  icon: string;
  color: string;
}
