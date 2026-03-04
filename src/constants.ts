import type { Genre, GenreMeta, Song } from './types';

export const PLAYER_COLORS = ['#ff2d78', '#06d6a0', '#a855f7', '#fbbf24', '#38bdf8', '#f97316'];

export const GENRE_META: Record<Genre, GenreMeta> = {
  pop: { label: 'Pop', icon: '🎤', color: '#ff2d78' },
  rock: { label: 'Rock', icon: '🎸', color: '#ff6b35' },
  hiphop: { label: 'Hip-Hop', icon: '🎧', color: '#a855f7' },
  electronic: { label: 'Electronic', icon: '🎹', color: '#06d6a0' },
  deutsch: { label: 'Deutsch', icon: '🇩🇪', color: '#fbbf24' },
};

export const GENRE_QUERIES: Record<Genre, string[]> = {
  pop: [
    'top hits 1970s', 'top hits 1980s', 'top hits 1990s', 'greatest hits 2000s pop',
    'best pop 2010s', 'pop hits 2020', 'madonna', 'michael jackson thriller',
    'whitney houston', 'britney spears', 'lady gaga', 'adele', 'ed sheeran',
    'taylor swift', 'beyonce', 'rihanna hits', 'coldplay', 'bruno mars',
    'harry styles', 'dua lipa', 'abba gold', 'bee gees', 'elton john hits',
    'phil collins hits', 'george michael', 'prince hits', 'fleetwood mac',
  ],
  rock: [
    'classic rock greatest hits', 'rock 70s', 'rock 80s', 'rock 90s',
    'led zeppelin', 'queen greatest hits', 'pink floyd', 'ac dc',
    'guns n roses', 'nirvana', 'metallica', 'linkin park', 'foo fighters',
    'red hot chili peppers', 'u2', 'oasis', 'radiohead', 'the killers',
    'arctic monkeys', 'imagine dragons', 'deep purple', 'black sabbath',
    'the rolling stones', 'aerosmith', 'bon jovi',
  ],
  hiphop: [
    'hip hop classics', 'rap hits 90s', 'rap 2000s', 'hip hop 2010s',
    'eminem', 'drake hits', 'kanye west', 'jay z', 'kendrick lamar',
    'notorious big', 'tupac', '50 cent', 'snoop dogg', 'outkast',
    'travis scott', 'lil nas x', 'post malone', 'cardi b',
    'nicki minaj', 'j cole', 'nas illmatic', 'wu tang clan',
  ],
  electronic: [
    'electronic classics', 'daft punk', 'avicii', 'david guetta hits',
    'deadmau5', 'skrillex', 'calvin harris', 'tiesto', 'martin garrix',
    'alan walker', 'marshmello', 'zedd', 'swedish house mafia',
    'the chemical brothers', 'fatboy slim', 'prodigy firestarter',
    'depeche mode', 'new order', 'kraftwerk', 'moby play',
  ],
  deutsch: [
    'deutsche hits 80er', 'deutsche hits 90er', 'deutsche hits 2000er',
    'rammstein', 'nena 99 luftballons', 'tokio hotel', 'helene fischer',
    'apache 207', 'capital bra', 'sido', 'peter fox',
    'die toten hosen', 'die aerzte', 'cro', 'mark forster',
    'tim bendzko', 'alligatoah', 'kontra k', 'bonez mc',
    'herbert groenemeyer', 'falco', 'kraftwerk', 'scorpions',
  ],
};

export const FALLBACK_SONGS: Song[] = [
  { id: 1, title: 'Billie Jean', artist: 'Michael Jackson', year: 1982, preview: null, cover: null },
  { id: 2, title: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, preview: null, cover: null },
  { id: 3, title: 'Smells Like Teen Spirit', artist: 'Nirvana', year: 1991, preview: null, cover: null },
  { id: 4, title: 'Hey Ya!', artist: 'OutKast', year: 2003, preview: null, cover: null },
  { id: 5, title: 'Blinding Lights', artist: 'The Weeknd', year: 2019, preview: null, cover: null },
  { id: 6, title: 'Shape of You', artist: 'Ed Sheeran', year: 2017, preview: null, cover: null },
  { id: 7, title: 'Hotel California', artist: 'Eagles', year: 1977, preview: null, cover: null },
  { id: 8, title: 'Lose Yourself', artist: 'Eminem', year: 2002, preview: null, cover: null },
  { id: 9, title: 'Get Lucky', artist: 'Daft Punk', year: 2013, preview: null, cover: null },
  { id: 10, title: '99 Luftballons', artist: 'Nena', year: 1983, preview: null, cover: null },
  { id: 11, title: 'Rolling in the Deep', artist: 'Adele', year: 2010, preview: null, cover: null },
  { id: 12, title: 'Wonderwall', artist: 'Oasis', year: 1995, preview: null, cover: null },
  { id: 13, title: 'Crazy in Love', artist: 'Beyoncé', year: 2003, preview: null, cover: null },
  { id: 14, title: 'Enter Sandman', artist: 'Metallica', year: 1991, preview: null, cover: null },
  { id: 15, title: 'Levels', artist: 'Avicii', year: 2011, preview: null, cover: null },
  { id: 16, title: 'Du Hast', artist: 'Rammstein', year: 1997, preview: null, cover: null },
  { id: 17, title: 'Viva la Vida', artist: 'Coldplay', year: 2008, preview: null, cover: null },
  { id: 18, title: 'Poker Face', artist: 'Lady Gaga', year: 2008, preview: null, cover: null },
  { id: 19, title: 'Seven Nation Army', artist: 'White Stripes', year: 2003, preview: null, cover: null },
  { id: 20, title: 'Humble', artist: 'Kendrick Lamar', year: 2017, preview: null, cover: null },
];
