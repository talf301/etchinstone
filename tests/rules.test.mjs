import test from "node:test";
import assert from "node:assert/strict";
import { newGame, act, evaluate, encounter, soakValue, soakable } from "../public/engine/game.mjs";

// Card ids: 0 Destruction(W) 1 Sword of Light(W) 2 Brute Force(W) 3 Ice Wall(W)
// 4 Rain of Blood(L) 5 Fleet Footed(L) 6 Adapt(L) 7 River Swiftness(L) 8 Burning Bridges(F)
// 9 Motivated Flight(F) 10 Adapt(F) 11 Ice Wall(F) 12 Rain of Blood(S) 13 Fleet Footed(S)
// 14 Determined March(S) 15 River Swiftness(S)
function mk({ hand, key, lv = {}, region = 1, cfg = {}, deck }) {
  const s = newGame({ ...cfg }, 5);
  const ids = Object.keys(s.lv).map(Number);
  const rest = ids.filter((id) => !hand.includes(id) && id !== key);
  s.hand = [...hand];
  s.deck = deck ? [key, ...deck] : [key, ...rest];
  s.discard = deck ? rest.filter((id) => !deck.includes(id)) : [];
  s.region = region;
  Object.assign(s.lv, lv);
  return s;
}
const plan = (spell, element, boost, extra = {}) => ({ sets: [{ spell, element, boost }], opts: {}, ...extra });
const run = (s, ...actions) => actions.reduce((st, a) => act(st, a), s);

test("enhanced attack needs a matching element; armor reduces it", () => {
  // key 0 at L2 -> enemy 1 of Jade Mountains: HP 7, init 8, attack 1 L, armor 1 L
  const s = mk({ hand: [1, 8, 2, 5], key: 0 });
  // Sword of Light (enh 6 L) with a Lightning element (Fleet Footed, init 5): 6 - 1 armor + boost 3
  let E = evaluate(s, plan(1, 5, 2));
  assert.equal(E.action, 6 - 1 + 3);
  assert.equal(E.outcome, "complete");
  assert.equal(E.early, 1); // initiative 5 < 8
  // with a Fire element it is the basic attack 3, no armor
  E = evaluate(s, plan(1, 8, 2));
  assert.equal(E.action, 3 + 3);
  assert.equal(E.outcome, "narrow");
  assert.equal(E.combat, 1);
  assert.equal(E.xp, 4);
  // boost to initiative: Fleet Footed 5 + 3 = 8 ties the enemy: no early damage
  E = evaluate(s, plan(1, 5, 2, { opts: { boost0: "initiative" } }));
  assert.equal(E.early, 0);
  assert.equal(E.action, 5);
});

test("a move spell attacks for 1; a journey uses move and reserve boost on matching ether", () => {
  const s = mk({ hand: [1, 5, 2, 13], key: 0 });
  assert.equal(evaluate(s, plan(5, 1, 2)).action, 1 + 3);
  // key 1 at L2 -> journey 1 of Jade Mountains: MP 12 L, TP 2, XP 5
  // key 7 at L2 -> journey 1 of Jade Mountains: MP 12 L, TP 2, XP 5
  const j = mk({ hand: [5, 6, 2, 13], key: 7 });
  // Fleet Footed enh 9 (L) with Lightning element Adapt, boost Fleet Footed(S) +2, reserve Brute Force +3
  const E = evaluate(j, plan(5, 6, 13));
  assert.equal(E.kind, "J");
  assert.equal(E.action, 9 + 2 + 3);
  assert.equal(E.outcome, "complete");
});

test("night travel reduces boost by initiative", () => {
  const s = mk({ hand: [5, 13, 2, 8], key: 1 }); // key 1 L2 has Night Travel
  assert.equal(encounter(s).hardship, "night");
  // element Burning Bridges (init 1): Brute Force boost 3 - 1 = 2; basic move 5
  const E = evaluate(s, plan(5, 8, 2));
  assert.equal(E.action, 5 + 2);
});

test("narrow journey costs time; running out of deck becomes damage", () => {
  const s = mk({ hand: [0, 3, 4, 12], key: 1, deck: [9] });
  const E = evaluate(s, plan(0, 3, 4));
  assert.equal(E.outcome, "loss");
  assert.equal(E.tp, 2);
  let t;
  const s2 = mk({ hand: [0, 3, 4, 12], key: 1, deck: [] });
  t = run(s2, { type: "resolve", plan: plan(0, 3, 4) }, { type: "continue" });
  assert.equal(t.phase, "soak");
  assert.equal(t.soak.amount, 1);
});

test("soaking: matching armor doubles, glass cannon adds one, a card soaks once, level 1 is trashed", () => {
  // Region 1 enemy 3 (key 6 L1 -> E3): attack 2 W. Ice Wall L2 has armor 2 W.
  const s = mk({ hand: [3, 0, 8, 12], key: 6, lv: { 6: 1, 8: 1 } });
  let t = run(s, { type: "resolve", plan: plan(8, 0, 12) }, { type: "continue" });
  assert.equal(t.phase, "soak");
  assert.equal(soakValue(t, 3), 4);
  assert.equal(soakValue(t, 0), 1);
  const g = mk({ hand: [3, 0, 8, 12], key: 6, lv: { 6: 1, 8: 1 }, cfg: { glass: true } });
  const tg = run(g, { type: "resolve", plan: plan(8, 0, 12) }, { type: "continue" });
  assert.equal(soakValue(tg, 3), 3);
  // soak with the level 1 Burning Bridges (armor 1): trashed, damage remains
  t = act(t, { type: "soak", card: 8 });
  assert.ok(t.trashed.includes(8));
  assert.equal(t.phase, "soak");
  assert.throws(() => act(t, { type: "soak", card: 8 }));
});

test("knock out downgrades everything and discards four", () => {
  // Region 4 enemy 4: attack 5 W, init 7. Hand of weak armor at level 1.
  const s = mk({ hand: [0, 8, 10, 6], key: 4, lv: { 4: 3, 0: 1, 8: 1, 10: 1, 6: 1 }, region: 4 });
  const before = s.deck.length;
  const t = run(s, { type: "resolve", plan: plan(0, 8, 10) }, { type: "continue" });
  assert.equal(t.trashed.length, 4);
  assert.ok(t.log.some((l) => /Knocked out/.test(l)));
  assert.ok(t.discard.length >= 4 && before - 4 >= t.deck.length);
});

test("divert twice at most, and fewer cards need a spell", () => {
  let s = mk({ hand: [0, 1, 2, 3], key: 4 });
  s = act(s, { type: "divert", card: 0 });
  s = act(s, { type: "divert", card: 1 });
  assert.equal(s.hand.length, 2);
  assert.throws(() => act(s, { type: "divert", card: 2 }));
  assert.ok(evaluate(s, { sets: [{ element: 2, boost: 3 }] }).errors.length);
  assert.equal(evaluate(s, { sets: [{ spell: 2, boost: 3 }] }).errors.length, 0);
});

test("fusing: same element only, both discarded, cavalier forbids it", () => {
  const s = mk({ hand: [0, 1, 4, 6], key: 12 });
  // fuse Destruction (W) under Sword of Light (W) as Fire: Rain of Blood 8 enhanced
  const p = { sets: [{ spell: 4, element: 1, boost: 6 }], fuse: { top: 1, bottom: 0, color: "F" }, opts: {} };
  const E = evaluate(s, p);
  assert.deepEqual(E.errors, []);
  assert.equal(E.sets[0].enhanced, true);
  assert.equal(E.reserve, null);
  assert.ok(evaluate(s, { ...p, fuse: { top: 4, bottom: 0, color: "F" } }).errors.length);
  const c = mk({ hand: [0, 1, 4, 6], key: 12, cfg: { cavalier: true } });
  assert.ok(evaluate(c, p).errors.length);
  let t = act(s, { type: "resolve", plan: p });
  while (t.phase !== "action") t = t.phase === "result" ? act(t, { type: "continue" }) : t.phase === "upgrade" ? act(t, { type: "endUpgrade" }) : act(t, { type: "soak", card: soakable(t)[0] });
  for (const id of [0, 1, 4, 6]) assert.ok(t.discard.includes(id) || t.trashed.includes(id));
});

test("upgrades spend XP, never on a downgraded card, and the region ends when five cards are not left", () => {
  // Jade Mountains enemy 2 (key 12 L2): HP 11, init 4, XP 7. Destruction enh 8 F with Fire element.
  let s = mk({ hand: [0, 8, 12, 5], key: 4, deck: [1, 2, 3] });
  s = run(s, { type: "resolve", plan: plan(0, 8, 12, { opts: { boost0: "action" } }) }, { type: "continue" });
  // 8 - 1 armor + 1 boost = 8 >= 6 narrow: early damage (init 1 < 4) and combat 2+2
  assert.equal(s.phase, "soak");
  s = act(s, { type: "soak", card: 5 });
  while (s.phase === "soak") s = act(s, { type: "soak", card: s.hand.find((id) => !s.enc.down.includes(id)) });
  assert.equal(s.phase, "upgrade");
  assert.equal(s.enc.xp, 7);
  assert.throws(() => act(s, { type: "upgrade", card: 5 }));
  const up = s.hand.find((id) => !s.enc.down.includes(id));
  s = act(s, { type: "upgrade", card: up });
  if (s.phase === "upgrade") s = act(s, { type: "endUpgrade" });
  // 1 kept + 4 in deck = 5: one more encounter
  assert.equal(s.phase, "action");
  assert.equal(s.region, 1);
});

test("final battle: tiers, regroup once, armor once per element, score", () => {
  let s = newGame({ dragon: "rodving" }, 3);
  s.region = 4;
  s.hand = [];
  s.deck = [5, 13, 7, 15, 9, 6, 14, 0, 4, 12, 1, 2, 3, 8, 10, 11];
  for (const id of s.deck) s.lv[id] = 4;
  s.phase = "fj";
  s.enc = { diverts: 0, down: [], xp: 0 };
  s.hand = s.deck.splice(0, 7);
  // Fleet Footed 14 (Lightning element Adapt) + boost 5; River Swiftness basic 8 + 5
  const p = { sets: [{ spell: 5, element: 6, boost: 9 }, { spell: 7, element: 15, boost: 13 }], opts: {} };
  const E = evaluate(s, p);
  assert.equal(E.action, 14 + 5 + 8 + 5);
  assert.equal(E.tier, 2);
  assert.equal(E.tp, 1);
  let t = act(s, { type: "regroup", card: 14 });
  assert.equal(t.hand.length, 7);
  assert.throws(() => act(t, { type: "regroup", card: t.hand[0] }));
  t = run(s, { type: "resolve", plan: p }, { type: "continue" });
  assert.equal(t.phase, "fe");
  assert.equal(t.hand.length, 8); // 9 left minus 1 time penalty
  // two enhanced Fire attacks (Rain of Blood 14 twice) with Fire elements: armor 4 once
  assert.deepEqual([...t.hand].sort((a, b) => a - b), [1, 2, 3, 4, 8, 10, 11, 12]);
  const q = { sets: [{ spell: 4, element: 8, boost: 1 }, { spell: 12, element: 10, boost: 11 }], opts: {} };
  const F = evaluate(t, q);
  assert.equal(F.action, 14 + 4 + 14 + 5 - 4);
  assert.equal(F.tier, 2);
  assert.equal(F.early, 9); // initiative 3 + 4 < 9
  assert.equal(F.combat, 15);
  // 24 damage, fire: Burning Bridges L4 armor 3 F doubles
  t = run(t, { type: "resolve", plan: q }, { type: "continue" });
  assert.equal(soakValue(t, 8), 6);
  for (const id of [8, 3, 11, 4, 12]) t = act(t, { type: "soak", card: id });
  assert.equal(t.phase, "won");
  assert.equal(t.score, 16 * 4 - 5);
});

test("Northvale: positional power, colorless element, units paid in XP, pursuer", () => {
  // Voltak: 16 Swirling Blades, 17 Ice Breaker, 18 Grit, 19 Warrior's Wisdom
  let s = mk({ hand: [16, 17, 18, 0], key: 4, cfg: { mages: ["voltak"] } });
  // Destruction basic 3 (Grit is colorless) + Ice Breaker... spell 0, element 18, boost 16, reserve 17 (+1)
  let E = evaluate(s, plan(0, 18, 16));
  assert.equal(E.sets[0].enhanced, false);
  assert.equal(E.action, 3 + 1 + 2);
  // Ice Breaker as element (+2), Grit as boost: -3 initiative
  E = evaluate(s, plan(0, 17, 18));
  assert.equal(E.action, 3 + 2 + 3 + 1);
  assert.equal(E.init, 3 - 3);
  // Noramir unit
  s = mk({ hand: [26, 27, 4, 8], key: 12, cfg: { mages: ["noramir"] } });
  E = evaluate(s, plan(4, 8, 27, { opts: { unit27: "attack" } }));
  assert.equal(E.unitCost, 1);
  assert.equal(E.action, 8 - 1 + 2 + 2);
  // Mythix pursuer: enemy HP +1 unless the pursuer card is the element
  s = mk({ hand: [22, 23, 0, 8], key: 12, cfg: { mages: ["mythix"] } });
  assert.equal(evaluate(s, plan(0, 8, 22)).need, 12);
  s = mk({ hand: [22, 1, 0, 8], key: 12, cfg: { mages: ["mythix"] } });
  assert.equal(evaluate(s, plan(0, 22, 8)).need, 11);
});

test("review fixes: slow enemies take move bonuses, negative boosts stay negative, final bonuses need no set 1", () => {
  // Whispering Fields enemy 1 (slow, HP 14): key 2 at L3 -> E1. Decisive Leader unit +2 move with a move spell.
  let s = mk({ hand: [5, 26, 9, 8], key: 2, lv: { 2: 3 }, region: 2, cfg: { campaign: "north", mages: ["noramir"] } });
  assert.ok(encounter(s).enemy.abilities.includes("slow"));
  const base = evaluate(s, plan(5, 8, 9)).action;
  assert.equal(base, 5 + 2);
  assert.equal(evaluate(s, plan(5, 8, 9, { opts: { unit26: "move" } })).action, base + 2);
  assert.equal(evaluate(s, plan(5, 8, 9, { opts: { unit26: "move" } })).unitCost, 4);
  // Elemental Shift L1 has Boost -3; Night Travel (key Sword of Light L2) must not raise it to 0.
  s = mk({ hand: [5, 8, 23, 0], key: 1, lv: { 23: 1 }, cfg: { mages: ["mythix"] } });
  assert.equal(evaluate(s, plan(5, 8, 23)).action, 5 - 3);
});
