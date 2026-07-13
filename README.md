# Matt & Matt 🎮

Turn-based games you play with someone over a **text link** — no app, no sign-up,
nothing to install. Make your move, tap **Send**, and your phone texts the other
person a link. They tap it, see your move, take their turn, and text a link back.
The entire game lives inside the URL, so it works on any phone and picks up right
where you left off whenever a link lands in your chat.

Built for two people with nothing but their phones — one of them stuck in a hospital bed, bored. 💙

## The games

| Game | What it is |
| --- | --- |
| 🏁 **Grand Prix** | Vector racing. Your car has *momentum* — nudge your speed and steer each turn, but carry too much into a hairpin and you spin out. You each drive the **same track solo**, and whoever finishes in **fewer moves wins**. Drive your run, text the track + your time (with a ghost of your racing line), and dare them to beat it. Every track is procedurally generated and guaranteed solvable. |
| 🐤 **Flappy Duel** | Flap through the pipes. Both players face the **exact same pipes** (seeded), so it's a fair contest — **highest score wins**. Play your run, text your score, and dare them to beat it. |
| 🏆 **Garage Draft** | An NBA-roulette-style car draft. Each turn the game **rolls a random era + brand** (e.g. "Modern × Ford") and you draft one car from it into an open **position** — Speed, Launch, Corners, Hauler or Trail. You get **one retool** (re-roll) for the whole game. Fill all five positions and the squads battle **head-to-head, position by position** — your Speed car vs theirs in the Top Speed Shootout, your Hauler vs theirs in the Tow-Off, etc. Best of five wins. Stats stay hidden while you draft, so you're picking on car knowledge — and the roll might force a supercar into your Hauler slot. |
| ⬡ **Hex** | Connect your two sides of the board with an unbroken chain of your color. Dead-simple rules, genuinely bottomless strategy, and **it's impossible to draw** — someone always wins. A favorite among serious abstract-strategy players. |
| 🔴 **Connect 4** | Drop discs, line up four. Quick and satisfying. |
| ⚫ **Gomoku** | Five in a row on a big 15×15 board. Tic-tac-toe, all grown up. |

Grand Prix and Flappy Duel are **solo-run duels** — you each take your shot on the same course and compare scores. The rest, including Garage Draft, are **turn-by-turn** (Garage Draft alternates rolls & picks, then simulates the head-to-head from the finished squads — all deterministic from the shared link, so both players see the same rolls and results).

## How a game flows

1. Pick a game from the menu — you're now looking at the board, and it's your turn.
2. Make your move (in Grand Prix, drive your whole run to the finish line).
3. Tap **📩 Send** — your phone's share sheet opens; send it via Messages/WhatsApp/etc.
   (If sharing isn't available, it copies the link so you can paste it.)
4. Your opponent taps the link, sees the board, takes their turn, and sends one back.
5. Repeat until someone wins. Tap **Rematch** to run it again with sides swapped.

Because the whole state is in the link, there are no accounts and no server keeping
score — the two of you just pass links back and forth in your existing chat.

## Play it / host it (free, on GitHub Pages)

Everything is static files at the repo root, so GitHub Pages can serve it as-is.

**Quickest — deploy from a branch (no build):**
1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**, pick your branch, folder **`/ (root)`**, and **Save**.
4. In a minute your games are live at `https://<your-username>.github.io/<repo>/`. Open it on your phone and add it to your home screen.

**Or auto-deploy on every push to `main`:**
- A workflow is included at `.github/workflows/pages.yml`. Just set **Settings → Pages → Source** to **GitHub Actions** once, and every push to `main` redeploys.

## Run locally

No dependencies or build step — it's plain HTML/CSS/JS. Serve the folder with anything:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` via `file://` mostly works too, but a local server is closer
to how it behaves when hosted.)

## Project layout

```
index.html          # shell + script includes
assets/styles.css   # all styling (mobile-first, dark theme)
assets/util.js      # DOM helper, URL-safe state encoding, seeded RNG, share/clipboard
assets/games.js     # the games (pure logic + rendering)
assets/app.js       # router + the two play flows (alternating turns & racing duel)
```

### Adding a game

Each game is an object in `assets/games.js` registered in the `GAMES` array. For a
turn-based game, implement `view(moves, first)` (derive the board + whose turn + winner),
`legal(moves, first, move)`, and `paint(container, api)` (render + wire taps to
`api.play(move)`). The router, share flow, "your turn" logic, and rematch are all handled
for you. The racing duel uses a separate `mode: 'duel'` flow.

The tricky logic (win detection, Hex connectivity, and the racing physics/track
generation) is covered by tests; every generated race track is verified solvable via
state-space search.
