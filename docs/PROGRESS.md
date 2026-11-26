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
- [x] Hosting: public repository, GitHub Pages at https://talf301.github.io/etchinstone/ (Tal runs `git subtree push --prefix public origin gh-pages`)
- [x] On a real iPhone: the page loads and tapping cards works (version 687505bf01)
- [ ] Not yet played through to the Final Battle by a human; offline use and the Home Screen install are unconfirmed

## Rulings
See README.
