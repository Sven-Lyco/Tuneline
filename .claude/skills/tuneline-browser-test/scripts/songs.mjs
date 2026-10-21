#!/usr/bin/env node
// Prints Tuneline test songs as SongFull[] JSON, fetched from the iTunes Search API.
// They pass the server's isValidSong() (preview on audio-ssl.itunes.apple.com, cover null),
// so start_game works without a Spotify login, and the previews really play.
//
// Usage: node songs.mjs [term=queen] [count=12] > songs.json
// iTunes allows roughly 20 searches per minute; reuse a saved file instead of refetching.

const [term = 'queen', countArg = '12'] = process.argv.slice(2);
const count = Math.max(1, Math.min(Number(countArg) || 12, 100));

const params = new URLSearchParams({ term, entity: 'song', limit: String(Math.min(count * 3, 200)) });
const res = await fetch(`https://itunes.apple.com/search?${params}`);
if (!res.ok) {
  console.error(`iTunes answered ${res.status} — probably the rate limit, wait a minute.`);
  process.exit(1);
}

const { results } = await res.json();
const seen = new Set();
const songs = [];
for (const r of results) {
  if (!r.previewUrl?.startsWith('https://audio-ssl.itunes.apple.com/') || !r.releaseDate) continue;
  const key = `${r.artistName}|${r.trackName}`.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  songs.push({
    id: `itunes-${r.trackId}`,
    title: r.trackName.slice(0, 200),
    artist: r.artistName.slice(0, 200),
    cover: null,
    year: Number(r.releaseDate.slice(0, 4)),
    preview: r.previewUrl,
  });
  if (songs.length >= count) break;
}

if (songs.length < count) console.error(`Only ${songs.length} songs found for "${term}".`);
process.stdout.write(JSON.stringify(songs));
