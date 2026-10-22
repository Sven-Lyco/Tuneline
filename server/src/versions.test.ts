import { describe, expect, it } from 'vitest';
import { baseTitle, isCompilationAlbum, normalize, songKey, versionOf } from './versions.js';

describe('versionOf', () => {
  it('treats plain titles, edits and features as the original', () => {
    for (const title of [
      'Suga Suga',
      'Suga Suga (feat. Frankie J)',
      'Shout - Radio Edit',
      'Help! - Single Version',
      'Levels - Original Mix',
      'What Is Love - 7" Mix',
      'Mr. Vain - Radio Mix',
      'Let It Go - From "Frozen"',
      'Live and Let Die',
      'Cover Me',
      'Dub Be Good to Me',
    ]) {
      expect(versionOf(title), title).toBe('original');
    }
  });

  it('recognises other recordings in the title', () => {
    for (const title of [
      'Cheerleader - Felix Jaehn Remix Radio Edit',
      'Take On Me (1985 12" Mix)',
      'What Is Love (Club Mix)',
      'Come Together - 2019 Mix',
      'Bohemian Rhapsody - Live at Wembley Stadium',
      'Love Story (Taylor’s Version)',
      "Love Story (Taylor's Version)",
      'Suga Suga (Instrumental)',
      'Suga Suga (A Cappella)',
      'Africa - Re-Recorded',
      'Creep - Acoustic',
      'Blinding Lights (Sped Up)',
      'Take on Me (Symphonic Version)',
    ]) {
      expect(versionOf(title), title).toBe('variant');
    }
  });

  it('recognises albums that only hold other recordings', () => {
    expect(versionOf('Suga Suga', 'Screwed & Chopped')).toBe('variant');
    expect(versionOf('Bohemian Rhapsody', 'Hungarian Rhapsody (Live In Budapest / 1986)')).toBe('variant');
    expect(versionOf('About a Girl', 'MTV Unplugged in New York')).toBe('variant');
    expect(versionOf('Violet', 'Live Through This')).toBe('original');
    expect(versionOf('Bohemian Rhapsody', 'A Night At The Opera (Deluxe Edition)')).toBe('original');
  });

  it('tells remasters apart, however they are spelled', () => {
    for (const [title, album] of [
      ['Old Song - 2011 Remaster', ''],
      ['Take On Me (2015 Remastered Version)', ''],
      ['Come Together - Remastered2009', ''],
      ['Gracias a la Vida - Remasterizado', ''],
      ['Paint It Black - Re-Mastered', ''],
      ['Take On Me', 'Hunting High & Low (Remastered)'],
    ]) {
      expect(versionOf(title, album), title).toBe('remaster');
    }
  });
});

describe('isCompilationAlbum', () => {
  it('spots best-ofs and reissues by their name (real iTunes album names)', () => {
    for (const album of [
      'Anthology',
      'Gold: Commodores',
      'The Definitive Collection: The Commodores',
      "Motown: The Complete No. 1's",
      'Elv1s: 30 #1 Hits',
      'Pop Music: The Modern Era 1976-1999',
      'Tutti Frutti - Best of Peter Kraus',
      'Seine großen Erfolge',
      'A Night At The Opera (Deluxe Edition)',
    ]) {
      expect(isCompilationAlbum(album), album).toBe(true);
    }
    for (const album of ['Nightshift', 'Thriller', 'From Elvis In Memphis', 'Rumours', 'Hunting High and Low', 'Fearless']) {
      expect(isCompilationAlbum(album), album).toBe(false);
    }
  });
});

describe('song identity', () => {
  it('ignores accents, case and version suffixes', () => {
    expect(normalize('Beyoncé')).toBe('beyonce');
    expect(baseTitle('Suga Suga (feat. Frankie J)')).toBe('sugasuga');
    expect(songKey('Baby Bash', 'Suga Suga - Radio Edit')).toBe(songKey('BABY BASH', 'Suga Suga'));
    expect(songKey('Baby Bash', 'Suga Suga')).not.toBe(songKey('Frankie J', 'Suga Suga'));
  });
});
