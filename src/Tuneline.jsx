import { useState, useEffect, useCallback, useRef } from "react";

// ══════════════════════════════════════════════════════════════
// ── DEEZER API LAYER ─────────────────────────────────────────
// Loads songs dynamically from Deezer: charts, search, genre
// Each song gets: title, artist, year (from album release_date),
// preview URL (30s mp3), and album cover art.
// ══════════════════════════════════════════════════════════════
const PROXY = "https://corsproxy.io/?";

async function deezerFetch(path) {
  try {
    const url = `${PROXY}${encodeURIComponent(`https://api.deezer.com${path}`)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.warn("Deezer API error:", e);
    return null;
  }
}

// Extract year from Deezer's release_date format "YYYY-MM-DD"
function extractYear(dateStr) {
  if (!dateStr) return null;
  const y = parseInt(dateStr.split("-")[0], 10);
  return y > 1900 && y < 2030 ? y : null;
}

// Convert Deezer track object to our song format
function trackToSong(t) {
  if (!t || !t.preview || !t.title) return null;
  const year = extractYear(t.album?.release_date);
  if (!year) return null;
  return {
    id: t.id,
    title: t.title_short || t.title,
    artist: t.artist?.name || "Unknown",
    year,
    preview: t.preview,
    cover: t.album?.cover_medium || t.album?.cover || null,
  };
}

// ── Genre-based song loading strategies ───────────────────────
// We use curated search queries per genre/decade to get a nice
// mix of well-known songs from different eras.

const GENRE_QUERIES = {
  pop: [
    "top hits 1970s", "top hits 1980s", "top hits 1990s", "greatest hits 2000s pop",
    "best pop 2010s", "pop hits 2020", "madonna", "michael jackson thriller",
    "whitney houston", "britney spears", "lady gaga", "adele", "ed sheeran",
    "taylor swift", "beyonce", "rihanna hits", "coldplay", "bruno mars",
    "harry styles", "dua lipa", "abba gold", "bee gees", "elton john hits",
    "phil collins hits", "george michael", "prince hits", "fleetwood mac",
  ],
  rock: [
    "classic rock greatest hits", "rock 70s", "rock 80s", "rock 90s",
    "led zeppelin", "queen greatest hits", "pink floyd", "ac dc",
    "guns n roses", "nirvana", "metallica", "linkin park", "foo fighters",
    "red hot chili peppers", "u2", "oasis", "radiohead", "the killers",
    "arctic monkeys", "imagine dragons", "deep purple", "black sabbath",
    "the rolling stones", "aerosmith", "bon jovi",
  ],
  hiphop: [
    "hip hop classics", "rap hits 90s", "rap 2000s", "hip hop 2010s",
    "eminem", "drake hits", "kanye west", "jay z", "kendrick lamar",
    "notorious big", "tupac", "50 cent", "snoop dogg", "outkast",
    "travis scott", "lil nas x", "post malone", "cardi b",
    "nicki minaj", "j cole", "nas illmatic", "wu tang clan",
  ],
  electronic: [
    "electronic classics", "daft punk", "avicii", "david guetta hits",
    "deadmau5", "skrillex", "calvin harris", "tiesto", "martin garrix",
    "alan walker", "marshmello", "zedd", "swedish house mafia",
    "the chemical brothers", "fatboy slim", "prodigy firestarter",
    "depeche mode", "new order", "kraftwerk", "moby play",
  ],
  deutsch: [
    "deutsche hits 80er", "deutsche hits 90er", "deutsche hits 2000er",
    "rammstein", "nena 99 luftballons", "tokio hotel", "helene fischer",
    "apache 207", "capital bra", "sido", "peter fox",
    "die toten hosen", "die aerzte", "cro", "mark forster",
    "tim bendzko", "alligatoah", "kontra k", "bonez mc",
    "herbert groenemeyer", "falco", "kraftwerk", "scorpions",
  ],
};

// Load songs for given genres via Deezer search
async function loadSongsForGenres(genres, targetCount = 80) {
  const allSongs = [];
  const seenIds = new Set();

  // Collect all queries for selected genres, shuffle them
  let queries = genres.flatMap(g => GENRE_QUERIES[g] || []);
  queries = shuffle(queries);

  // Fetch in batches until we have enough
  for (const q of queries) {
    if (allSongs.length >= targetCount) break;
    const data = await deezerFetch(`/search?q=${encodeURIComponent(q)}&limit=25`);
    if (!data?.data) continue;

    for (const track of data.data) {
      if (seenIds.has(track.id)) continue;
      // We need the album release_date which isn't in search results
      // Use the track's album release_date if available, otherwise fetch album
      let song = trackToSong(track);
      if (!song && track.album?.id) {
        // Try to get release date from album endpoint
        const albumData = await deezerFetch(`/album/${track.album.id}`);
        if (albumData?.release_date) {
          track.album.release_date = albumData.release_date;
          song = trackToSong(track);
        }
      }
      if (song) {
        seenIds.add(track.id);
        allSongs.push(song);
      }
    }
  }

  return shuffle(allSongs);
}

// ── Fallback songs if API fails ───────────────────────────────
const FALLBACK_SONGS = [
  { id: 1, title: "Billie Jean", artist: "Michael Jackson", year: 1982, preview: null, cover: null },
  { id: 2, title: "Bohemian Rhapsody", artist: "Queen", year: 1975, preview: null, cover: null },
  { id: 3, title: "Smells Like Teen Spirit", artist: "Nirvana", year: 1991, preview: null, cover: null },
  { id: 4, title: "Hey Ya!", artist: "OutKast", year: 2003, preview: null, cover: null },
  { id: 5, title: "Blinding Lights", artist: "The Weeknd", year: 2019, preview: null, cover: null },
  { id: 6, title: "Shape of You", artist: "Ed Sheeran", year: 2017, preview: null, cover: null },
  { id: 7, title: "Hotel California", artist: "Eagles", year: 1977, preview: null, cover: null },
  { id: 8, title: "Lose Yourself", artist: "Eminem", year: 2002, preview: null, cover: null },
  { id: 9, title: "Get Lucky", artist: "Daft Punk", year: 2013, preview: null, cover: null },
  { id: 10, title: "99 Luftballons", artist: "Nena", year: 1983, preview: null, cover: null },
  { id: 11, title: "Rolling in the Deep", artist: "Adele", year: 2010, preview: null, cover: null },
  { id: 12, title: "Wonderwall", artist: "Oasis", year: 1995, preview: null, cover: null },
  { id: 13, title: "Crazy in Love", artist: "Beyoncé", year: 2003, preview: null, cover: null },
  { id: 14, title: "Enter Sandman", artist: "Metallica", year: 1991, preview: null, cover: null },
  { id: 15, title: "Levels", artist: "Avicii", year: 2011, preview: null, cover: null },
  { id: 16, title: "Du Hast", artist: "Rammstein", year: 1997, preview: null, cover: null },
  { id: 17, title: "Viva la Vida", artist: "Coldplay", year: 2008, preview: null, cover: null },
  { id: 18, title: "Poker Face", artist: "Lady Gaga", year: 2008, preview: null, cover: null },
  { id: 19, title: "Seven Nation Army", artist: "White Stripes", year: 2003, preview: null, cover: null },
  { id: 20, title: "Humble", artist: "Kendrick Lamar", year: 2017, preview: null, cover: null },
];

// ══════════════════════════════════════════════════════════════
// ── UTILITIES ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const GENRE_META = {
  pop: { label: "Pop", icon: "🎤", color: "#ff2d78" },
  rock: { label: "Rock", icon: "🎸", color: "#ff6b35" },
  hiphop: { label: "Hip-Hop", icon: "🎧", color: "#a855f7" },
  electronic: { label: "Electronic", icon: "🎹", color: "#06d6a0" },
  deutsch: { label: "Deutsch", icon: "🇩🇪", color: "#fbbf24" },
};
const PC = ["#ff2d78", "#06d6a0", "#a855f7", "#fbbf24", "#38bdf8", "#f97316"];

// ── Audio ─────────────────────────────────────────────────────
let gAudio = null;
const playAudio = (url) => { stopAudio(); if (!url) return; gAudio = new Audio(url); gAudio.volume = 0.7; gAudio.play().catch(() => {}); };
const stopAudio = () => { if (gAudio) { gAudio.pause(); gAudio.currentTime = 0; gAudio = null; } };
const toggleAudio = () => { if (!gAudio) return false; if (gAudio.paused) { gAudio.play(); return true; } else { gAudio.pause(); return false; } };

// ── Small Components ──────────────────────────────────────────
function Vinyl({ spinning, cover, size = 85 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "radial-gradient(circle,#111 18%,#1a1a1a 19%,#222 38%,#111 39%,#111 42%,#2a2a2a 43%,#2a2a2a 44%,#111 45%)", animation: spinning ? "spin 2.5s linear infinite" : "none", boxShadow: "0 4px 25px rgba(0,0,0,0.5)", position: "relative" }}>
      {cover && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: size * 0.36, height: size * 0.36, borderRadius: "50%", backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center", border: "2px solid #333" }} />}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 7, height: 7, borderRadius: "50%", background: "#555", border: "1px solid #777" }} />
    </div>
  );
}

function Wave({ active }) {
  return (
    <div style={{ display: "flex", alignItems: "end", gap: 2, height: 20, opacity: active ? 1 : 0.25, transition: "opacity 0.3s", justifyContent: "center" }}>
      {Array.from({ length: 24 }, (_, i) => <div key={i} style={{ width: 2.5, borderRadius: 2, minHeight: 3, background: "linear-gradient(to top,#ff2d78,#a855f7)", animation: active ? `wave 0.7s ${i * 0.04}s ease-in-out infinite alternate` : "none" }} />)}
    </div>
  );
}

function DZ({ active, onClick, disabled }) {
  const [h, setH] = useState(false);
  const on = active || h;
  return (
    <div onClick={disabled ? undefined : onClick} onMouseEnter={() => !disabled && setH(true)} onMouseLeave={() => setH(false)} style={{ width: 40, height: 80, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer", flexShrink: 0, position: "relative" }}>
      <div style={{ width: on ? 4 : 2, height: on ? 60 : 40, background: on ? "#ff2d78" : "#2a2a3a", borderRadius: 2, transition: "all 0.25s", boxShadow: on ? "0 0 12px rgba(255,45,120,0.4)" : "none" }} />
      {on && <div style={{ position: "absolute", top: 6, fontSize: "0.55rem", color: "#ff2d78", animation: "bob 0.8s ease-in-out infinite" }}>▼</div>}
    </div>
  );
}

function Confetti() {
  return <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100 }}>{Array.from({ length: 55 }, (_, i) => <div key={i} style={{ position: "absolute", left: `${Math.random() * 100}%`, top: -10, width: 5 + Math.random() * 7, height: 5 + Math.random() * 7, background: PC[Math.floor(Math.random() * PC.length)], borderRadius: Math.random() > 0.5 ? "50%" : "2px", animation: `fall ${2 + Math.random() * 3}s ${Math.random() * 3}s linear infinite` }} />)}</div>;
}

function Lbl({ children }) {
  return <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: 3, textTransform: "uppercase", color: "#7a7a8e", marginBottom: "0.7rem" }}>{children}</div>;
}

// ══════════════════════════════════════════════════════════════
// ── MAIN APP ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
export default function Tuneline() {
  const [scr, setScr] = useState("menu");
  const [players, setPlayers] = useState([{ name: "Spieler 1" }, { name: "Spieler 2" }]);
  const [genres, setGenres] = useState(["pop"]);
  const [rounds, setRounds] = useState(10);
  const [loadingMsg, setLoadingMsg] = useState("");

  const [deck, setDeck] = useState([]);
  const [si, setSi] = useState(0);
  const [pi, setPi] = useState(0);
  const [tl, setTl] = useState({});
  const [sc, setSc] = useState({});
  const [slot, setSlot] = useState(null);
  const [fb, setFb] = useState(null);
  const [rev, setRev] = useState(false);
  const [rnd, setRnd] = useState(1);
  const [playing, setPlaying] = useState(false);

  const tgGenre = (g) => setGenres(p => p.includes(g) ? (p.length > 1 ? p.filter(x => x !== g) : p) : [...p, g]);

  // ── Start Game ──────────────────────────────────────────
  const start = useCallback(async () => {
    setScr("loading");
    setLoadingMsg("Songs werden von Deezer geladen...");

    const needed = rounds * players.length + players.length + 5;
    let songs = await loadSongsForGenres(genres, needed);

    if (songs.length < players.length + 3) {
      setLoadingMsg("Deezer nicht erreichbar – nutze Fallback-Songs...");
      songs = shuffle(FALLBACK_SONGS);
      await new Promise(r => setTimeout(r, 800));
    }

    const tls = {}, scs = {};
    players.forEach((_, i) => { tls[i] = [songs[i]]; scs[i] = 0; });
    const dk = songs.slice(players.length);

    setDeck(dk); setTl(tls); setSc(scs);
    setSi(0); setPi(0); setSlot(null); setFb(null); setRev(false); setRnd(1);
    setScr("game");

    if (dk[0]?.preview) { playAudio(dk[0].preview); setPlaying(true); }
  }, [genres, rounds, players]);

  // ── Place Song ──────────────────────────────────────────
  const place = useCallback(() => {
    if (slot === null || !deck[si]) return;
    const song = deck[si];
    const sorted = [...(tl[pi] || [])].sort((a, b) => a.year - b.year);
    const ns = [...sorted]; ns.splice(slot, 0, song);
    let ok = true;
    for (let i = 1; i < ns.length; i++) { if (ns[i].year < ns[i - 1].year) { ok = false; break; } }

    setRev(true); stopAudio(); setPlaying(false);
    if (ok) { setFb("ok"); setSc(s => ({ ...s, [pi]: s[pi] + 1 })); setTl(t => ({ ...t, [pi]: ns })); }
    else setFb("no");

    setTimeout(() => {
      const nsi = si + 1;
      const npi = (pi + 1) % players.length;
      const nr = npi === 0 ? rnd + 1 : rnd;
      if (nsi >= deck.length || (npi === 0 && rnd >= rounds)) { stopAudio(); setScr("result"); }
      else {
        setSi(nsi); setPi(npi); setRnd(nr); setSlot(null); setFb(null); setRev(false);
        if (deck[nsi]?.preview) { playAudio(deck[nsi].preview); setPlaying(true); }
        else setPlaying(false);
      }
    }, 2200);
  }, [slot, deck, si, tl, pi, sc, players, rnd, rounds]);

  useEffect(() => () => stopAudio(), []);

  const song = deck[si];
  const timeline = [...(tl[pi] || [])].sort((a, b) => a.year - b.year);

  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: "#08080d", color: "#e8e8f0", fontFamily: "'Outfit',sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes wave{0%{height:3px}100%{height:18px}}
        @keyframes fall{0%{transform:translateY(-10vh) rotate(0);opacity:1}100%{transform:translateY(110vh) rotate(900deg);opacity:0}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
        @keyframes pop{0%{transform:scale(0.5);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes slideIn{from{transform:translateY(15px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes glow{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
        @keyframes ldSpin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{height:5px}::-webkit-scrollbar-track{background:#12121a}::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:3px}
      `}</style>

      {/* BG */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(255,45,120,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,45,120,0.015) 1px,transparent 1px)", backgroundSize: "50px 50px", pointerEvents: "none" }} />
      <div style={{ position: "fixed", width: 500, height: 500, borderRadius: "50%", filter: "blur(140px)", background: "rgba(255,45,120,0.06)", top: -180, right: -180, pointerEvents: "none" }} />
      <div style={{ position: "fixed", width: 350, height: 350, borderRadius: "50%", filter: "blur(110px)", background: "rgba(6,214,160,0.04)", bottom: -80, left: -80, pointerEvents: "none" }} />

      {/* ═══ MENU ═══ */}
      {scr === "menu" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "1.5rem", position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "clamp(2.5rem,8vw,5rem)", fontWeight: 700, letterSpacing: -3, background: "linear-gradient(135deg,#ff2d78,#a855f7,#06d6a0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "float 4s ease-in-out infinite", marginBottom: 4 }}>TUNELINE</div>
          <div style={{ fontSize: "0.8rem", color: "#7a7a8e", letterSpacing: 4, textTransform: "uppercase", fontWeight: 300, marginBottom: "2.5rem" }}>Musik · Timeline · Challenge</div>

          <div style={{ background: "#12121a", border: "1px solid #2a2a3a", borderRadius: 20, padding: "2rem", width: "100%", maxWidth: 450 }}>
            <Lbl>Genres wählen</Lbl>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.45rem", marginBottom: "1.4rem" }}>
              {Object.entries(GENRE_META).map(([k, m]) => {
                const on = genres.includes(k);
                return <button key={k} onClick={() => tgGenre(k)} style={{ padding: "0.55rem 0.4rem", borderRadius: 10, border: `1.5px solid ${on ? m.color : "#2a2a3a"}`, background: on ? `${m.color}12` : "transparent", color: on ? m.color : "#7a7a8e", fontFamily: "'Outfit',sans-serif", fontSize: "0.78rem", fontWeight: 500, cursor: "pointer", transition: "all 0.25s", boxShadow: on ? `0 0 18px ${m.color}18` : "none" }}>{m.icon} {m.label}</button>;
              })}
            </div>

            <Lbl>Spieler</Lbl>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.4rem" }}>
              {players.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: PC[i], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.75rem", color: "#08080d", flexShrink: 0 }}>{i + 1}</div>
                  <input value={p.name} onChange={e => { const c = [...players]; c[i] = { name: e.target.value }; setPlayers(c); }} style={{ flex: 1, padding: "0.55rem 0.7rem", borderRadius: 10, border: "1.5px solid #2a2a3a", background: "#08080d", color: "#e8e8f0", fontFamily: "'Outfit',sans-serif", fontSize: "0.82rem", outline: "none" }} />
                  {players.length > 2 && <button onClick={() => setPlayers(players.filter((_, j) => j !== i))} style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(255,60,60,0.12)", color: "#ff6b6b", cursor: "pointer", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>}
                </div>
              ))}
              {players.length < 6 && <button onClick={() => setPlayers([...players, { name: `Spieler ${players.length + 1}` }])} style={{ padding: "0.45rem", borderRadius: 10, border: "1.5px dashed #2a2a3a", background: "transparent", color: "#7a7a8e", fontFamily: "'Outfit',sans-serif", fontSize: "0.78rem", cursor: "pointer" }}>+ Spieler hinzufügen</button>}
            </div>

            <Lbl>Runden</Lbl>
            <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.4rem" }}>
              {[5, 10, 15, 20].map(n => <button key={n} onClick={() => setRounds(n)} style={{ flex: 1, padding: "0.5rem", borderRadius: 10, border: `1.5px solid ${rounds === n ? "#06d6a0" : "#2a2a3a"}`, background: rounds === n ? "rgba(6,214,160,0.07)" : "transparent", color: rounds === n ? "#06d6a0" : "#7a7a8e", fontFamily: "'Outfit',sans-serif", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer" }}>{n}</button>)}
            </div>

            <button onClick={start} style={{ width: "100%", padding: "0.85rem", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#ff2d78,#a855f7)", color: "white", fontFamily: "'Outfit',sans-serif", fontSize: "1rem", fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>
              🎵 Spiel starten
            </button>
            <div style={{ marginTop: "0.75rem", textAlign: "center", fontSize: "0.65rem", color: "#555" }}>
              Songs werden live von der Deezer API geladen
            </div>
          </div>
        </div>
      )}

      {/* ═══ LOADING ═══ */}
      {scr === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "2rem", fontWeight: 700, background: "linear-gradient(135deg,#ff2d78,#a855f7,#06d6a0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "1.5rem" }}>TUNELINE</div>
          <div style={{ width: 48, height: 48, border: "3px solid #2a2a3a", borderTop: "3px solid #ff2d78", borderRadius: "50%", animation: "ldSpin 0.8s linear infinite", marginBottom: "1.5rem" }} />
          <div style={{ fontSize: "0.9rem", color: "#7a7a8e", animation: "glow 1.5s infinite" }}>{loadingMsg}</div>
          <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#555" }}>Das kann ein paar Sekunden dauern...</div>
        </div>
      )}

      {/* ═══ GAME ═══ */}
      {scr === "game" && song && (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.65rem 1rem", background: "#12121a", borderBottom: "1px solid #1e1e2e", flexShrink: 0, flexWrap: "wrap", gap: "0.4rem" }}>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "1rem", fontWeight: 700, background: "linear-gradient(135deg,#ff2d78,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>TUNELINE</div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", color: "#7a7a8e", letterSpacing: 2 }}>RUNDE {rnd}/{rounds}</div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {players.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.25rem 0.6rem", borderRadius: 18, border: `1px solid ${i === pi ? "#ff2d78" : "#2a2a3a"}`, background: i === pi ? "rgba(255,45,120,0.07)" : "#1a1a26", boxShadow: i === pi ? "0 0 10px rgba(255,45,120,0.12)" : "none", fontSize: "0.7rem", transition: "all 0.3s" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: PC[i] }} />
                  <span style={{ color: i === pi ? "#e8e8f0" : "#7a7a8e" }}>{p.name}</span>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#06d6a0" }}>{sc[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Song Card */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1rem 0.75rem", flexShrink: 0 }}>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "0.6rem", letterSpacing: 3, textTransform: "uppercase", color: PC[pi], marginBottom: "0.6rem", animation: "glow 2s infinite" }}>● {players[pi]?.name} ist dran</div>
            <div style={{ background: "#12121a", border: "1px solid #2a2a3a", borderRadius: 16, padding: "1.1rem", textAlign: "center", width: "100%", maxWidth: 400, position: "relative", overflow: "hidden", animation: "slideIn 0.4s ease-out" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#ff2d78,#a855f7,#06d6a0)" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "0.6rem" }}>
                <Vinyl spinning={playing} cover={song.cover} size={85} />
                <div style={{ textAlign: "left", minWidth: 0 }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{song.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "#7a7a8e", marginBottom: "0.4rem" }}>{song.artist}</div>
                  {rev && <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "1.7rem", fontWeight: 700, color: "#06d6a0", animation: "pop 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>{song.year}</div>}
                  {!rev && song.preview && (
                    <button onClick={() => { const r = toggleAudio(); setPlaying(r !== undefined ? r : !playing); }} style={{ padding: "0.3rem 0.8rem", borderRadius: 8, border: "1px solid #ff2d78", background: "rgba(255,45,120,0.08)", color: "#ff2d78", fontFamily: "'Outfit',sans-serif", fontSize: "0.7rem", cursor: "pointer" }}>
                      {playing ? "⏸ Pause" : "▶ Play"}
                    </button>
                  )}
                  {!rev && !song.preview && <div style={{ fontSize: "0.65rem", color: "#ff6b6b" }}>Kein Audio</div>}
                </div>
              </div>
              <Wave active={playing} />
              {!rev && <div style={{ fontSize: "0.65rem", color: "#7a7a8e", marginTop: "0.4rem" }}>Wähle die richtige Position in der Timeline ↓</div>}
            </div>
          </div>

          {/* Feedback */}
          {fb && (
            <div style={{ textAlign: "center", padding: "0.5rem", fontWeight: 700, fontSize: "0.9rem", flexShrink: 0, background: fb === "ok" ? "rgba(6,214,160,0.08)" : "rgba(255,68,68,0.08)", color: fb === "ok" ? "#06d6a0" : "#ff6b6b", borderTop: `2px solid ${fb === "ok" ? "#06d6a0" : "#ff4444"}`, animation: "slideIn 0.3s ease-out" }}>
              {fb === "ok" ? "✓ Richtig platziert! +1 Punkt" : `✗ Falsch! Der Song war von ${song.year}.`}
            </div>
          )}

          {/* Timeline */}
          <div style={{ flex: 1, padding: "0.4rem 0.5rem", overflowX: "auto", overflowY: "hidden", display: "flex", alignItems: "center", justifyContent: timeline.length <= 3 ? "center" : "flex-start", minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", minWidth: "min-content", padding: "0.3rem 1rem" }}>
              <DZ active={slot === 0} onClick={() => !rev && setSlot(0)} disabled={rev} />
              {timeline.map((s, i) => (
                <div key={`${s.id || s.title}-${i}`} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ background: "#1a1a26", border: `1.5px solid ${rev && fb === "ok" && s === song ? "#06d6a0" : "#2a2a3a"}`, borderRadius: 11, padding: "0.5rem 0.65rem", textAlign: "center", minWidth: 90, boxShadow: rev && fb === "ok" && s === song ? "0 0 18px rgba(6,214,160,0.2)" : "none", animation: rev && fb === "ok" && s === song ? "pop 0.4s ease-out" : "none", transition: "all 0.3s", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "0.8rem", fontWeight: 700, color: "#ff2d78" }}>{s.year}</div>
                    <div style={{ fontSize: "0.58rem", fontWeight: 500, color: "#e8e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{s.title}</div>
                    <div style={{ fontSize: "0.48rem", color: "#7a7a8e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{s.artist}</div>
                  </div>
                  <DZ active={slot === i + 1} onClick={() => !rev && setSlot(i + 1)} disabled={rev} />
                </div>
              ))}
            </div>
          </div>

          {/* Place Button */}
          <div style={{ display: "flex", justifyContent: "center", padding: "0.65rem", flexShrink: 0 }}>
            <button disabled={slot === null || rev} onClick={place} style={{ padding: "0.65rem 2.2rem", borderRadius: 12, border: "none", background: slot !== null && !rev ? "linear-gradient(135deg,#06d6a0,#04b890)" : "#2a2a3a", color: slot !== null && !rev ? "#08080d" : "#555", fontFamily: "'Outfit',sans-serif", fontSize: "0.9rem", fontWeight: 600, cursor: slot !== null && !rev ? "pointer" : "not-allowed", transition: "all 0.3s" }}>
              {slot !== null ? "Hier platzieren ▶" : "Position wählen..."}
            </button>
          </div>
        </div>
      )}

      {/* ═══ RESULT ═══ */}
      {scr === "result" && (() => {
        const ranked = players.map((p, i) => ({ name: p.name, score: sc[i], color: PC[i] })).sort((a, b) => b.score - a.score);
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem", position: "relative", zIndex: 1 }}>
            <Confetti />
            <div style={{ background: "#12121a", border: "1px solid #2a2a3a", borderRadius: 20, padding: "2.5rem", textAlign: "center", maxWidth: 420, width: "100%", animation: "slideIn 0.5s ease-out" }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: 4, textTransform: "uppercase", color: "#7a7a8e", marginBottom: "0.7rem" }}>Spiel beendet</div>
              <div style={{ fontSize: "3rem", marginBottom: "0.4rem" }}>👑</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, background: "linear-gradient(135deg,#ff2d78,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "0.2rem" }}>{ranked[0]?.name}</div>
              <div style={{ color: "#7a7a8e", fontSize: "0.85rem", marginBottom: "1.3rem" }}>gewinnt mit {ranked[0]?.score} Punkten!</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "1.3rem" }}>
                {ranked.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.7rem", borderRadius: 10, background: "#1a1a26" }}>
                    <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "0.75rem", color: i === 0 ? "#fbbf24" : "#7a7a8e", width: 20 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: r.color }} />
                    <span style={{ flex: 1, textAlign: "left", fontWeight: 500, fontSize: "0.9rem" }}>{r.name}</span>
                    <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, color: "#06d6a0" }}>{r.score}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { stopAudio(); setScr("menu"); }} style={{ padding: "0.7rem 1.8rem", borderRadius: 12, border: "1.5px solid #ff2d78", background: "transparent", color: "#ff2d78", fontFamily: "'Outfit',sans-serif", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer" }}>
                ↻ Nochmal spielen
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
