/* app.js — router + the two share-a-link play flows (alternating turns & racing duel). */
(function (root) {
  'use strict';
  const UI = root.UI, h = UI.h, clear = UI.clear;
  const GAMES = root.GAMES;
  const appEl = document.getElementById('app');

  let session = {};           // per-open state (localPlayer / raced). Not serialized.
  let resizeFn = null;
  window.addEventListener('resize', () => { if (resizeFn) resizeFn(); }, { passive: true });

  // ---- URL state ---------------------------------------------------------
  function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw) return null;
    try {
      const st = JSON.parse(UI.b64urlDecode(raw));
      return (st && st.g) ? st : null;
    } catch (e) { return null; }
  }
  function writeHash(st) {
    history.replaceState(null, '', '#' + UI.b64urlEncode(JSON.stringify(st)));
  }
  function goMenu() {
    resizeFn = null;
    history.replaceState(null, '', location.pathname + location.search);
    renderMenu();
  }

  // ---- routing -----------------------------------------------------------
  function route() {
    const raw = location.hash.replace(/^#/, '');
    const st = parseHash();
    if (!st) {
      // A non-empty hash that won't decode means a link arrived but was cut off
      // or mangled (long links get truncated by SMS/chat apps). Say so instead
      // of silently dropping to the menu, which looks like the move never came.
      if (raw) { renderBrokenLink(); return; }
      renderMenu(); return;
    }
    const game = GAMES.find((g) => g.id === st.g);
    if (!game) { renderBrokenLink(); return; }
    if (game.mode === 'duel') enterDuel(game, st);
    else enterTurns(game, st);
  }
  window.addEventListener('hashchange', route);

  // ---- chrome ------------------------------------------------------------
  function topBar(title, sub) {
    return h('div', { class: 'top' },
      h('button', { class: 'back', onclick: goMenu, 'aria-label': 'Back to menu' }, '‹ Games'),
      h('div', { class: 'top-title' }, title, sub ? h('span', { class: 'top-sub' }, sub) : null));
  }

  // ---- menu --------------------------------------------------------------
  function renderMenu() {
    resizeFn = null;
    clear(appEl);
    const wrap = h('div', { class: 'menu' });
    wrap.append(
      h('div', { class: 'hero' },
        h('h1', {}, 'Matt ', h('span', { class: 'amp' }, '&'), ' Matt'),
        h('p', { class: 'tagline' }, 'Pick a game, make your move, text the link. Your opponent taps it and it’s their turn.')),
    );
    const grid = h('div', { class: 'cards' });
    for (const game of GAMES) {
      grid.append(h('button', {
        class: 'card', onclick: () => startGame(game),
      },
        h('div', { class: 'card-emoji' }, game.emoji),
        h('div', { class: 'card-name' }, game.name),
        h('div', { class: 'card-blurb' }, game.blurb),
        h('div', { class: 'card-tag' }, game.tagLabel || (game.mode === 'duel' ? 'Solo duel' : 'Turn by turn'))));
    }
    wrap.append(grid);
    wrap.append(h('div', { class: 'how' },
      h('b', {}, 'How it works · '),
      'No app, no sign-up. The whole game lives in the link — make your move, tap ',
      h('b', {}, 'Send'), ', and pick it back up whenever a link lands in your chat.'));
    appEl.append(wrap);
  }

  function renderBrokenLink() {
    resizeFn = null;
    clear(appEl);
    const wrap = h('div', { class: 'menu' });
    wrap.append(
      h('div', { class: 'hero' },
        h('h1', {}, 'Link didn’t come through'),
        h('p', { class: 'tagline' },
          'This game link looks cut off. Long links sometimes get split by Messages or WhatsApp — ' +
          'ask them to send it again, and open the whole link (or paste it straight into your browser’s address bar).')),
      h('div', { class: 'how' },
        h('button', { class: 'btn btn-primary big', onclick: goMenu }, '🎮 Go to the games')),
    );
    appEl.append(wrap);
  }

  function startGame(game) {
    if (game.mode === 'duel') {
      const seed = (Math.floor(Math.random() * 1e9)) >>> 0;
      const st = { g: game.id, v: 1, seed, st: [], cur: null };
      writeHash(st); enterDuel(game, st);
    } else {
      const st = game.newTurnState ? game.newTurnState(0) : { g: game.id, v: 1, f: 0, m: [] };
      writeHash(st); enterTurns(game, st);
    }
  }

  // =======================================================================
  // TURN-BASED FLOW
  // =======================================================================
  function computeLocalPlayer(game, st) {
    const v = game.view(st.m, st.f, st);
    if (v.over) return v.lastMover == null ? 0 : 1 - v.lastMover;
    return v.turn;
  }
  function enterTurns(game, st) {
    resizeFn = null;
    session = { localPlayer: computeLocalPlayer(game, st) };
    renderTurns(game, st);
  }
  function renderTurns(game, st) {
    clear(appEl);
    const v = game.view(st.m, st.f, st);
    const me = session.localPlayer;
    const phase = v.over ? 'over' : (v.turn === me ? 'play' : 'sent');

    const api = {
      m: st.m, f: st.f, view: v, me: me,
      canPlay: phase === 'play',
      play(move) {
        if (v.over || v.turn !== me) return;
        if (!game.legal(st.m, st.f, move, st)) return;
        st.m = st.m.concat([move]);
        writeHash(st);
        renderTurns(game, st);
      },
      // general state change for games that need more than "append a move"
      // (e.g. the draft's roll/retool). The game validates its own legality.
      act(mutate) {
        if (v.over || v.turn !== me) return;
        mutate(st);
        writeHash(st);
        renderTurns(game, st);
      },
    };

    const screen = h('div', { class: 'screen' });
    screen.append(topBar(game.emoji + ' ' + game.name, game.mode === 'duel' ? '' : ''));

    // identity + status
    const swatch = h('span', { class: 'swatch' }); swatch.style.background = game.colors[me];
    screen.append(h('div', { class: 'status' },
      h('div', { class: 'you' }, 'You’re ', swatch, ' ', game.pieceLabel[me]),
      h('div', { class: 'turn ' + phase },
        phase === 'play' ? 'Your move' : phase === 'sent' ? 'Move sent ✓' : resultText(v, me))));

    // board
    const boardWrap = h('div', { class: 'board-wrap ' + game.id + (phase !== 'play' ? ' locked' : '') });
    game.paint(boardWrap, api);
    screen.append(boardWrap);

    // footer
    screen.append(footerTurns(game, st, v, phase, me));
    appEl.append(screen);
    // keep board in view on smaller screens
    boardWrap.scrollIntoView && requestAnimationFrame(() => { window.scrollTo(0, 0); });
  }
  function resultText(v, me) {
    if (v.winner == null) return '🤝 Draw';
    return v.winner === me ? '🎉 You win!' : '😤 Opponent wins';
  }
  function footerTurns(game, st, v, phase, me) {
    const foot = h('div', { class: 'panel' });
    if (phase === 'play') {
      foot.append(h('div', { class: 'hint' }, 'Make your move, then send it over.'));
    } else if (phase === 'sent') {
      foot.append(h('div', { class: 'hint' }, 'Locked in. Send it to your opponent — it’s their turn now.'));
      foot.append(sendButton(st));
      foot.append(h('button', { class: 'btn btn-ghost', onclick: () => UI.copyText(location.href) }, '🔗 Copy link'));
    } else { // over
      foot.append(sendButton(st, 'Send the result'));
      foot.append(h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => rematchTurns(game, st) }, '🔁 Rematch'),
        h('button', { class: 'btn', onclick: goMenu }, '🎮 Menu')));
    }
    return foot;
  }
  function sendButton(st, label) {
    return h('button', {
      class: 'btn btn-primary big',
      onclick: () => { writeHash(st); UI.shareLink(location.href, 'Your turn 👇'); },
    }, navigator.share ? ('📩 ' + (label || 'Send move to opponent')) : ('🔗 ' + (label || 'Copy turn link')));
  }
  function rematchTurns(game, st) {
    const nst = game.newTurnState ? game.newTurnState(1 - st.f) : { g: game.id, v: 1, f: 1 - st.f, m: [] };
    writeHash(nst); enterTurns(game, nst);
  }

  // =======================================================================
  // RACING DUEL FLOW
  // =======================================================================
  function enterDuel(game, st) {
    resizeFn = null;
    session = { raced: false };
    renderDuel(game, st);
  }
  function renderDuel(game, st) {
    clear(appEl);
    const screen = h('div', { class: 'screen' });
    screen.append(topBar(game.emoji + ' ' + game.name));
    const boardWrap = h('div', { class: 'board-wrap race' });
    const api = {
      state: st,
      session,
      persist() { writeHash(st); },
      rerender() { renderDuel(game, st); },
      onResize(fn) { resizeFn = fn; },
      share(text) { writeHash(st); UI.shareLink(location.href, text); },
      newGame(mkTrack, mode) {
        const seed = mode === 'same' ? st.seed : ((Math.floor(Math.random() * 1e9)) >>> 0);
        const nst = { g: game.id, v: 1, seed, st: [], cur: null };
        writeHash(nst); enterDuel(game, nst);
      },
    };
    game.paint(boardWrap, api);
    screen.append(boardWrap);
    appEl.append(screen);
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  // ---- boot --------------------------------------------------------------
  route();
})(typeof window !== 'undefined' ? window : globalThis);
