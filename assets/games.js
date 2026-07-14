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
  // Compact racing-line codec. A run can be 100+ points; stored as JSON arrays
  // ([[x,y],...]) two finished runs blow the shared link past ~2.5k chars, and
  // long links get truncated by SMS/chat apps — the truncated hash then fails to
  // decode and the opponent lands on the menu instead of the race. Every track
  // coordinate is < 64 (tracks top out ~17×29), so pack each point as two chars
  // from a URL-safe alphabet: ~4x smaller than JSON, and reversible.
  const RACE_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function packPath(pts) {
    let s = '';
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0], y = pts[i][1];
      if (x < 0 || x > 63 || y < 0 || y > 63) return null; // out of range — signal "store raw"
      s += RACE_ALPHA[x] + RACE_ALPHA[y];
    }
    return s;
  }
  function unpackPath(s) {
    const pts = [];
    if (typeof s !== 'string') return pts;
    for (let i = 0; i + 1 < s.length; i += 2) pts.push([RACE_ALPHA.indexOf(s[i]), RACE_ALPHA.indexOf(s[i + 1])]);
    return pts;
  }
  // Read a stored run in either the compact ({n,p}) or legacy ({n,path,label}) shape.
  function runPath(r) { return r.path ? r.path : unpackPath(r.p); }

  const grandprix = {
    id: 'grandprix', name: 'Grand Prix', emoji: '🏁', mode: 'duel', tagLabel: 'Race duel',
    blurb: 'Vector racing. You each drive the same track solo — fewest moves wins.',
    makeTrack, onTrack, segmentOnTrack, raceLegalNext, raceFinished,
    packPath, unpackPath,
    startPath(track) { return [track.start.slice()]; },
    paint(rootEl, api) {
      const st = api.state;
      const track = makeTrack(st.seed);
      // Display list derived from the compact stored runs (st.st stays serialized-small).
      const runs = (st.st || []).map((r, i) => ({ n: r.n, label: r.label || ('Run ' + (i + 1)), path: runPath(r) }));
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
        const packed = packPath(state.path);
        const stored = st.st || (st.st = []);
        // Compact form keeps the shared link short; fall back to raw points if a
        // coordinate ever falls outside the codec's range (shouldn't happen).
        stored.push(packed != null ? { n: turns, p: packed } : { n: turns, path: state.path });
        st.cur = null;
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
  const ERAS = { Classic: '🕰️', Retro: '📼', Modern: '⚡' };
  // The 5 squad "positions" — each is a head-to-head event decided by one stat.
  const POSITIONS = [
    { name: 'Speed', emoji: '🏁', stat: 0, event: 'Top Speed Shootout' },
    { name: 'Launch', emoji: '⚡', stat: 1, event: 'Drag Race' },
    { name: 'Corners', emoji: '🌀', stat: 2, event: 'Canyon Carving' },
    { name: 'Hauler', emoji: '🚚', stat: 3, event: 'Tow-Off' },
    { name: 'Trail', emoji: '⛰️', stat: 4, event: 'Off-Road Trial' },
  ];
  const STAT_ABBR = ['SPD', 'ACC', 'HND', 'TOW', 'OFF'];
  // [name, brand, era, SPD, ACC, HND, TOW, OFF]  (each 0–99)
  const CARS = [
    ['Ferrari F40', 'Ferrari', 'Classic', 92, 88, 84, 5, 5],
    ['Lamborghini Countach', 'Lamborghini', 'Classic', 88, 80, 72, 5, 6],
    ['Porsche 911 Carrera 3.2', 'Porsche', 'Classic', 72, 70, 82, 12, 15],
    ['Ford Mustang Boss 302', 'Ford', 'Classic', 74, 78, 60, 20, 12],
    ['Chevrolet Corvette Sting Ray', 'Chevrolet', 'Classic', 70, 72, 66, 12, 10],
    ['Dodge Charger R/T', 'Dodge', 'Classic', 76, 80, 55, 28, 14],
    ['Shelby Cobra 427', 'Shelby', 'Classic', 80, 88, 70, 8, 8],
    ['Toyota Land Cruiser FJ40', 'Toyota', 'Classic', 40, 42, 45, 60, 92],
    ['Jeep CJ-5', 'Jeep', 'Classic', 38, 40, 42, 40, 90],
    ['Datsun 240Z', 'Datsun', 'Classic', 66, 68, 78, 10, 14],
    ['Lancia Stratos', 'Lancia', 'Classic', 74, 80, 86, 5, 40],
    ['BMW M3 E30', 'BMW', 'Classic', 70, 72, 88, 12, 16],
    ['Mercedes 300SL', 'Mercedes', 'Classic', 68, 62, 66, 12, 12],
    ['Land Rover Series III', 'Land Rover', 'Classic', 35, 36, 44, 55, 88],
    ['Volkswagen Beetle', 'Volkswagen', 'Classic', 30, 34, 50, 8, 30],
    ['Ford F-100', 'Ford', 'Classic', 45, 44, 40, 70, 55],
    ['McLaren F1', 'McLaren', 'Retro', 98, 92, 88, 5, 5],
    ['Ferrari F50', 'Ferrari', 'Retro', 90, 90, 86, 5, 6],
    ['Lamborghini Diablo', 'Lamborghini', 'Retro', 90, 86, 76, 5, 8],
    ['Porsche 911 GT2 (996)', 'Porsche', 'Retro', 88, 88, 90, 12, 14],
    ['Nissan Skyline GT-R R34', 'Nissan', 'Retro', 82, 86, 88, 12, 16],
    ['Toyota Supra Mk4', 'Toyota', 'Retro', 84, 86, 82, 12, 12],
    ['Mazda RX-7 FD', 'Mazda', 'Retro', 78, 80, 88, 8, 12],
    ['Honda NSX', 'Honda', 'Retro', 80, 82, 90, 8, 12],
    ['Dodge Viper GTS', 'Dodge', 'Retro', 88, 90, 78, 15, 10],
    ['Subaru Impreza 22B', 'Subaru', 'Retro', 72, 80, 86, 18, 55],
    ['Ford SVT Lightning', 'Ford', 'Retro', 68, 76, 55, 75, 40],
    ['Hummer H1', 'Hummer', 'Retro', 40, 44, 40, 80, 96],
    ['Jeep Grand Cherokee', 'Jeep', 'Retro', 55, 55, 55, 65, 80],
    ['BMW M5 E39', 'BMW', 'Retro', 80, 82, 84, 30, 18],
    ['Chevrolet Corvette C5 Z06', 'Chevrolet', 'Retro', 86, 86, 84, 15, 12],
    ['Toyota Tacoma', 'Toyota', 'Retro', 48, 50, 52, 60, 82],
    ['Bugatti Chiron', 'Bugatti', 'Modern', 99, 96, 82, 5, 5],
    ['Koenigsegg Jesko', 'Koenigsegg', 'Modern', 99, 98, 86, 5, 5],
    ['Ferrari SF90', 'Ferrari', 'Modern', 92, 97, 90, 5, 8],
    ['Lamborghini Huracán', 'Lamborghini', 'Modern', 93, 94, 89, 5, 8],
    ['McLaren 720S', 'McLaren', 'Modern', 94, 95, 92, 5, 6],
    ['Porsche 911 Turbo S', 'Porsche', 'Modern', 90, 95, 93, 20, 15],
    ['Chevrolet Corvette C8', 'Chevrolet', 'Modern', 88, 90, 88, 12, 12],
    ['Nissan GT-R R35', 'Nissan', 'Modern', 88, 92, 87, 10, 10],
    ['Toyota GR Supra', 'Toyota', 'Modern', 78, 82, 84, 10, 12],
    ['Dodge Challenger Hellcat', 'Dodge', 'Modern', 86, 90, 68, 25, 12],
    ['Ford Mustang GT', 'Ford', 'Modern', 80, 84, 76, 20, 14],
    ['Ford F-150 Raptor', 'Ford', 'Modern', 60, 66, 55, 78, 95],
    ['Ram 1500 TRX', 'Ram', 'Modern', 68, 78, 58, 82, 92],
    ['Ford F-250 Super Duty', 'Ford', 'Modern', 50, 45, 45, 99, 72],
    ['Jeep Wrangler Rubicon', 'Jeep', 'Modern', 48, 52, 55, 45, 97],
    ['Ford Bronco', 'Ford', 'Modern', 55, 60, 60, 50, 90],
    ['Mercedes-AMG G63', 'Mercedes', 'Modern', 72, 82, 62, 65, 85],
    ['Lamborghini Urus', 'Lamborghini', 'Modern', 85, 88, 80, 55, 55],
    ['Tesla Model S Plaid', 'Tesla', 'Modern', 90, 99, 80, 40, 20],
    ['Porsche Taycan', 'Porsche', 'Modern', 84, 92, 86, 30, 20],
    ['BMW M3 (G80)', 'BMW', 'Modern', 82, 86, 88, 25, 18],
    ['Subaru WRX STI', 'Subaru', 'Modern', 70, 78, 82, 20, 45],
  ];
  function carStat(ci, s) { return CARS[ci][3 + s]; }
  function carEmoji(ci) {
    const spd = carStat(ci, 0), hnd = carStat(ci, 2), tow = carStat(ci, 3), off = carStat(ci, 4);
    if (off >= 80) return '⛰️'; if (tow >= 75) return '🛻'; if (spd >= 92) return '🏎️'; if (hnd >= 88) return '🌀'; return '🚗';
  }
  function draftPicker(k, f) { const pair = Math.floor(k / 2); const first = (pair % 2 === 0) ? f : 1 - f; return (k % 2 === 0) ? first : 1 - first; }
  function draftHash(m) { let x = 2166136261; for (const mv of m) { x ^= (mv[0] + 1) * 7 + (mv[1] + 1); x = Math.imul(x, 16777619); } return x >>> 0; }
  // Roll a random (era × brand) that still has an available car — deterministic
  // from the shared state, so both players compute the active player's roll identically.
  function rollFor(seed, m, pend) {
    const taken = new Set(m.map((x) => x[0]));
    const groups = new Map();
    for (let ci = 0; ci < CARS.length; ci++) {
      if (taken.has(ci)) continue;
      const key = CARS[ci][2] + '§' + CARS[ci][1];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ci);
    }
    const keys = [...groups.keys()].sort();
    if (!keys.length) return null;
    const mix = (((seed >>> 0) ^ Math.imul(m.length + 1, 2654435761) ^ Math.imul(pend + 1, 40503)) >>> 0);
    const rng = root.UI.mulberry32(mix);
    const key = keys[Math.floor(rng() * keys.length)];
    const parts = key.split('§');
    return { era: parts[0], brand: parts[1], cars: groups.get(key) };
  }
  function computeResults(teams, m) {
    const slot = [{}, {}];
    for (const p of [0, 1]) for (const pk of teams[p]) slot[p][pk.pos] = pk.car;
    const rng = root.UI.mulberry32((draftHash(m) ^ 0xabcdef) >>> 0);
    const events = POSITIONS.map((pos, pi) => {
      const ca = slot[0][pi], cb = slot[1][pi];
      const a = ca != null ? carStat(ca, pos.stat) : 0;
      const b = cb != null ? carStat(cb, pos.stat) : 0;
      const fa = a + (rng() * 5 - 2.5), fb = b + (rng() * 5 - 2.5);   // small sim variance
      const winner = Math.abs(fa - fb) < 0.01 ? null : (fa > fb ? 0 : 1);
      return { pos, ca, cb, a, b, winner };
    });
    let w0 = 0, w1 = 0, t0 = 0, t1 = 0;
    for (const e of events) { if (e.winner === 0) w0++; else if (e.winner === 1) w1++; t0 += e.a; t1 += e.b; }
    const winner = w0 > w1 ? 0 : w1 > w0 ? 1 : (t0 > t1 ? 0 : t1 > t0 ? 1 : null);
    return { events, w0, w1, winner };
  }
  function draftView(m, f, st) {
    st = st || {};
    const seed = st.seed || 0, used = st.used || [false, false], pend = st.pend || 0;
    const teams = [[], []], usedPos = [new Set(), new Set()];
    for (let k = 0; k < m.length; k++) { const p = draftPicker(k, f); teams[p].push({ car: m[k][0], pos: m[k][1] }); usedPos[p].add(m[k][1]); }
    const over = m.length >= DRAFT.team * 2;
    const turn = over ? null : draftPicker(m.length, f);
    const roll = over ? null : rollFor(seed, m, pend);
    const results = over ? computeResults(teams, m) : null;
    return {
      teams, usedPos, over, turn, roll, pend,
      retoolUsed: used, retoolAvail: !over && turn != null && !used[turn],
      lastMover: m.length ? draftPicker(m.length - 1, f) : null,
      pickNo: m.length, total: DRAFT.team * 2, TEAM: DRAFT.team,
      winner: results ? results.winner : null, results,
    };
  }
  function draftLegal() { return false; } // draft uses api.act (roll/retool/pick), not generic play
  const draft = {
    id: 'draft', name: 'Garage Draft', emoji: '🏆', mode: 'turns', tagLabel: 'Roll & draft',
    blurb: 'Roll an era + brand, draft a car into a position. Build a 5-car squad, then they battle head-to-head.',
    colors: ['#4c86f4', '#f4544c'], pieceLabel: ['Team Blue', 'Team Red'],
    view: draftView, legal: draftLegal, CARS, POSITIONS, ERAS, computeResults, draftPicker, rollFor,
    newTurnState(f) {
      const seed = (Math.floor(Math.random() * 1e9)) >>> 0;
      return { g: 'draft', v: 2, f, seed, m: [], used: [false, false], pend: 0 };
    },
    squadStrip(v, p, me) {
      const wrap = h('div', { class: 'roster' + (p === me ? ' you' : '') });
      wrap.style.borderColor = this.colors[p];
      wrap.append(h('div', { class: 'roster-title' }, (p === me ? 'You · ' : '') + this.pieceLabel[p],
        h('span', { class: 'roster-count' }, v.teams[p].length + '/' + v.TEAM)));
      POSITIONS.forEach((pos, pi) => {
        const pk = v.teams[p].find((x) => x.pos === pi);
        wrap.append(h('div', { class: 'slot' + (pk ? ' filled' : '') },
          h('span', { class: 'slot-pos' }, pos.emoji + ' ' + pos.name),
          h('span', { class: 'slot-car' }, pk ? (carEmoji(pk.car) + ' ' + CARS[pk.car][0]) : '—')));
      });
      return wrap;
    },
    paint(rootEl, api) {
      const v = api.view, me = api.me;
      const cont = h('div', { class: 'draft' });
      if (!v.over) this.paintDraft(cont, api, v, me);
      else this.paintResults(cont, api, v, me);
      rootEl.append(cont);
    },
    paintDraft(cont, api, v, me) {
      cont.append(h('div', { class: 'draft-head' },
        h('span', {}, 'Pick ' + (v.pickNo + 1) + ' / ' + v.total),
        h('span', {}, 'Round ' + (Math.floor(v.pickNo / 2) + 1) + ' of ' + v.TEAM)));
      const rost = h('div', { class: 'draft-rosters' });
      rost.append(this.squadStrip(v, me, me), this.squadStrip(v, 1 - me, me));
      cont.append(rost);

      if (!api.canPlay) { cont.append(h('div', { class: 'pool-head' }, '⏳ Waiting for opponent’s pick…')); return; }

      const roll = v.roll;
      const banner = h('div', { class: 'roll-banner' },
        h('div', { class: 'roll-line' },
          h('span', { class: 'roll-era' }, (ERAS[roll.era] || '') + ' ' + roll.era),
          h('span', { class: 'roll-x' }, '×'),
          h('span', { class: 'roll-brand' }, roll.brand)));
      if (v.retoolAvail) {
        banner.append(h('button', {
          class: 'btn retool-btn',
          onclick: () => api.act((st) => { st.used = (st.used || [false, false]).slice(); st.used[me] = true; st.pend = 1; }),
        }, '🔄 Retool (your one re-roll)'));
      } else if (v.retoolUsed[me]) {
        banner.append(h('div', { class: 'retool-spent' }, 'Retool used'));
      }
      cont.append(h('div', { class: 'pool-head' }, '🎲 Your roll — draft one car:'));
      cont.append(banner);

      const pickArea = h('div', { class: 'pool' });
      cont.append(pickArea);
      let sel = null;
      const redraw = () => {
        clear(pickArea);
        roll.cars.forEach((ci) => {
          const chosen = sel === ci;
          const item = h('button', { class: 'pool-item live' + (chosen ? ' sel' : '') },
            h('span', { class: 'car-emoji' }, carEmoji(ci)),
            h('span', { class: 'car-main' },
              h('span', { class: 'car-name' }, CARS[ci][0]),
              h('span', { class: 'car-class' }, CARS[ci][2] + ' · ' + CARS[ci][1])));
          item.addEventListener('click', () => { sel = chosen ? null : ci; redraw(); });
          pickArea.append(item);
          if (chosen) {
            const row = h('div', { class: 'pos-row' });
            POSITIONS.forEach((pos, pi) => {
              if (v.usedPos[me].has(pi)) return;
              row.append(h('button', {
                class: 'btn pos-btn',
                onclick: () => api.act((st) => { st.m = st.m.concat([[ci, pi]]); st.pend = 0; }),
              }, pos.emoji + ' ' + pos.name));
            });
            pickArea.append(h('div', { class: 'pos-choose' }, h('div', { class: 'pos-choose-label' }, 'Slot into:'), row));
          }
        });
      };
      redraw();
    },
    paintResults(cont, api, v, me) {
      const r = v.results;
      const myWins = me === 0 ? r.w0 : r.w1, oppWins = me === 0 ? r.w1 : r.w0;
      const verdict = r.winner == null ? '🤝 It’s a tie' : r.winner === me ? '🏆 You win the season!' : '😤 Opponent wins the season';
      cont.append(h('div', { class: 'result-banner' },
        h('div', { class: 'result-verdict' }, verdict),
        h('div', { class: 'result-score' }, 'You ' + myWins + ' — ' + oppWins + ' Them')));
      const evwrap = h('div', { class: 'events' });
      r.events.forEach((e) => {
        const left = me, rightP = 1 - me;
        const carOf = (p) => p === 0 ? e.ca : e.cb;
        const valOf = (p) => p === 0 ? e.a : e.b;
        const side = (p, right) => {
          const ci = carOf(p);
          return h('div', { class: 'side' + (right ? ' right' : '') + (e.winner === p ? ' win' : '') + (e.winner == null ? ' tie' : '') },
            h('span', { class: 'side-val' }, String(valOf(p))),
            h('span', { class: 'side-car' }, ci != null ? CARS[ci][0] : '—'));
        };
        evwrap.append(h('div', { class: 'event-card' },
          h('div', { class: 'event-title' }, e.pos.emoji + ' ' + e.pos.event),
          h('div', { class: 'event-vs' }, side(left, false),
            h('div', { class: 'vs' }, e.winner === left ? '◀' : e.winner === rightP ? '▶' : '='),
            side(rightP, true))));
      });
      cont.append(evwrap);
      cont.append(h('div', { class: 'pool-head' }, '📋 The stat sheets'));
      [me, 1 - me].forEach((p) => {
        const tbl = h('table', { class: 'statsheet' });
        const head = h('tr', {}, h('th', { class: 'sh-name' }, (p === me ? 'Your' : 'Their') + ' squad'), h('th', {}, 'POS'));
        STAT_ABBR.forEach((s) => head.append(h('th', {}, s)));
        tbl.append(head);
        POSITIONS.forEach((pos, pi) => {
          const pk = v.teams[p].find((x) => x.pos === pi); if (!pk) return;
          const ci = pk.car;
          const row = h('tr', {}, h('td', { class: 'sh-name' }, carEmoji(ci) + ' ' + CARS[ci][0]), h('td', {}, pos.emoji));
          for (let s = 0; s < 5; s++) {
            const val = carStat(ci, s);
            const td = h('td', {}, String(val));
            td.style.color = val >= 85 ? '#7ee0a1' : val <= 30 ? '#ff9f8a' : '';
            if (s === pos.stat) td.style.fontWeight = '800';
            row.append(td);
          }
          tbl.append(row);
        });
        cont.append(h('div', { class: 'sheet-wrap' }, h('div', { class: 'sheet-label' }, (p === me ? 'You · ' : '') + this.pieceLabel[p]), tbl));
      });
    },
  };
  /* =====================================================================
     ICEBREAKER (move, then break a block — strand your rival to sink them)
     Each turn is two actions: (1) move your penguin one square (or stay),
     (2) break any one block on the map (never one a penguin is standing on).
     No floating blocks: a penguin whose every neighbour is broken (or the
     edge) has nothing holding it up and falls through. Trap your rival.
     ===================================================================== */
  const ICE_DIR = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // Up, Right, Down, Left
  const ICE = { N: 6, patches: 2, starts: [[2, 2], [3, 3]] }; // patches = pairs of pre-broken holes
  function iceBoardGen(seed) {
    const N = ICE.N;
    const rnd = root.UI.mulberry32((seed ^ 0x51ce) >>> 0);
    const starts = ICE.starts.map((s) => s.slice());
    const mir = (r, c) => [N - 1 - r, N - 1 - c];
    const blocked = new Set();
    const bx = (r, c) => blocked.add(r * N + c);
    for (const s of starts) { bx(s[0], s[1]); for (const d of ICE_DIR) { const nr = s[0] + d[0], nc = s[1] + d[1]; if (nr >= 0 && nr < N && nc >= 0 && nc < N) bx(nr, nc); } }
    const cands = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const id = r * N + c, m = mir(r, c), mid = m[0] * N + m[1];
      if (id >= mid) continue;
      if (blocked.has(id) || blocked.has(mid)) continue;
      cands.push([r, c]);
    }
    for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = cands[i]; cands[i] = cands[j]; cands[j] = t; }
    const water0 = new Set();
    for (let i = 0; i < Math.min(ICE.patches, cands.length); i++) { const r = cands[i][0], c = cands[i][1]; water0.add(r * N + c); const m = mir(r, c); water0.add(m[0] * N + m[1]); }
    return { N, starts, water0 };
  }
  // Sink any solid block that has no solid neighbour ("no floating blocks").
  // Mutates `water`; returns which of the two penguins fell through.
  function iceCascade(water, N, pos) {
    const fell = [false, false];
    let changed = true;
    while (changed) {
      changed = false;
      for (let id = 0; id < N * N; id++) {
        if (water.has(id)) continue;
        const r = Math.floor(id / N), c = id % N;
        let supported = false;
        for (const d of ICE_DIR) { const nr = r + d[0], nc = c + d[1]; if (nr >= 0 && nr < N && nc >= 0 && nc < N && !water.has(nr * N + nc)) { supported = true; break; } }
        if (!supported) {
          water.add(id); changed = true;
          if (pos[0] && pos[0][0] === r && pos[0][1] === c) fell[0] = true;
          if (pos[1] && pos[1][0] === r && pos[1][1] === c) fell[1] = true;
        }
      }
    }
    return fell;
  }
  function iceLegalMoveDirs(selfPos, oppPos, water, N) {
    const out = [];
    for (let d = 0; d < 4; d++) {
      const nr = selfPos[0] + ICE_DIR[d][0], nc = selfPos[1] + ICE_DIR[d][1];
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      if (water.has(nr * N + nc)) continue;
      if (oppPos && nr === oppPos[0] && nc === oppPos[1]) continue;
      out.push(d);
    }
    return out;
  }
  function iceLegalBreaks(selfPos, oppPos, water, N) {
    const out = [];
    for (let id = 0; id < N * N; id++) {
      if (water.has(id)) continue;
      const r = Math.floor(id / N), c = id % N;
      if (selfPos && r === selfPos[0] && c === selfPos[1]) continue;    // can't break where a penguin stands
      if (oppPos && r === oppPos[0] && c === oppPos[1]) continue;
      const w2 = new Set(water); w2.add(id);
      if (iceCascade(w2, N, [selfPos, oppPos])[0]) continue;            // never break in a way that sinks yourself
      out.push(id);
    }
    return out;
  }
  function iceView(m, f, st) {
    st = st || {};
    const B = iceBoardGen(st.seed || 0), N = B.N;
    const water = new Set(B.water0);
    let pos = [B.starts[0].slice(), B.starts[1].slice()];
    let over = false, winner = null, lastBreak = null, lastMove = null, lastMover = null;
    for (let k = 0; k < m.length && !over; k++) {
      const p = (f + k) % 2, o = 1 - p, md = m[k][0], bid = m[k][1];
      if (md >= 0) pos[p] = [pos[p][0] + ICE_DIR[md][0], pos[p][1] + ICE_DIR[md][1]];
      water.add(bid);
      const fell = iceCascade(water, N, pos);
      lastBreak = bid; lastMove = md; lastMover = p;
      if (fell[o]) { over = true; winner = p; pos[o] = null; }
      else if (fell[p]) { over = true; winner = o; pos[p] = null; }
    }
    let turn = over ? null : (f + m.length) % 2;
    let legalMoveDirs = [], legalBreaksFromHere = [];
    if (!over) {
      legalMoveDirs = iceLegalMoveDirs(pos[turn], pos[1 - turn], water, N);
      legalBreaksFromHere = iceLegalBreaks(pos[turn], pos[1 - turn], water, N);
      if (legalBreaksFromHere.length === 0) { over = true; winner = 1 - turn; turn = null; }  // no safe block to break -> stranded
    }
    return {
      N, water, pos, over, winner, turn, legalMoveDirs, lastBreak, lastMove,
      lastMover: m.length ? (f + m.length - 1) % 2 : null,
    };
  }
  function iceLegal(m, f, move, st) {
    const v = iceView(m, f, st); if (v.over) return false;
    const N = v.N, p = v.turn, o = 1 - p, md = move[0], bid = move[1];
    let selfPos = v.pos[p].slice();
    if (md >= 0) {
      if (!iceLegalMoveDirs(v.pos[p], v.pos[o], v.water, N).includes(md)) return false;
      selfPos = [selfPos[0] + ICE_DIR[md][0], selfPos[1] + ICE_DIR[md][1]];
    }
    return iceLegalBreaks(selfPos, v.pos[o], v.water, N).includes(bid);
  }
  const ice = {
    id: 'ice', name: 'Icebreaker', emoji: '🐧', mode: 'turns', tagLabel: 'Move + break',
    blurb: 'Move one square, then break a block anywhere. Strand your rival so the ice gives way under them.',
    colors: ['#4c86f4', '#f4544c'], pieceLabel: ['Blue', 'Red'],
    view: iceView, legal: iceLegal, iceBoardGen, iceLegalMoveDirs, iceLegalBreaks, iceCascade,
    newTurnState(f) { return { g: 'ice', v: 3, f, seed: (Math.floor(Math.random() * 1e9)) >>> 0, m: [] }; },
    paint(rootEl, api) {
      const v = api.view, N = v.N, me = api.me, colors = this.colors;
      const canPlay = api.canPlay && !v.over;
      const boardWrap = h('div', { class: 'ice-boardwrap' });
      const controls = h('div', { class: 'ice-controls' });
      rootEl.append(boardWrap); rootEl.append(controls);

      let phase = 'move', moveDir = null, previewPos = v.pos[me] ? v.pos[me].slice() : null;

      const addPeng = (cell, p, mine) => { const pg = h('div', { class: 'peng' + (mine ? ' mine' : '') }, '🐧'); pg.style.setProperty('--pc', colors[p]); cell.append(pg); };

      function render() {
        UI.clear(boardWrap); UI.clear(controls);
        const board = h('div', { class: 'ice-board', style: { '--n': String(N) } });
        const moveTargets = new Map();
        if (canPlay && phase === 'move') for (const d of v.legalMoveDirs) moveTargets.set((v.pos[me][0] + ICE_DIR[d][0]) * N + (v.pos[me][1] + ICE_DIR[d][1]), d);
        const breaks = (canPlay && phase === 'break') ? iceLegalBreaks(previewPos, v.pos[1 - me], v.water, N) : [];
        const breakSet = new Set(breaks);
        const myDisp = (canPlay && phase === 'break' && previewPos) ? previewPos : v.pos[me];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const id = r * N + c;
          const cell = h('div', { class: 'ice-cell' + (v.water.has(id) ? ' hole' : '') + (id === v.lastBreak ? ' just-broke' : '') });
          if (v.pos[1 - me] && v.pos[1 - me][0] === r && v.pos[1 - me][1] === c) addPeng(cell, 1 - me, false);
          if (myDisp && myDisp[0] === r && myDisp[1] === c) addPeng(cell, me, true);
          if (moveTargets.has(id)) { cell.classList.add('target'); const d = moveTargets.get(id); cell.addEventListener('click', () => { moveDir = d; previewPos = [r, c]; phase = 'break'; render(); }); }
          else if (breakSet.has(id)) {
            cell.classList.add('breakable');
            const w2 = new Set(v.water); w2.add(id);
            if (iceCascade(w2, N, [previewPos, v.pos[1 - me]])[1]) cell.classList.add('killshot');
            cell.addEventListener('click', () => api.play([moveDir, id]));
          }
          board.append(cell);
        }
        boardWrap.append(board);
        if (!canPlay) return;
        if (phase === 'move') {
          controls.append(h('div', { class: 'hint' }, '① Move — tap a bright square, or stay put.'));
          controls.append(h('button', { class: 'btn', onclick: () => { moveDir = -1; previewPos = v.pos[me].slice(); phase = 'break'; render(); } }, '⏸ Stay put'));
        } else {
          controls.append(h('div', { class: 'hint' }, '② Break a block — 💥 = knocks your rival through!'));
          controls.append(h('button', { class: 'btn btn-ghost', onclick: () => { phase = 'move'; moveDir = null; previewPos = v.pos[me].slice(); render(); } }, '↩ Change move'));
        }
      }
      render();
    },
  };
  /* =====================================================================
     DOODLE DRIFT (telephone/drift drawing — both draw & guess, no winner)
     A random prompt kicks off two chains. Each turn you GUESS the doodle you
     just received and DRAW the word you just received, then pass the link on.
     The meaning drifts every hop; the end screen replays both chains for the
     laugh. Two interleaved chains so both players draw AND guess every round.
     ===================================================================== */
  const DD = { ROUNDS: 3, PAD: 300, MINDIST: 2.5, MAXPTS: 80, MAXSTROKES: 24 };
  const DD_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const DOODLE_PROMPTS = [
    'a cat riding a skateboard', 'robot eating spaghetti', 'haunted toaster', 'a shark in a top hat',
    'grandma at a rave', 'a duck driving a bus', 'sentient traffic cone', 'a wizard stuck in traffic',
    'penguin on a treadmill', 'a snail with a jetpack', 'dinosaur baking cookies', 'a ghost walking a dog',
    'octopus playing drums', 'a banana in a business suit', 'frog king on a throne', 'a pizza with legs',
    'astronaut milking a cow', 'a vampire eating a taco', 'sloth doing yoga', 'a cactus wearing sunglasses',
    'llama in a hot tub', 'a robot walking its human', 'grumpy cloud raining', 'a bear in a canoe',
    'unicorn at the gym', 'a hamster lifting weights', 'jellyfish playing piano', 'a burglar bunny',
    'a whale wearing a scarf', 'moose on a motorcycle', 'a spider knitting a sweater', 'a hotdog surfing',
    'owl reading the newspaper', 'a snowman on vacation', 'a T-rex trying to clap', 'a mermaid firefighter',
    'a squirrel detective', 'a giraffe in an elevator', 'a beaver building a rocket', 'a pug in a raincoat',
    'a ninja making pancakes', 'a robot falling in love', 'a chicken lawyer', 'a turtle winning a race',
    'a crab playing chess', 'a pirate gardening', 'a fox stealing pizza', 'a cow on a trampoline',
    'a lonely lighthouse', 'a hedgehog with balloons', 'a walrus playing tennis', 'a dragon making tea',
    'a knight afraid of a mouse', 'a koala barista', 'a robot vacuum on strike', 'a flamingo doing ballet',
    'a monster under the bed napping', 'a raccoon raiding a fridge', 'a goldfish daydreaming', 'a yeti sunbathing',
    'a bee in a tiny car', 'an elephant tiptoeing', 'a possum playing dead dramatically', 'a snail race',
    'a cloud eating ice cream', 'a robot proposing', 'a cat knocking things off a table', 'a taco truck on the moon',
    'a skeleton at the beach', 'a hippo ballerina', 'a wizard cat', 'a rubber duck army',
    'a llama in space', 'a shy volcano', 'a dog stuck in a sweater', 'a frog with an umbrella',
    'a robot learning to dance', 'a grumpy old tortoise', 'a penguin waiter', 'a cactus hugging a balloon',
    'a bat hanging up laundry', 'a snail delivering mail', 'a moth chasing a lamp', 'a very confused scarecrow',
    'a panda eating ramen', 'a squid riding a bicycle', 'a cowboy frog', 'a hamster in a bubble',
  ];
  function ddEnc(v) { return DD_ALPHA[Math.max(0, Math.min(63, v | 0))]; }
  function ddPackDrawing(strokes) {
    return strokes.map((s) => s.map((p) => ddEnc(p[0]) + ddEnc(p[1])).join('')).join('.');
  }
  function ddUnpackDrawing(str) {
    if (!str) return [];
    return str.split('.').map((seg) => {
      const pts = [];
      for (let i = 0; i + 1 < seg.length; i += 2) pts.push([DD_ALPHA.indexOf(seg[i]), DD_ALPHA.indexOf(seg[i + 1])]);
      return pts;
    }).filter((s) => s.length);
  }
  function ddPick(seed, k) {
    const rnd = root.UI.mulberry32(((seed >>> 0) ^ (k ? 0x1a2b3c : 0x9e3779)) >>> 0);
    rnd(); // advance once so the two chains don't correlate
    return DOODLE_PROMPTS[Math.floor(rnd() * DOODLE_PROMPTS.length)];
  }
  function ddInit(st) {
    // The generic duel startGame doesn't set a starter, so pin one here — st.f
    // decides which player owns which chain (without it, (f+t)%2 is NaN and no
    // turn ever has a pending action).
    if (st.f == null) st.f = 0;
    st.t0 = [{ k: 'w', v: ddPick(st.seed, 0) }];
    st.t1 = [{ k: 'w', v: ddPick(st.seed, 1) }];
  }
  // Which acts (guess / draw) the pending turn owes, derived purely from chain
  // lengths. A chain ends on a word (last guess); last step is a drawing iff its
  // length is even, a word iff odd.
  function ddTurnActs(f, t, l0, l1) {
    const p = (f + t) % 2, target = 2 * DD.ROUNDS + 1, acts = [];
    if (p === (1 - f) && l0 % 2 === 0 && l0 < target) acts.push({ th: 't0', do: 'guess' });
    if (p === f && l1 % 2 === 0 && l1 < target) acts.push({ th: 't1', do: 'guess' });
    if (p === f && l0 % 2 === 1 && l0 < target) acts.push({ th: 't0', do: 'draw' });
    if (p === (1 - f) && l1 % 2 === 1 && l1 < target) acts.push({ th: 't1', do: 'draw' });
    return acts;
  }
  function ddCurrent(st) {
    const f = st.f, l0c = st.t0.length, l1c = st.t1.length;
    let l0 = 1, l1 = 1;
    for (let t = 0; t < 2 * DD.ROUNDS + 1; t++) {
      if (l0 === l0c && l1 === l1c) return { over: false, t, p: (f + t) % 2, acts: ddTurnActs(f, t, l0, l1) };
      ddTurnActs(f, t, l0, l1).forEach((a) => { if (a.th === 't0') l0++; else l1++; });
    }
    return { over: true };
  }

  const doodle = {
    id: 'doodle', name: 'Doodle Drift', emoji: '🎨', mode: 'duel', tagLabel: 'Draw & drift',
    blurb: 'Draw the prompt, guess their doodle, watch it drift. No winners — just laughs.',
    ddPackDrawing, ddUnpackDrawing, ddCurrent, ddTurnActs, DOODLE_PROMPTS, DD,
    paint(rootEl, api) {
      const st = api.state;
      if (!st.t0 || !st.t1) { ddInit(st); api.persist(); }
      const cur = ddCurrent(st);
      const hud = h('div', { class: 'race-hud' });
      rootEl.append(hud);

      // ---- draw a stored doodle onto a canvas (used for prompts + reveal) ----
      function paintDoodle(canvas, strokes, size) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        canvas.width = size * dpr; canvas.height = size * dpr;
        canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#f7f7fb'; ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#22242e'; ctx.lineWidth = Math.max(2, size * 0.012);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const U = (u) => (u / 63) * size;
        strokes.forEach((s) => {
          ctx.beginPath();
          s.forEach((p, i) => { const x = U(p[0]), y = U(p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
          if (s.length === 1) { ctx.lineTo(U(s[0][0]) + 0.1, U(s[0][1]) + 0.1); }
          ctx.stroke();
        });
      }

      // ======================= REVEAL =======================
      if (cur.over) {
        hud.append(h('div', { class: 'race-msg' }, '🎉 The drift is complete — here’s how it went sideways.'));
        [st.t0, st.t1].forEach((thread, ti) => {
          const lane = h('div', { class: 'doodle-lane' });
          lane.append(h('div', { class: 'doodle-lane-title' }, 'Chain ' + (ti + 1)));
          thread.forEach((step) => {
            if (step.k === 'w') lane.append(h('div', { class: 'doodle-word-chip' }, step.v));
            else {
              const cv = h('canvas', { class: 'doodle-mini' });
              lane.append(cv);
              requestAnimationFrame(() => paintDoodle(cv, ddUnpackDrawing(step.v), 150));
            }
          });
          rootEl.append(lane);
        });
        const controls = h('div', { class: 'race-controls' });
        controls.append(h('button', { class: 'btn btn-primary big', onclick: () => api.share('See how our Doodle Drift ended 🎨') }, navigator.share ? '📩 Send the reveal' : '🔗 Copy link'));
        controls.append(h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => api.newGame(null, 'new') }, '🔁 New drift')));
        rootEl.append(controls);
        return;
      }

      // ======================= ALREADY LOCKED IN THIS OPEN =======================
      if (api.session.acted) {
        hud.append(h('div', { class: 'race-msg' }, 'Locked in ✓ Send it over — it’s their turn to guess & draw.'));
        const controls = h('div', { class: 'race-controls' });
        controls.append(h('button', { class: 'btn btn-primary big', onclick: () => api.share('Your Doodle Drift turn 👇') }, navigator.share ? '📩 Send to opponent' : '🔗 Copy link'));
        controls.append(h('button', { class: 'btn btn-ghost', onclick: () => UI.copyText(location.href) }, '🔗 Copy link'));
        rootEl.append(controls);
        return;
      }

      // ======================= YOUR TURN: guess and/or draw =======================
      const roundNo = Math.floor(cur.t / 2) + 1;
      hud.append(h('div', { class: 'race-msg' }, cur.t === 0
        ? 'Kick it off — draw the secret prompt below. No masterpiece required.'
        : 'Guess the doodle, then draw the word you got. Keep it moving!'));

      const pending = { guess: '', draw: [] };
      const needs = { guess: false, draw: false };
      const body = h('div', { class: 'doodle-turn' });

      cur.acts.forEach((a) => {
        const thread = st[a.th];
        if (a.do === 'guess') {
          needs.guess = true;
          const strokes = ddUnpackDrawing(thread[thread.length - 1].v);
          const cv = h('canvas', { class: 'doodle-show' });
          requestAnimationFrame(() => paintDoodle(cv, strokes, Math.min(DD.PAD, (body.clientWidth || DD.PAD))));
          const input = h('input', {
            class: 'doodle-guess', type: 'text', maxlength: '40', autocomplete: 'off',
            placeholder: 'What is this?…', oninput: (e) => { pending.guess = e.target.value.trim(); refresh(); },
          });
          body.append(h('div', { class: 'doodle-block' },
            h('div', { class: 'doodle-label' }, '① What is this?'),
            h('div', { class: 'doodle-frame' }, cv), input));
        } else {
          needs.draw = true;
          const word = thread[thread.length - 1].v;
          body.append(h('div', { class: 'doodle-block' },
            h('div', { class: 'doodle-label' }, (cur.acts.length > 1 ? '② ' : '') + 'Draw this'),
            h('div', { class: 'doodle-word' }, '“' + word + '”'),
            drawPad()));
        }
      });
      rootEl.append(body);

      const lockWrap = h('div', { class: 'race-controls' });
      const lockBtn = h('button', { class: 'btn btn-primary big', onclick: commit }, '🔒 Lock in my turn');
      const lockHint = h('div', { class: 'hint' }, '');
      lockWrap.append(lockBtn, lockHint);
      rootEl.append(lockWrap);
      refresh();

      function ready() {
        if (!needs.guess && !needs.draw) return false; // nothing to do — never a valid turn
        return (!needs.guess || pending.guess.length > 0) && (!needs.draw || pending.draw.length > 0);
      }
      function refresh() {
        const ok = ready();
        lockBtn.disabled = !ok;
        lockBtn.style.opacity = ok ? '1' : '0.5';
        lockHint.textContent = ok ? 'Looks good — lock it in and send it on.'
          : (needs.guess && !pending.guess ? 'Type your guess to continue.' : 'Draw something to continue.');
      }
      function commit() {
        if (!ready()) return;
        cur.acts.forEach((a) => {
          if (a.do === 'guess') st[a.th].push({ k: 'w', v: pending.guess });
          else st[a.th].push({ k: 'd', v: ddPackDrawing(pending.draw) });
        });
        api.persist();
        api.session.acted = true;
        api.rerender();
      }

      // ---- finger/mouse drawing pad ----
      function drawPad() {
        const wrap = h('div', { class: 'doodle-pad-wrap' });
        const canvas = h('canvas', { class: 'doodle-pad' });
        canvas.style.touchAction = 'none';
        wrap.append(h('div', { class: 'doodle-frame' }, canvas));
        const strokes = pending.draw; // shared reference
        let size = DD.PAD, drawing = false, cur2 = null, npts = 0;

        function fit() {
          size = Math.min(DD.PAD, wrap.clientWidth || DD.PAD);
          repaint();
        }
        function repaint() { paintDoodle(canvas, strokes, size); }
        function pos(ev) {
          const r = canvas.getBoundingClientRect();
          const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
          const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
          return [Math.max(0, Math.min(63, Math.round((cx / r.width) * 63))),
            Math.max(0, Math.min(63, Math.round((cy / r.height) * 63)))];
        }
        function start(ev) {
          if (strokes.length >= DD.MAXSTROKES || npts >= DD.MAXPTS) return;
          ev.preventDefault(); drawing = true; cur2 = [pos(ev)]; strokes.push(cur2); npts++; repaint(); refresh();
        }
        function move(ev) {
          if (!drawing || !cur2) return; ev.preventDefault();
          if (npts >= DD.MAXPTS) { drawing = false; return; }
          const p = pos(ev), last = cur2[cur2.length - 1];
          if (Math.hypot(p[0] - last[0], p[1] - last[1]) < DD.MINDIST) return;
          cur2.push(p); npts++; repaint();
        }
        function end() { drawing = false; cur2 = null; }
        canvas.addEventListener('pointerdown', start);
        canvas.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        // touch fallback for older browsers
        canvas.addEventListener('touchstart', start, { passive: false });
        canvas.addEventListener('touchmove', move, { passive: false });
        canvas.addEventListener('touchend', end);

        const tools = h('div', { class: 'btn-row' },
          h('button', {
            class: 'btn btn-ghost', onclick: () => { strokes.pop(); npts = strokes.reduce((a, s) => a + s.length, 0); repaint(); refresh(); },
          }, '↶ Undo'),
          h('button', {
            class: 'btn btn-ghost', onclick: () => { strokes.length = 0; npts = 0; repaint(); refresh(); },
          }, '🗑 Clear'));
        wrap.append(tools);
        requestAnimationFrame(fit);
        if (api.onResize) api.onResize(fit);
        return wrap;
      }
    },
  };

  root.GAMES = [doodle, grandprix, flappy, draft, ice, hex, connect4, gomoku];

  // exports for node tests
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      c4View, c4Legal, goView, goLegal, hexView, hexLegal, hexNeighbors, hexWinner,
      makeTrack, onTrack, segmentOnTrack, raceLegalNext, raceFinished, RACE,
      flappyGaps, FL,
      draftView, draftLegal, draftPicker, computeResults, rollFor, CARS, DRAFT, POSITIONS, ERAS,
      iceBoardGen, iceView, iceLegal, iceLegalMoveDirs, iceLegalBreaks, iceCascade,
      ddPackDrawing, ddUnpackDrawing, ddCurrent, ddTurnActs, ddPick, ddInit, DOODLE_PROMPTS, DD,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
