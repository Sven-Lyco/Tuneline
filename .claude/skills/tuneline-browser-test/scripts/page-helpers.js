// Run once per tab via javascript_tool (after the page loaded): Read this file and pass its
// whole content as the code. Sets window.__tl, built on the app's own socket — Vite serves
// /src/socket.ts as the same module instance the app uses, so the UI reacts to everything.
//
//   await __tl.createRoom({ audioMode: 'host-only', rounds: 1 })  → room code
//   await __tl.startGame(songs, { rounds: 1 })                     → game_started payload
//   await __tl.place(0)                                            → placement_result payload
//   await __tl.request('kick_player', { playerId }, 'room_updated')
//   await __tl.waitFor('game_over', 15000)
//   __tl.text()                                                    → visible page text
//   __tl.autoPlay(songs)          → places correctly on this player's turns (long games, timelines)
//   __tl.layoutIssues()           → horizontal overflow and tap targets below ~40 px
//
// Every wait has a timeout: an await on an event that never comes blocks the tool for 45 s,
// and emits sent while disconnected are buffered and replayed later.
//
// To drive the app inside an iframe (mobile widths), first set
//   window.__tlTarget = document.querySelector('iframe').contentWindow
// and then run this file in the outer page; __tl then talks to the iframe's app.
window.__tl = await (async (win) => {
  // Imported in the target's realm, so it's the same module instance its app uses.
  const { socket } = await win.eval("import('/src/socket.ts')");

  // The app connects lazily (autoConnect: false).
  async function connect() {
    if (socket.connected) return;
    socket.connect();
    await waitFor('connect');
  }

  function waitFor(event, ms = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.off(event, onEvent);
        reject(new Error(`no ${event} within ${ms} ms`));
      }, ms);
      const onEvent = (data) => {
        clearTimeout(timer);
        resolve(data);
      };
      socket.once(event, onEvent);
    });
  }

  /** Emits and resolves with the answer event; a server 'error' event rejects. */
  async function request(event, payload, answerEvent, ms = 5000) {
    await connect();
    return new Promise((resolve, reject) => {
      const finish = (fn) => (arg) => {
        clearTimeout(timer);
        socket.off(answerEvent, onAnswer);
        socket.off('error', onError);
        fn(arg);
      };
      const onAnswer = finish(resolve);
      const onError = finish((e) => reject(new Error(`server error: ${e.message}`)));
      const timer = setTimeout(
        finish(() => reject(new Error(`no ${answerEvent} within ${ms} ms`))),
        ms
      );
      socket.once(answerEvent, onAnswer);
      socket.once('error', onError);
      if (payload === undefined) socket.emit(event);
      else socket.emit(event, payload);
    });
  }

  /**
   * Places this player's songs correctly after each reveal, like bots.mjs --songs. Turns only
   * carry the preview, so the year comes from the song list the host started with.
   * Call it before createRoom/joining (a guest learns its id from room_joined; the host's id comes
   * from game_started). Returns a stop function.
   */
  function autoPlay(songs) {
    const yearByPreview = new Map(songs.map((s) => [s.preview, s.year]));
    let me = null;
    const play = (gameState, song, delayMs) => {
      if (!song || gameState.currentPlayerId !== me) return;
      const timeline = gameState.players.find((p) => p.id === me)?.timeline ?? [];
      const year = yearByPreview.get(song.preview);
      setTimeout(
        () => socket.emit('place_song', { position: timeline.filter((s) => s.year < year).length }),
        delayMs
      );
    };
    const onStart = ({ gameState, currentSong }) => {
      me = me ?? gameState.players.find((p) => p.isHost)?.id ?? null;
      play(gameState, currentSong, 1500);
    };
    const onResult = ({ gameState, nextSong }) => play(gameState, nextSong, 4500);
    const onJoined = ({ playerId }) => (me = playerId);
    socket.on('room_joined', onJoined);
    socket.on('game_started', onStart);
    socket.on('placement_result', onResult);
    return () => {
      socket.off('room_joined', onJoined);
      socket.off('game_started', onStart);
      socket.off('placement_result', onResult);
    };
  }

  /** What looks broken on a phone: sideways overflow and fingers-too-big targets. */
  function layoutIssues() {
    const doc = win.document;
    const vw = doc.documentElement.clientWidth;
    // Content inside a horizontal scroller (timelines, chip rows) is allowed past the edge.
    const scrolls = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = win.getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      return false;
    };
    const label = (el) => (el.innerText || el.title || el.tagName).replace(/\s+/g, ' ').slice(0, 30);
    const overflow = [...doc.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const deco = win.getComputedStyle(el).pointerEvents === 'none';
        return r.width > 0 && (r.right > vw + 1 || r.left < -1) && !deco && !scrolls(el);
      })
      .map(label);
    const smallTargets = [...doc.querySelectorAll('button, a, input, select, [role=button]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && (r.width < 40 || r.height < 36))
      .map(({ el, r }) => `${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    return {
      width: vw,
      pageScrollsSideways: doc.documentElement.scrollWidth > vw,
      overflow: [...new Set(overflow)].slice(0, 15),
      // A ::after hit area (see LinkButton) makes small text targets fine — check before "fixing".
      smallTargets,
    };
  }

  return {
    socket,
    connect,
    waitFor,
    request,
    autoPlay,
    layoutIssues,
    /** Note: the UI stays on its current screen until game_started — that's expected. */
    createRoom: async ({ hostName = 'Host', rounds = 3, audioMode = 'all', turnLimit = 0 } = {}) =>
      (await request('create_room', { hostName, rounds, audioMode, turnLimit }, 'room_created'))
        .roomCode,
    startGame: (songs, { rounds = 3, audioMode = 'all' } = {}) =>
      request('start_game', { songs, rounds, audioMode }, 'game_started'),
    place: (position) => request('place_song', { position }, 'placement_result'),
    text: (chars = 800) => win.document.body.innerText.slice(0, chars),
  };
})(window.__tlTarget ?? window);
'tuneline helpers ready: window.__tl';
