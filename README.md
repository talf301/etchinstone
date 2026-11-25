# Dragons of Etchinstone

An unofficial, rules-enforced digital version of *Dragons of Etchinstone*, the solo palm game by Joe Klipfel, with the original *Northvale* expansion. It is a static web app built for iPhone: open it in Safari, choose Share → Add to Home Screen, and it runs full screen and offline.

Every card shown in the app is the original print-and-play art. Card statistics were transcribed from those card faces.

## What is implemented

- Base game: 16 mage cards with four levels each, the four regions (Jade Mountains, Living Marshes, Burning Basin, Forest of Gath), the four dragons (Rodving, Vuurhast, Grimroch, Helsang), hardships, enemy abilities and journey perils.
- Northvale (original Mythfield edition, rulebook 1.4): the four Ether Mages (Voltak, Mythix, Noramir, Promethia) with their 16 cards, the four Northvale regions and the four bosses (Merinus, Blight Rider, The Waykeeper, Aqualis). Mages can be mixed freely and used in either realm.
- All six difficulty levels, and the Cavalier and Glass Cannon rules.
- Divert, fusing, boost allocation, soaking, knock out, upgrades, regroup, the two-part Final Battle and scoring.
- The game is saved after every decision.

Not implemented: the Siege expansion (the asset pack has its rulebook but no cards), and the co-op and challenge variants.

## Run it

```sh
python3 -m http.server 8466 --bind 127.0.0.1 --directory public   # then open http://localhost:8466
node --test tests/*.test.mjs                                        # rules tests and random-play fuzzing
FUZZ_SEEDS=2000 node --test tests/fuzz.test.mjs                     # more random games
```

`tools/frame.html` shows the app in an iPhone-sized frame (serve the repository root and open `/tools/frame.html`). `tools/shot.sh out.png 'query'` takes a screenshot of it with headless Chrome. Development query parameters: `?new={...setup}` starts a game, `&seed=N&auto=N` plays N decisions with a greedy bot (`&bot=random` for random play, `&until=phase` to stop early), `&click=selector;selector` clicks elements, `&modal=rules|cards|region|dragon|zoom` opens a sheet.

To rebuild the images from the asset pack:

```sh
mkdir -p /tmp/etch/pdf
pdfimages -png -f 1 -l 6 "<assets>/Northvale/Print Sheets/Northvale - Flip on Short Edge.pdf" /tmp/etch/pdf/pg
uv run --no-project --with pillow --with numpy python -I tools/build_assets.py "<assets>" /tmp/etch/pdf public/img
python3 -I tools/build_sw.py public     # run after any change under public/
```

The Northvale faces are cut from the 300 dpi print sheets and matched to the small named images in the pack.

## How it works

- `public/engine/data.mjs` holds every card, region, dragon and glossary entry.
- `public/engine/game.mjs` is the rules engine. The state is plain JSON. `evaluate(state, plan)` works out an encounter for a given assignment of cards and is used both for the live preview and for resolution. `act(state, action)` applies one decision and returns the next state.
- `public/app.mjs` draws the table. `public/sw.js` (generated) caches the app and its art.

## Rulings

Where the rulebooks are silent or ambiguous the app does this:

- **Printed names.** The print-and-play card reads *Ice Wall*; the published rulebook calls it Frostfire Wall. The app uses the printed name.
- **Poison.** The extra damage is applied to the next hand right after it is drawn, and those cards may still be downgraded or upgraded in the next encounter. If there will be no next encounter in the region, it is applied to the current hand before cleanup.
- **Time penalty beyond the deck** becomes damage added to the encounter's other damage (rulebook). On the Final Journey it is soaked by the seven-card hand before you rest, and failing to soak it loses the game.
- **Ranged.** Discarding the Reserve card cancels only the Ranged ability; you still suffer Early Damage if the enemy beats your Initiative.
- **Slow.** Either an attack or a move action of your Spell counts at full value.
- **Northvale positions.** Unused card = Reserve, Leader = Spell, Booster = Boost. "Background color" is the card's own ether element; "ether action color" is the element of its enhanced action.
- **Adaptable** (Northvale enemy 1, colorless armor 1): the armor applies against the elements of your Spell and Boost cards.
- **Summon** uses the attack value of the region enemy whose attack color matches the Reserve card; the damage keeps the summoner's own color. Without a Reserve card it uses its own attack.
- **Enemy Camp** takes the enemy whose attack color matches the Spell card's element; a colorless Spell meets no enemy.
- **Pursuer** damage on a journey is treated as enemy damage (Ambush doubles it, Hazards counts it, Berserker may convert it).
- **Units.** The cost depends on the unit card's role; a unit card that is neither in a role nor the Reserve (Final Enemy) costs 4. In the Final Battle the cost is paid as double damage.
- **Contingency Plan, Illumined Path** read the enhanced-action element of the Reserve or Boost card; when that card has two, you choose. Armor changes apply to the first card you soak with.
- **Ether Chain** copies the Reserve card's enhanced action when Ether Chain itself would be enhanced; with no Reserve card it plays its basic action.
- **Blight Rider's poison** is 9 (printed on the boss card) and is soaked after scoring.
- **Fortified boss**: the −5 applies once to your total Initiative.
