/* games.js — game definitions.
   Two play models:
     mode:'turns'  -> alternating: state = { g, f, m }  (m = move list, f = who moved first)
     mode:'duel'   -> beat-my-run: state = { g, seed, st, cur }  (each races the same track solo)

   Every game exposes pure logic (view/legal or track/physics) plus a paint() that
   renders into a container. Pure functions are exported for tests at the bottom.
*/
(function (root) {
  'use strict';
  const { h, clear } = root.UI;
  const svgNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) {
    const el = document.createElementNS(svgNS, tag);
    if (attrs) for (const k in attrs) { if (attrs[k] != null) el.setAttribute(k, attrs[k]); }
    return el;
  }

  /* =====================================================================
     CONNECT 4
     ===================================================================== */
  const C4 = { W: 7, H: 6 };
  function c4View(m, f) {
    const W = C4.W, H = C4.H;
    const b = new Array(W * H).fill(-1);
    const heights = new Array(W).fill(0);
    let last = null;
    for (let i = 0; i < m.length; i++) {
      const col = m[i], p = (f + i) % 2;
      const row = H - 1 - heights[col];
      b[row * W + col] = p; heights[col]++; last = { r: row, c: col };
    }
    let winner = null; const winSet = new Set();
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    outer:
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const p = b[r * W + c]; if (p === -1) continue;
      for (const [dr, dc] of dirs) {
        let ok = true;
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k, nc = c + dc * k;
          if (nr < 0 || nr >= H || nc < 0 || nc >= W || b[nr * W + nc] !== p) { ok = false; break; }
        }
        if (ok) { winner = p; for (let k = 0; k < 4; k++) winSet.add((r + dr * k) * W + (c + dc * k)); break outer; }
      }
    }
    const full = m.length === W * H;
    const over = winner !== null || full;
    return {
      board: b, heights, W, H, winner, winSet, over,
      turn: over ? null : (f + m.length) % 2,
      lastMover: m.length ? (f + m.length - 1) % 2 : null,
      last,
    };
  }
  function c4Legal(m, f, col) {
    const v = c4View(m, f);
    return !v.over && col >= 0 && col < C4.W && v.heights[col] < C4.H;
  }
  const connect4 = {
    id: 'connect4', name: 'Connect 4', emoji: '🔴', mode: 'turns',
    blurb: 'Drop discs, line up four. Quick and satisfying.',
    colors: ['#f4544c', '#f2c14e'], pieceLabel: ['Red', 'Yellow'],
    view: c4View, legal: c4Legal,
    paint(rootEl, api) {
      const v = api.view, W = v.W, H = v.H;
      const wrap = h('div', { class: 'c4' });
      for (let c = 0; c < W; c++) {
        const canDrop = api.canPlay && v.heights[c] < H;
        const col = h('div', {
          class: 'c4-col' + (canDrop ? ' live' : ''),
          onclick: canDrop ? () => api.play(c) : null,
        });
        for (let r = 0; r < H; r++) {
          const p = v.board[r * W + c];
          const cell = h('div', { class: 'c4-cell' });
          const disc = h('div', {
            class: 'disc' + (p === -1 ? ' empty' : '') + (v.winSet.has(r * W + c) ? ' win' : ''),
          });
          if (p !== -1) disc.style.background = this.colors[p];
          if (v.last && v.last.r === r && v.last.c === c) disc.classList.add('last');
          cell.append(disc); col.append(cell);
        }
        wrap.append(col);
      }
      rootEl.append(wrap);
    },
  };

  /* =====================================================================
     GOMOKU (five in a row, 15x15)
     ===================================================================== */
  const GO = { N: 15, WIN: 5 };
  function goView(m, f) {
    const N = GO.N;
    const b = new Array(N * N).fill(-1);
    let last = null;
    for (let i = 0; i < m.length; i++) { b[m[i]] = (f + i) % 2; last = m[i]; }
    let winner = null; const winSet = new Set();
    if (last != null) {
      const lr = Math.floor(last / N), lc = last % N, p = b[last];
      const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
      for (const [dr, dc] of dirs) {
        const line = [last];
        for (const sgn of [-1, 1]) {
          let k = 1;
          while (true) {
            const nr = lr + dr * k * sgn, nc = lc + dc * k * sgn;
            if (nr < 0 || nr >= N || nc < 0 || nc >= N || b[nr * N + nc] !== p) break;
            line.push(nr * N + nc); k++;
          }
        }
        if (line.length >= GO.WIN) { winner = p; line.forEach((x) => winSet.add(x)); break; }
      }
    }
    const over = winner !== null || m.length === N * N;
    return {
      board: b, N, winner, winSet, over,
      turn: over ? null : (f + m.length) % 2,
      lastMover: m.length ? (f + m.length - 1) % 2 : null,
      last,
    };
  }
  function goLegal(m, f, cell) {
    const v = goView(m, f);
    return !v.over && cell >= 0 && cell < GO.N * GO.N && v.board[cell] === -1;
  }
  const gomoku = {
    id: 'gomoku', name: 'Gomoku', emoji: '⚫', mode: 'turns',
    blurb: 'Five in a row on a big board. Tic-tac-toe grown up.',
    colors: ['#1c1c22', '#f4f4f6'], pieceLabel: ['Black', 'White'],
    view: goView, legal: goLegal,
    paint(rootEl, api) {
      const v = api.view, N = v.N;
      const board = h('div', { class: 'go', style: { '--n': String(N) } });
      for (let i = 0; i < N * N; i++) {
        const p = v.board[i];
        const cell = h('div', {
          class: 'go-cell' + (api.canPlay && p === -1 ? ' live' : ''),
          onclick: (api.canPlay && p === -1) ? () => api.play(i) : null,
        });
        if (p !== -1) {
          const stone = h('div', { class: 'stone' + (v.winSet.has(i) ? ' win' : '') + (i === v.last ? ' last' : '') });
          stone.style.background = this.colors[p];
          cell.append(stone);
        }
        board.append(cell);
      }
      rootEl.append(h('div', { class: 'go-wrap' }, board));
    },
  };

  /* =====================================================================
     HEX (connection game, 11x11)
     player 0 connects TOP <-> BOTTOM ; player 1 connects LEFT <-> RIGHT
     ===================================================================== */
  const HEX = { N: 11 };
  function hexNeighbors(r, c, N) {
    const out = [];
    const cand = [[r - 1, c], [r - 1, c + 1], [r, c - 1], [r, c + 1], [r + 1, c - 1], [r + 1, c]];
    for (const [nr, nc] of cand) if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
    return out;
  }
  function hexWinner(board, N) {
    // player 0: top row -> bottom row
    for (const player of [0, 1]) {
      const seen = new Uint8Array(N * N);
      const stack = [];
      if (player === 0) { for (let c = 0; c < N; c++) if (board[c] === 0) { stack.push(c); seen[c] = 1; } }
      else { for (let r = 0; r < N; r++) if (board[r * N] === 1) { stack.push(r * N); seen[r * N] = 1; } }
      while (stack.length) {
        const idx = stack.pop();
        const r = Math.floor(idx / N), c = idx % N;
        if (player === 0 && r === N - 1) return { winner: 0, seen: markPath(board, N, 0) };
        if (player === 1 && c === N - 1) return { winner: 1, seen: markPath(board, N, 1) };
        for (const nb of hexNeighbors(r, c, N)) {
          if (!seen[nb] && board[nb] === player) { seen[nb] = 1; stack.push(nb); }
        }
      }
    }
    return null;
  }
  // recompute the full connected winning region for highlighting
  function markPath(board, N, player) {
    const seen = new Uint8Array(N * N);
    const stack = [];
    if (player === 0) { for (let c = 0; c < N; c++) if (board[c] === 0) { stack.push(c); seen[c] = 1; } }
    else { for (let r = 0; r < N; r++) if (board[r * N] === 1) { stack.push(r * N); seen[r * N] = 1; } }
    while (stack.length) {
      const idx = stack.pop(), r = Math.floor(idx / N), c = idx % N;
      for (const nb of hexNeighbors(r, c, N)) if (!seen[nb] && board[nb] === player) { seen[nb] = 1; stack.push(nb); }
    }
    return seen;
  }
  function hexView(m, f) {
    const N = HEX.N;
    const board = new Array(N * N).fill(-1);
    let last = null;
    for (let i = 0; i < m.length; i++) { board[m[i]] = (f + i) % 2; last = m[i]; }
    const res = hexWinner(board, N);
    const winner = res ? res.winner : null;
    const winSet = new Set();
    if (res) for (let i = 0; i < N * N; i++) if (res.seen[i] && board[i] === winner) winSet.add(i);
    const over = winner !== null;
    return {
      board, N, winner, winSet, over,
      turn: over ? null : (f + m.length) % 2,
      lastMover: m.length ? (f + m.length - 1) % 2 : null,
      last,
    };
  }
  function hexLegal(m, f, cell) {
    const v = hexView(m, f);
    return !v.over && cell >= 0 && cell < HEX.N * HEX.N && v.board[cell] === -1;
  }
  const hex = {
    id: 'hex', name: 'Hex', emoji: '⬡', mode: 'turns',
    blurb: 'Connect your two sides. Simple rules, bottomless depth. No draws.',
    colors: ['#f4544c', '#4c86f4'], pieceLabel: ['Red (top–bottom)', 'Blue (left–right)'],
    view: hexView, legal: hexLegal,
    paint(rootEl, api) {
      const v = api.view, N = v.N;
      // hex geometry (pointy-top), rhombus sheared right
      const rw = 20, rh = 22;                 // hex spacing
      const dx = rw, dy = rh * 0.78;          // row/col deltas
      const shear = rw / 2;                   // each row shifts right
      const padX = 26, padY = 22;
      const width = padX * 2 + (N - 1) * dx + (N - 1) * shear + rw;
      const height = padY * 2 + (N - 1) * dy + rh;
      const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'hex-svg' });
      // edge color bars to show whose sides are whose
      const cx = (r, c) => padX + c * dx + r * shear + rw / 2;
      const cy = (r) => padY + r * dy + rh / 2;
      function hexPoints(x, y) {
        const w = rw / 2, hh = rh / 2;
        return [
          [x, y - hh], [x + w, y - hh * 0.5], [x + w, y + hh * 0.5],
          [x, y + hh], [x - w, y + hh * 0.5], [x - w, y - hh * 0.5],
        ].map((p) => p.join(',')).join(' ');
      }
      // side markers: Red owns top & bottom, Blue owns the slanted left & right sides
      const top = s('polyline', { points: `${cx(0, 0)},${padY - 6} ${cx(0, N - 1)},${padY - 6}`, class: 'hex-edge red' });
      const bot = s('polyline', { points: `${cx(N - 1, 0)},${height - padY + 6} ${cx(N - 1, N - 1)},${height - padY + 6}`, class: 'hex-edge red' });
      const left = s('polyline', { points: `${cx(0, 0) - rw / 2 - 5},${cy(0)} ${cx(N - 1, 0) - rw / 2 - 5},${cy(N - 1)}`, class: 'hex-edge blue' });
      const right = s('polyline', { points: `${cx(0, N - 1) + rw / 2 + 5},${cy(0)} ${cx(N - 1, N - 1) + rw / 2 + 5},${cy(N - 1)}`, class: 'hex-edge blue' });
      svg.append(top, bot, left, right);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const i = r * N + c, p = v.board[i];
        const x = cx(r, c), y = cy(r);
        const poly = s('polygon', {
          points: hexPoints(x, y),
          class: 'hex-cell' + (v.winSet.has(i) ? ' win' : '') + (i === v.last ? ' last' : '') +
            (api.canPlay && p === -1 ? ' live' : ''),
        });
        if (p === 0) poly.style.fill = this.colors[0];        // inline style beats the CSS default fill
        else if (p === 1) poly.style.fill = this.colors[1];
        if (api.canPlay && p === -1) poly.addEventListener('click', () => api.play(i));
        svg.append(poly);
      }
      rootEl.append(h('div', { class: 'hex-wrap' }, svg));
    },
  };

  /* =====================================================================
     GRAND PRIX (vector racing, beat-my-run duel)
     ===================================================================== */
  // Serpentine (boustrophedon) circuit: walled horizontal straights joined by
  // alternating hairpins. Seeded variety via band count / width / gap / chicane
  // pinches. Pinches only ever remove a top/bottom row (never the middle), so the
  // middle row of every band + the connectors always form a speed-1 path —
  // i.e. every generated track is provably completable. (Verified: 120/120 seeds,
  // optimal 23–34 moves.)
  const RACE = { cH: 3, cW: 3, margin: 1 };
  function makeTrack(seed) {
    const rnd = root.UI.mulberry32(seed >>> 0);
    const bands = 4 + Math.floor(rnd() * 2);   // 4..5
    const W = 15 + Math.floor(rnd() * 3);      // 15..17
    const gap = 2 + Math.floor(rnd() * 2);     // 2..3
    const { cH, cW, margin } = RACE;
    const xL = margin, xR = W - 1 - margin;
    const H = margin * 2 + bands * cH + (bands - 1) * gap;
    const on = new Uint8Array(W * H);
    const ry = (k) => margin + k * (cH + gap);
    const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) on[y * W + x] = v; };
    for (let k = 0; k < bands; k++) for (let y = ry(k); y < ry(k) + cH; y++) for (let x = xL; x <= xR; x++) set(x, y, 1);
    for (let k = 0; k < bands - 1; k++) {
      const right = (k % 2 === 0), cx0 = right ? xR - cW + 1 : xL, cx1 = right ? xR : xL + cW - 1;
      for (let y = ry(k); y < ry(k + 1) + cH; y++) for (let x = cx0; x <= cx1; x++) set(x, y, 1);
    }
    for (let k = 0; k < bands; k++) {           // chicane pinches (top/bottom row only)
      const nP = Math.floor(rnd() * 3);
      for (let p = 0; p < nP; p++) {
        const row = rnd() < 0.5 ? ry(k) : ry(k) + cH - 1;
        const x0 = xL + 2 + Math.floor(rnd() * Math.max(1, xR - xL - 4));
        const span = 1 + Math.floor(rnd() * 2);
        for (let x = x0; x < x0 + span && x <= xR - 1; x++) set(x, row, 0);
      }
    }
    const start = [xL, ry(0) + ((cH - 1) >> 1)];
    const L = bands - 1, entryRight = ((L - 1) % 2 === 0), finishX = entryRight ? xL : xR;
    const finishCells = new Set();
    for (let y = ry(L); y < ry(L) + cH; y++) finishCells.add(y * W + finishX);
    return { W, H, on, start, finishCells, finishX, bands };
  }
  function onTrack(track, x, y) {
    return x >= 0 && x < track.W && y >= 0 && y < track.H && track.on[y * track.W + x] === 1;
  }
  function segmentOnTrack(track, a, b) {
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * 4 + 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(a[0] + (b[0] - a[0]) * t);
      const y = Math.round(a[1] + (b[1] - a[1]) * t);
      if (!onTrack(track, x, y)) return false;
    }
    return true;
  }
  function raceLegalNext(track, path) {
    const n = path.length, cur = path[n - 1];
    const prev = n >= 2 ? path[n - 2] : cur;
    const vx = cur[0] - prev[0], vy = cur[1] - prev[1];
    const cands = [];
    for (let ay = -1; ay <= 1; ay++) for (let ax = -1; ax <= 1; ax++) {
      const nx = cur[0] + vx + ax, ny = cur[1] + vy + ay;
      if (segmentOnTrack(track, cur, [nx, ny])) cands.push([nx, ny]);
    }
    return cands;
  }
  function raceFinished(track, path) {
    if (!path.length) return false;
    const p = path[path.length - 1];
    return track.finishCells.has(p[1] * track.W + p[0]);
  }

  const grandprix = {
    id: 'grandprix', name: 'Grand Prix', emoji: '🏁', mode: 'duel', tagLabel: 'Race duel',
    blurb: 'Vector racing. You each drive the same track solo — fewest moves wins.',
    makeTrack, onTrack, segmentOnTrack, raceLegalNext, raceFinished,
    startPath(track) { return [track.start.slice()]; },
    paint(rootEl, api) {
      const st = api.state;
      const track = makeTrack(st.seed);
      const runs = st.st || [];
      const best = runs.length ? Math.min(...runs.map((r) => r.n)) : null;

      // ---- header / standings ----
      const target = runs.length ? Math.min(...runs.map((r) => r.n)) : null;
      const info = h('div', { class: 'race-hud' });

      // Decide sub-mode
      const racing = st.cur && st.cur.length > 0 && !raceFinished(track, st.cur);
      const decided = !api.session.raced && !racing && runs.length >= 2;
      const readyToStart = !api.session.raced && !racing && runs.length < 2 && !(st.cur && raceFinished(track, st.cur));

      // Standings line
      if (runs.length) {
        const board = h('div', { class: 'standings' });
        runs.forEach((r, i) => {
          board.append(h('div', { class: 'stand' + (r.n === best ? ' lead' : '') },
            h('span', { class: 'stand-name' }, (r.n === best ? '🏆 ' : '') + (r.label || ('Run ' + (i + 1)))),
            h('span', { class: 'stand-time' }, r.n + ' moves')));
        });
        info.append(board);
      }

      // Message
      let msg = '';
      if (racing) msg = 'Drive to the finish. ' + (target != null ? 'Beat ' + target + ' moves.' : 'Set the pace!');
      else if (readyToStart && runs.length === 0) msg = 'Fresh track. Drive it, then challenge your opponent to beat your time.';
      else if (readyToStart && runs.length >= 1) msg = 'Your opponent ran it in ' + target + '. Can you go faster?';
      else if (api.session.raced && runs.length < 2) msg = 'Nice run! Send it over and dare your opponent to beat it.';
      else if (api.session.raced && runs.length >= 2) {
        const mine = runs[runs.length - 1].n, other = Math.min(...runs.slice(0, -1).map((r) => r.n));
        msg = mine < other ? '🏆 You win — ' + mine + ' vs ' + other + '!' :
          mine > other ? 'Your opponent takes it — ' + mine + ' vs ' + other + '. Rematch?' :
            'Dead heat — ' + mine + ' each!';
      } else if (decided) {
        msg = '🏁 Race decided — fastest line wins. Run it back?';
      }
      info.append(h('div', { class: 'race-msg' }, msg));
      rootEl.append(info);

      // ---- canvas ----
      const cvWrap = h('div', { class: 'race-canvas-wrap' });
      const canvas = h('canvas', { class: 'race-canvas' });
      cvWrap.append(canvas);
      rootEl.append(cvWrap);

      let candidates = [];
      const state = { path: (st.cur && st.cur.length ? st.cur : null) };

      function draw() {
        const cssW = cvWrap.clientWidth || 340;
        const cs = Math.floor(cssW / track.W);
        const w = cs * track.W, hgt = cs * track.H;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = w * dpr; canvas.height = hgt * dpr;
        canvas.style.width = w + 'px'; canvas.style.height = hgt + 'px';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, hgt);
        // track
        ctx.fillStyle = '#20222b';
        ctx.fillRect(0, 0, w, hgt);
        ctx.fillStyle = '#3a3d4a';
        for (let y = 0; y < track.H; y++) for (let x = 0; x < track.W; x++) {
          if (track.on[y * track.W + x]) ctx.fillRect(x * cs, y * cs, cs, cs);
        }
        // start marker + checkered finish
        const [sx, sy] = track.start;
        ctx.fillStyle = 'rgba(110,168,255,0.30)';
        ctx.fillRect(sx * cs, (sy - 1) * cs, cs, cs * 3);
        ctx.fillStyle = '#6ea8ff'; ctx.font = 'bold ' + (cs * 0.7) + 'px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('S', sx * cs + cs / 2, sy * cs + cs / 2);
        track.finishCells.forEach((idx) => {
          const fx = idx % track.W, fy = (idx - fx) / track.W;
          drawChecker(ctx, fx * cs, fy * cs, cs);
        });
        const C = (p) => [p[0] * cs + cs / 2, p[1] * cs + cs / 2];
        // ghost runs
        const ghostColors = ['#f2c14e', '#7ee0a1', '#e08bd8'];
        (runs || []).forEach((r, gi) => {
          if (!r.path || r.path.length < 2) return;
          ctx.strokeStyle = ghostColors[gi % ghostColors.length]; ctx.globalAlpha = 0.45;
          ctx.lineWidth = Math.max(2, cs * 0.14); ctx.lineJoin = 'round';
          ctx.beginPath();
          r.path.forEach((p, i) => { const [X, Y] = C(p); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
          ctx.stroke(); ctx.globalAlpha = 1;
        });
        // your trail
        const path = state.path;
        if (path && path.length) {
          ctx.strokeStyle = '#4c86f4'; ctx.lineWidth = Math.max(2.5, cs * 0.16); ctx.lineJoin = 'round';
          ctx.beginPath();
          path.forEach((p, i) => { const [X, Y] = C(p); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
          ctx.stroke();
          // car
          const [cxp, cyp] = C(path[path.length - 1]);
          ctx.fillStyle = '#6ea8ff'; ctx.beginPath(); ctx.arc(cxp, cyp, cs * 0.28, 0, 7); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        // candidates
        candidates = [];
        if (path && !raceFinished(track, path) && !api.session.raced) {
          const opts = raceLegalNext(track, path);
          const coast = (() => {
            const n = path.length, cur = path[n - 1], prev = n >= 2 ? path[n - 2] : cur;
            return [cur[0] + (cur[0] - prev[0]), cur[1] + (cur[1] - prev[1])];
          })();
          opts.forEach((o) => {
            const [X, Y] = C(o);
            const isCoast = o[0] === coast[0] && o[1] === coast[1];
            ctx.beginPath(); ctx.arc(X, Y, cs * 0.22, 0, 7);
            ctx.fillStyle = isCoast ? 'rgba(120,224,161,0.95)' : 'rgba(255,255,255,0.85)';
            ctx.fill();
            ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
            candidates.push({ x: X, y: Y, cell: o, r: cs * 0.45 });
          });
          if (opts.length === 0) {
            // crash — show overlay handled by controls
          }
        }
      }
      function drawChecker(ctx, x, y, cs) {
        const n = 3, u = cs / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#e9e9ee' : '#33353f';
          ctx.fillRect(x + i * u, y + j * u, u, u);
        }
      }

      canvas.addEventListener('click', (ev) => {
        if (!state.path || api.session.raced) return;
        const rect = canvas.getBoundingClientRect();
        const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
        let bestC = null, bestD = 1e9;
        for (const c of candidates) {
          const d = Math.hypot(px - c.x, py - c.y);
          if (d < c.r && d < bestD) { bestD = d; bestC = c; }
        }
        if (!bestC) return;
        state.path = state.path.concat([bestC.cell]);
        st.cur = state.path;
        if (raceFinished(track, state.path)) finishRun();
        else { api.persist(); draw(); renderControls(); }
      });

      // ---- controls ----
      const controls = h('div', { class: 'race-controls' });
      rootEl.append(controls);

      function finishRun() {
        const turns = state.path.length - 1;
        const label = 'Run ' + (runs.length + 1);
        runs.push({ n: turns, path: state.path, label });
        st.st = runs; st.cur = null;
        api.session.raced = true;
        api.persist();
        api.rerender();
      }

      function renderControls() {
        clear(controls);
        const path = state.path;
        if (racingNow()) {
          const opts = raceLegalNext(track, path);
          const speed = (() => { const n = path.length, cur = path[n - 1], prev = n >= 2 ? path[n - 2] : cur; return Math.max(Math.abs(cur[0] - prev[0]), Math.abs(cur[1] - prev[1])); })();
          controls.append(h('div', { class: 'race-stat' },
            h('span', {}, 'Move ' + (path.length - 1)),
            h('span', {}, 'Speed ' + speed),
            target != null ? h('span', {}, 'Target ' + target) : null));
          if (opts.length === 0) {
            controls.append(h('div', { class: 'crash' }, '💥 No line through — you have to scrub off all your speed.'));
            controls.append(h('button', {
              class: 'btn btn-primary', onclick: () => {
                state.path = state.path.concat([path[path.length - 1].slice()]); // velocity -> 0, costs a move
                st.cur = state.path; api.persist(); draw(); renderControls();
              },
            }, 'Brake to a stop (–1 move)'));
          } else {
            controls.append(h('div', { class: 'hint' }, 'Tap a dot to steer. Green = keep current speed & heading.'));
          }
          controls.append(h('button', {
            class: 'btn btn-ghost', onclick: () => {
              state.path = [track.start.slice()]; st.cur = state.path; api.persist(); draw(); renderControls();
            },
          }, '↺ Restart run'));
          return;
        }
        // Not driving. Offer whatever actions make sense — forgiving to refresh/role ambiguity.
        const canStart = !api.session.raced && runs.length < 2;
        if (canStart) {
          controls.append(h('button', {
            class: 'btn btn-primary big', onclick: () => {
              state.path = [track.start.slice()]; st.cur = state.path;
              api.persist(); draw(); renderControls();
            },
          }, runs.length ? '🏎️ Start your run' : '🏎️ Start driving'));
        }
        if (runs.length >= 1) {
          controls.append(h('button', {
            class: 'btn ' + (canStart ? 'btn-ghost' : 'btn-primary big'),
            onclick: () => api.share('Beat my time! 🏁'),
          }, navigator.share ? '📩 Send to opponent' : '🔗 Copy link'));
        }
        controls.append(rematchRow());
      }
      function racingNow() { return state.path && !raceFinished(track, state.path) && !api.session.raced; }
      function rematchRow() {
        const row = h('div', { class: 'btn-row' });
        row.append(h('button', { class: 'btn', onclick: () => api.newGame(makeTrack, 'same') }, '🔁 Same track'));
        row.append(h('button', { class: 'btn', onclick: () => api.newGame(makeTrack, 'new') }, '🆕 New track'));
        return row;
      }

      // initial paint (defer to get layout width)
      requestAnimationFrame(() => { draw(); renderControls(); });
      if (api.onResize) api.onResize(() => { draw(); });
    },
  };

  /* =====================================================================
     FLAPPY DUEL (beat-my-score, seeded pipes so both face the same course)
     ===================================================================== */
  const FL = {
    W: 320, H: 480, birdX: 96, r: 13,
    grav: 1250, flap: -420, speed: 140, sp: 180, pw: 52, gap: 160,
    gmargin: 126, firstX: 360,
  };
  function flappyGaps(seed) {
    const rnd = root.UI.mulberry32((seed ^ 0x9e37) >>> 0);
    const gaps = [];
    for (let i = 0; i < 600; i++) gaps.push(FL.gmargin + rnd() * (FL.H - 2 * FL.gmargin));
    return gaps;
  }
  const flappy = {
    id: 'flappy', name: 'Flappy Duel', emoji: '🐤', mode: 'duel', tagLabel: 'Score duel',
    blurb: 'Flap through the pipes. Same pipes for both of you — highest score wins.',
    flappyGaps, FL,
    paint(rootEl, api) {
      const st = api.state;
      const runs = st.st || [];
      const best = runs.length ? Math.max(...runs.map((r) => r.n)) : null;
      const raced = api.session.raced;
      const canPlay = !raced && runs.length < 2;

      // ---- header / standings / message ----
      const info = h('div', { class: 'race-hud' });
      if (runs.length) {
        const board = h('div', { class: 'standings' });
        runs.forEach((r, i) => board.append(h('div', { class: 'stand' + (r.n === best ? ' lead' : '') },
          h('span', { class: 'stand-name' }, (r.n === best ? '🏆 ' : '') + (r.label || ('Run ' + (i + 1)))),
          h('span', { class: 'stand-time' }, r.n + ' pts'))));
        info.append(board);
      }
      let msg = '';
      if (canPlay && runs.length === 0) msg = 'Tap to flap. Rack up a score, then challenge someone to beat it.';
      else if (canPlay && runs.length >= 1) msg = 'Your opponent scored ' + best + '. Beat it!';
      else if (raced && runs.length < 2) msg = 'You scored ' + runs[runs.length - 1].n + '! Send it and dare your opponent to beat it.';
      else if (raced && runs.length >= 2) {
        const mine = runs[runs.length - 1].n, other = Math.max(...runs.slice(0, -1).map((r) => r.n));
        msg = mine > other ? '🏆 You win — ' + mine + ' vs ' + other + '!' :
          mine < other ? 'Your opponent takes it — ' + mine + ' vs ' + other + '. Rematch?' :
            'Dead heat — ' + mine + ' each!';
      } else msg = '🏁 Highest score wins. Run it back?';
      info.append(h('div', { class: 'race-msg' }, msg));
      rootEl.append(info);

      const controls = h('div', { class: 'race-controls' });

      if (!canPlay) {
        rootEl.append(controls);
        if (runs.length >= 1) controls.append(h('button', {
          class: 'btn btn-primary big', onclick: () => api.share('Beat my score! 🐤'),
        }, navigator.share ? '📩 Send to opponent' : '🔗 Copy link'));
        controls.append(rematchRow());
        return;
      }

      // ---- live game ----
      const wrap = h('div', { class: 'race-canvas-wrap' });
      const canvas = h('canvas', { class: 'race-canvas flappy-canvas' });
      wrap.append(canvas); rootEl.append(wrap); rootEl.append(controls);
      controls.append(h('div', { class: 'hint' }, 'Tap the screen to flap. Clear as many pipes as you can.'));

      const gaps = flappyGaps(st.seed);
      const g = { y: FL.H / 2, v: 0, dist: 0, score: 0, started: false, dead: false, done: false };
      let raf = null, last = null, acc = 0, finalized = false;

      function flap() {
        if (g.dead) return;
        if (!g.started) g.started = true;
        g.v = FL.flap;
      }
      canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });

      function step(dt) {
        if (!g.started || g.dead) return;
        g.v += FL.grav * dt; g.y += g.v * dt; g.dist += FL.speed * dt;
        if (g.y - FL.r < 0) { g.y = FL.r; g.v = 0; }                 // bump ceiling
        if (g.y + FL.r > FL.H) { g.y = FL.H - FL.r; return die(); }  // hit ground
        // scoring: advance past cleared pipes
        while (true) {
          const lx = FL.firstX + g.score * FL.sp - g.dist;
          if (lx + FL.pw < FL.birdX) g.score++; else break;
        }
        // collision with nearby pipes
        for (let i = Math.max(0, g.score - 1); i <= g.score + 2; i++) {
          const lx = FL.firstX + i * FL.sp - g.dist;
          if (FL.birdX + FL.r > lx && FL.birdX - FL.r < lx + FL.pw) {
            const gy = gaps[i], top = gy - FL.gap / 2, bot = gy + FL.gap / 2;
            if (g.y - FL.r < top || g.y + FL.r > bot) return die();
          }
        }
      }
      function die() {
        if (g.dead) return; g.dead = true;
        setTimeout(() => {
          if (finalized) return; finalized = true;
          if (!canvas.isConnected) return;
          runs.push({ n: g.score, label: 'Run ' + (runs.length + 1) });
          st.st = runs; api.session.raced = true; api.persist(); api.rerender();
        }, 850);
      }

      function render() {
        const cssW = wrap.clientWidth || 320;
        const scale = cssW / FL.W, cssH = FL.H * scale;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = cssW * dpr; canvas.height = cssH * dpr;
        canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
        // sky
        const sky = ctx.createLinearGradient(0, 0, 0, FL.H);
        sky.addColorStop(0, '#1d2b52'); sky.addColorStop(1, '#26406e');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, FL.W, FL.H);
        // pipes
        for (let i = 0; i < 600; i++) {
          const lx = FL.firstX + i * FL.sp - g.dist;
          if (lx > FL.W) break; if (lx + FL.pw < 0) continue;
          const gy = gaps[i], top = gy - FL.gap / 2, bot = gy + FL.gap / 2;
          ctx.fillStyle = '#57c760'; ctx.strokeStyle = '#3c9a45'; ctx.lineWidth = 3;
          ctx.fillRect(lx, 0, FL.pw, top); ctx.strokeRect(lx, 0, FL.pw, top);
          ctx.fillRect(lx, bot, FL.pw, FL.H - bot); ctx.strokeRect(lx, bot, FL.pw, FL.H - bot);
          ctx.fillStyle = '#6bd674';
          ctx.fillRect(lx - 3, top - 14, FL.pw + 6, 14); ctx.fillRect(lx - 3, bot, FL.pw + 6, 14);
        }
        // ground
        ctx.fillStyle = '#3a5a3f'; ctx.fillRect(0, FL.H - 6, FL.W, 6);
        // bird
        ctx.save(); ctx.translate(FL.birdX, g.y);
        const ang = Math.max(-0.5, Math.min(1.1, g.v / 600)); ctx.rotate(ang);
        ctx.fillStyle = '#f6d032'; ctx.beginPath(); ctx.arc(0, 0, FL.r, 0, 7); ctx.fill();
        ctx.strokeStyle = '#c8a51f'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(5, -4, 4, 0, 7); ctx.fill();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(6, -4, 1.8, 0, 7); ctx.fill();
        ctx.fillStyle = '#f39b2e'; ctx.beginPath(); ctx.moveTo(FL.r - 2, 0); ctx.lineTo(FL.r + 7, -3); ctx.lineTo(FL.r + 7, 3); ctx.fill();
        ctx.restore();
        // score
        ctx.fillStyle = '#fff'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(String(g.score), FL.W / 2, 16);
        if (best != null) { ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText('Target ' + best, FL.W / 2, 62); }
        if (!g.started) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 22px sans-serif'; ctx.textBaseline = 'middle';
          ctx.fillText('Tap to flap!', FL.W / 2, FL.H * 0.62);
        }
        if (g.dead) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, FL.W, FL.H);
          ctx.fillStyle = '#fff'; ctx.font = 'bold 30px sans-serif'; ctx.textBaseline = 'middle';
          ctx.fillText('💥  Score ' + g.score, FL.W / 2, FL.H / 2);
        }
      }

      function frame(now) {
        if (!canvas.isConnected) { if (raf) cancelAnimationFrame(raf); return; }
        if (last === null) last = now;
        let el = (now - last) / 1000; last = now; if (el > 0.1) el = 0.1; acc += el;
        while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
        render();
        raf = requestAnimationFrame(frame);
      }
      requestAnimationFrame(() => { render(); raf = requestAnimationFrame(frame); });
      if (api.onResize) api.onResize(() => render());

      function rematchRow() {
        const row = h('div', { class: 'btn-row' });
        row.append(h('button', { class: 'btn', onclick: () => api.newGame(null, 'same') }, '🔁 Same pipes'));
        row.append(h('button', { class: 'btn', onclick: () => api.newGame(null, 'new') }, '🆕 New pipes'));
        return row;
      }
    },
  };

  /* =====================================================================
     GARAGE DRAFT (snake-draft cars, then simulate a season of events)
     Stats are hidden during the draft — you pick on car knowledge alone —
     and revealed in the results. Everything is a deterministic function of
     the picks, so both players see identical outcomes from the shared link.
     ===================================================================== */
  const DRAFT = { team: 5 };
  const CAR_EMOJI = {
    Hypercar: '🏎️', Supercar: '🏎️', Sports: '🚗', Muscle: '🔥', Truck: '🛻',
    'Off-road': '⛰️', 'Super SUV': '🚙', EV: '⚡', Economy: '🚘', 'Hot Hatch': '🚗',
    Rally: '🏁', Wagon: '🚙',
  };
  // [name, class, SPD, ACC, HND, TOW, OFF, MPG]  (each 0–99)
  const CARS = [
    ['Bugatti Chiron', 'Hypercar', 99, 96, 82, 5, 5, 10],
    ['Koenigsegg Jesko', 'Hypercar', 99, 98, 86, 5, 5, 12],
    ['Rimac Nevera', 'Hypercar', 97, 99, 85, 10, 10, 90],
    ['Ferrari SF90', 'Supercar', 92, 97, 90, 5, 8, 30],
    ['Lamborghini Huracán', 'Supercar', 93, 94, 89, 5, 8, 18],
    ['McLaren 720S', 'Supercar', 94, 95, 92, 5, 6, 22],
    ['Porsche 911 Turbo S', 'Supercar', 90, 95, 93, 20, 15, 28],
    ['Chevrolet Corvette C8', 'Sports', 88, 90, 88, 12, 12, 40],
    ['Nissan GT-R', 'Sports', 88, 92, 87, 10, 10, 32],
    ['Toyota GR Supra', 'Sports', 78, 82, 84, 10, 12, 45],
    ['Porsche 718 Cayman GT4', 'Sports', 82, 84, 94, 10, 12, 42],
    ['Mazda MX-5 Miata', 'Sports', 55, 58, 90, 8, 12, 62],
    ['Subaru BRZ', 'Sports', 62, 66, 85, 8, 14, 55],
    ['Dodge Challenger Hellcat', 'Muscle', 86, 90, 68, 25, 12, 20],
    ['Chevrolet Camaro ZL1', 'Muscle', 84, 88, 82, 22, 12, 30],
    ['Ford Mustang GT', 'Muscle', 80, 84, 76, 20, 14, 38],
    ['Dodge Charger Hellcat', 'Muscle', 85, 88, 66, 30, 14, 22],
    ['Ford F-150 Raptor', 'Truck', 60, 66, 55, 78, 95, 28],
    ['Ram 1500 TRX', 'Truck', 68, 78, 58, 82, 92, 20],
    ['Chevrolet Silverado HD', 'Truck', 55, 52, 50, 95, 65, 26],
    ['Ford F-250 Super Duty', 'Truck', 50, 45, 45, 99, 72, 22],
    ['Toyota Tacoma TRD', 'Truck', 52, 55, 58, 60, 88, 40],
    ['GMC Hummer EV', 'Truck', 62, 90, 50, 75, 90, 55],
    ['Jeep Wrangler Rubicon', 'Off-road', 48, 52, 55, 45, 97, 38],
    ['Ford Bronco', 'Off-road', 55, 60, 60, 50, 90, 40],
    ['Land Rover Defender', 'Off-road', 62, 66, 64, 65, 88, 42],
    ['Toyota Land Cruiser', 'Off-road', 60, 60, 60, 72, 90, 38],
    ['Mercedes-AMG G63', 'Off-road', 72, 82, 62, 65, 85, 22],
    ['Lamborghini Urus', 'Super SUV', 85, 88, 80, 55, 55, 30],
    ['Porsche Cayenne Turbo', 'Super SUV', 82, 84, 82, 60, 55, 32],
    ['Tesla Model S Plaid', 'EV', 90, 99, 80, 40, 20, 95],
    ['Tesla Model 3', 'EV', 72, 82, 78, 20, 18, 96],
    ['Porsche Taycan', 'EV', 84, 92, 86, 30, 20, 88],
    ['Lucid Air', 'EV', 86, 94, 80, 35, 18, 94],
    ['Toyota Prius', 'Economy', 40, 42, 50, 10, 15, 99],
    ['Honda Civic', 'Economy', 50, 52, 66, 12, 18, 85],
    ['Toyota Corolla', 'Economy', 44, 46, 58, 12, 18, 88],
    ['Volkswagen Golf GTI', 'Hot Hatch', 68, 74, 80, 15, 20, 60],
    ['Subaru WRX STI', 'Rally', 70, 78, 82, 20, 45, 42],
    ['Audi RS6 Avant', 'Wagon', 84, 90, 84, 45, 25, 35],
  ];
  const STAT_ABBR = ['SPD', 'ACC', 'HND', 'TOW', 'OFF', 'MPG'];
  const DRAFT_EVENTS = [
    { name: 'Top Speed Shootout', emoji: '🏁', stat: 0, mode: 'best', tag: 'fastest car' },
    { name: 'Drag Race', emoji: '⚡', stat: 1, mode: 'best', tag: 'quickest car' },
    { name: 'Tow-Off', emoji: '🚚', stat: 3, mode: 'best', tag: 'biggest hauler' },
    { name: 'Off-Road Trial', emoji: '⛰️', stat: 4, mode: 'best', tag: 'best rig' },
    { name: 'Canyon Carving', emoji: '🌀', stat: 2, mode: 'avg', tag: 'team handling avg' },
    { name: 'Economy Run', emoji: '⛽', stat: 5, mode: 'avg', tag: 'team MPG avg' },
    { name: 'Grand Prix', emoji: '🏆', mode: 'gp', tag: 'all-round avg' },
  ];
  function carStat(ci, s) { return CARS[ci][2 + s]; }
  function gpComposite(ci) { return 0.4 * carStat(ci, 0) + 0.35 * carStat(ci, 1) + 0.25 * carStat(ci, 2); }
  function draftPicker(k, f) { const pair = Math.floor(k / 2); const first = (pair % 2 === 0) ? f : 1 - f; return (k % 2 === 0) ? first : 1 - first; }
  function draftHash(m) { let x = 2166136261; for (const v of m) { x ^= (v + 1); x = Math.imul(x, 16777619); } return x >>> 0; }
  function teamScore(team, ev) {
    if (ev.mode === 'best') {
      let best = -1, car = -1;
      for (const ci of team) { const v = carStat(ci, ev.stat); if (v > best) { best = v; car = ci; } }
      return { score: best, car };
    }
    if (ev.mode === 'avg') {
      let sum = 0; for (const ci of team) sum += carStat(ci, ev.stat);
      return { score: team.length ? sum / team.length : 0 };
    }
    let sum = 0, best = -1, car = -1;
    for (const ci of team) { const c = gpComposite(ci); sum += c; if (c > best) { best = c; car = ci; } }
    return { score: team.length ? sum / team.length : 0, car };
  }
  function computeResults(teams, m) {
    const rnd = root.UI.mulberry32(draftHash(m));
    const events = DRAFT_EVENTS.map((ev) => {
      const a = teamScore(teams[0], ev), b = teamScore(teams[1], ev);
      const fa = a.score + (rnd() * 5 - 2.5), fb = b.score + (rnd() * 5 - 2.5); // small sim variance
      const winner = Math.abs(fa - fb) < 0.01 ? null : (fa > fb ? 0 : 1);
      return { ev, a, b, fa, fb, winner };
    });
    let w0 = 0, w1 = 0, t0 = 0, t1 = 0;
    for (const e of events) { if (e.winner === 0) w0++; else if (e.winner === 1) w1++; t0 += e.fa; t1 += e.fb; }
    const winner = w0 > w1 ? 0 : w1 > w0 ? 1 : (t0 > t1 ? 0 : t1 > t0 ? 1 : null);
    return { events, w0, w1, winner };
  }
  function draftView(m, f) {
    const total = DRAFT.team * 2;
    const teams = [[], []];
    for (let k = 0; k < m.length; k++) teams[draftPicker(k, f)].push(m[k]);
    const over = m.length >= total;
    const results = over ? computeResults(teams, m) : null;
    return {
      teams, over, results, total, TEAM: DRAFT.team, pickNo: m.length,
      turn: over ? null : draftPicker(m.length, f),
      lastMover: m.length ? draftPicker(m.length - 1, f) : null,
      winner: results ? results.winner : null,
    };
  }
  function draftLegal(m, f, idx) {
    return !draftView(m, f).over && idx >= 0 && idx < CARS.length && m.indexOf(idx) === -1;
  }
  const draft = {
    id: 'draft', name: 'Garage Draft', emoji: '🏆', mode: 'turns', tagLabel: 'Draft + sim',
    blurb: 'Snake-draft real cars, then a sim runs races, tow-offs & more. Best garage wins.',
    colors: ['#4c86f4', '#f4544c'], pieceLabel: ['Team Blue', 'Team Red'],
    view: draftView, legal: draftLegal, CARS, DRAFT_EVENTS, computeResults, draftPicker,
    paint(rootEl, api) {
      const v = api.view, me = api.me;
      const cont = h('div', { class: 'draft' });
      if (!v.over) this.paintDraft(cont, api, v, me);
      else this.paintResults(cont, api, v, me);
      rootEl.append(cont);
    },
    paintDraft(cont, api, v, me) {
      const round = Math.floor(v.pickNo / 2) + 1;
      cont.append(h('div', { class: 'draft-head' },
        h('span', {}, 'Pick ' + (v.pickNo + 1) + ' / ' + v.total),
        h('span', {}, 'Round ' + round + ' of ' + v.TEAM)));

      // rosters
      const rost = h('div', { class: 'draft-rosters' });
      [0, 1].forEach((p) => {
        const col = h('div', { class: 'roster' + (p === me ? ' you' : '') });
        col.style.borderColor = this.colors[p];
        col.append(h('div', { class: 'roster-title' },
          (p === me ? 'You · ' : '') + this.pieceLabel[p], h('span', { class: 'roster-count' }, v.teams[p].length + '/' + v.TEAM)));
        if (!v.teams[p].length) col.append(h('div', { class: 'roster-empty' }, 'No picks yet'));
        v.teams[p].forEach((ci) => col.append(h('div', { class: 'chip' },
          CAR_EMOJI[CARS[ci][1]] + ' ' + CARS[ci][0])));
        rost.append(col);
      });
      cont.append(rost);

      // available pool (no numbers — knowledge test)
      const taken = new Set(api.m);
      cont.append(h('div', { class: 'pool-head' }, api.canPlay ? '🔎 Draft a car' : 'Pool (waiting…)'));
      const pool = h('div', { class: 'pool' });
      for (let ci = 0; ci < CARS.length; ci++) {
        if (taken.has(ci)) continue;
        const c = CARS[ci];
        const item = h('button', {
          class: 'pool-item' + (api.canPlay ? ' live' : ''),
          disabled: api.canPlay ? null : 'disabled',
          onclick: api.canPlay ? () => api.play(ci) : null,
        },
          h('span', { class: 'car-emoji' }, CAR_EMOJI[c[1]]),
          h('span', { class: 'car-main' },
            h('span', { class: 'car-name' }, c[0]),
            h('span', { class: 'car-class' }, c[1])));
        pool.append(item);
      }
      cont.append(pool);
    },
    paintResults(cont, api, v, me) {
      const r = v.results;
      const myWins = me === 0 ? r.w0 : r.w1, oppWins = me === 0 ? r.w1 : r.w0;
      const verdict = r.winner == null ? '🤝 It’s a tie' : r.winner === me ? '🏆 You win the season!' : '😤 Opponent wins the season';
      cont.append(h('div', { class: 'result-banner' },
        h('div', { class: 'result-verdict' }, verdict),
        h('div', { class: 'result-score' }, 'You ' + myWins + ' — ' + oppWins + ' Them')));

      // event-by-event
      const evwrap = h('div', { class: 'events' });
      r.events.forEach((e) => {
        const aVal = e.ev.mode === 'best' ? String(carStat(e.a.car, e.ev.stat)) : e.a.score.toFixed(1);
        const bVal = e.ev.mode === 'best' ? String(carStat(e.b.car, e.ev.stat)) : e.b.score.toFixed(1);
        const aCar = (e.ev.mode !== 'avg' && e.a.car != null && e.a.car >= 0) ? CARS[e.a.car][0] : e.ev.tag;
        const bCar = (e.ev.mode !== 'avg' && e.b.car != null && e.b.car >= 0) ? CARS[e.b.car][0] : e.ev.tag;
        // map absolute team index 0/1 to your/opp columns (left = you)
        const left = me, rightP = 1 - me;
        const val = (p) => p === 0 ? aVal : bVal;
        const car = (p) => p === 0 ? aCar : bCar;
        const winP = e.winner; // 0/1 absolute
        evwrap.append(h('div', { class: 'event-card' },
          h('div', { class: 'event-title' }, e.ev.emoji + ' ' + e.ev.name),
          h('div', { class: 'event-vs' },
            h('div', { class: 'side' + (winP === left ? ' win' : '') + (winP == null ? ' tie' : '') },
              h('span', { class: 'side-val' }, val(left)),
              h('span', { class: 'side-car' }, car(left))),
            h('div', { class: 'vs' }, winP === left ? '◀' : winP === rightP ? '▶' : '='),
            h('div', { class: 'side right' + (winP === rightP ? ' win' : '') + (winP == null ? ' tie' : '') },
              h('span', { class: 'side-val' }, val(rightP)),
              h('span', { class: 'side-car' }, car(rightP))))));
      });
      cont.append(evwrap);

      // full stat sheets (the reveal)
      cont.append(h('div', { class: 'pool-head' }, '📋 The stat sheets'));
      [me, 1 - me].forEach((p) => {
        const tbl = h('table', { class: 'statsheet' });
        const head = h('tr', {}, h('th', { class: 'sh-name' }, (p === me ? 'Your' : 'Their') + ' garage'));
        STAT_ABBR.forEach((s) => head.append(h('th', {}, s)));
        tbl.append(head);
        v.teams[p].forEach((ci) => {
          const row = h('tr', {}, h('td', { class: 'sh-name' }, CAR_EMOJI[CARS[ci][1]] + ' ' + CARS[ci][0]));
          for (let s = 0; s < 6; s++) {
            const val = carStat(ci, s);
            const td = h('td', {}, String(val));
            td.style.color = val >= 85 ? '#7ee0a1' : val <= 30 ? '#ff9f8a' : '';
            row.append(td);
          }
          tbl.append(row);
        });
        const wrap = h('div', { class: 'sheet-wrap' });
        wrap.append(h('div', { class: 'sheet-label' }, (p === me ? 'You · ' : '') + this.pieceLabel[p]));
        wrap.append(tbl);
        cont.append(wrap);
      });
    },
  };

  root.GAMES = [grandprix, flappy, draft, hex, connect4, gomoku];

  // exports for node tests
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      c4View, c4Legal, goView, goLegal, hexView, hexLegal, hexNeighbors, hexWinner,
      makeTrack, onTrack, segmentOnTrack, raceLegalNext, raceFinished, RACE,
      flappyGaps, FL,
      draftView, draftLegal, draftPicker, computeResults, CARS, DRAFT, DRAFT_EVENTS,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
