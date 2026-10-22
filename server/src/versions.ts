/**
 * Which version of a song a Spotify or iTunes title stands for. The game wants the original
 * recording: a remix, live take or re-recording has another sound and another year.
 */

/** Lowercase letters/digits of any script, accents stripped ("Beyoncé" → "beyonce"). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

const BRACKETS = /[([][^)\]]*[)\]]/g;

/** Title without "(Remastered 2011)", "[Live]" or " - Radio Edit" style suffixes. */
export function baseTitle(s: string): string {
  return normalize(s.replace(BRACKETS, '').split(' - ')[0]);
}

/** Two titles by one artist with the same key are the same song (other release, other version). */
export function songKey(artist: string, title: string): string {
  return `${normalize(artist)}|${baseTitle(title)}`;
}

/**
 * What a title says about its version: the brackets and whatever follows " - ". Only there, so
 * "Live and Let Die" or "Cover Me" stay originals.
 */
function versionPart(title: string): string {
  const dash = title.indexOf(' - ');
  return [...(title.match(BRACKETS) ?? []), dash >= 0 ? title.slice(dash + 3) : ''].join(' ');
}

// Another recording than the original. "Radio Edit", "Single Version" or "feat. …" are fine.
const VARIANT =
  /\b(?:re-?mix(?:es|ed)?|(?<!original )mix|live|unplugged|acoustic|instrumental|a ?capp?ella|karaoke|re-?record(?:ed|ing)?|taylor['’]?s version|demo|slowed|sped[ -]up|screwed|chopped|nightcore|extended|club|dub|symphonic|orchestral|piano|cover|tribute|originally performed|lullaby)\b/i;
// Albums that only hold such recordings, even when the track title doesn't say so.
const VARIANT_ALBUM =
  /\b(?:karaoke|screwed|chopped|tribute|lullab(?:y|ies)|remix(?:es|ed)|re-?recorded|taylor['’]?s version|unplugged|instrumentals)\b/i;
// No \b at the end: "Remastered2009", "Remasterizado" and "Re-Mastered" count too.
const REMASTER = /\bre-?master/i;

/**
 * - `original`: the song as first released.
 * - `remaster`: the same recording, re-released (often with the re-release's year).
 * - `variant`: another recording — remix, live, acoustic, re-recorded, karaoke …
 */
export type Version = 'original' | 'remaster' | 'variant';

export function versionOf(title: string, album = ''): Version {
  if (VARIANT.test(versionPart(title)) || VARIANT.test(versionPart(album)) || VARIANT_ALBUM.test(album)) {
    return 'variant';
  }
  if (REMASTER.test(title) || REMASTER.test(versionPart(album))) return 'remaster';
  return 'original';
}
