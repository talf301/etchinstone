# Dragons of Etchinstone PWA progress (tracked locally)

## Scope
- Solo base game and the original Northvale expansion, fully rules enforced.
- Out of scope: Siege (rulebook only, no card art in the asset pack), co-op and challenge variants.

## Status
- [x] Rulebooks read (base 1.0, Northvale original 1.4, Northvale and Siege by Chip Theory Games)
- [x] Card data transcribed from the card faces (`public/engine/data.mjs`)
- [x] Art pipeline (`tools/build_assets.py`): base cards, encounters, dragons; Northvale faces cut from the 300 dpi print sheets
- [x] Rules engine (`public/engine/game.mjs`)
- [x] Tests: rules cases, random-play fuzz across every setup, greedy bot that wins
- [x] iPhone UI, PWA shell, offline cache
- [x] Independent rules review applied
- [ ] Hosting: needs Tal's choice (GitHub Pages needs a public repository or a paid plan)
- [ ] Not yet played by a human on a real iPhone

## Rulings
See README.
