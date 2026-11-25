import test from "node:test";
import assert from "node:assert/strict";
import { newGame, liveCards } from "../public/engine/game.mjs";
import { DIFFICULTIES, DRAGONS } from "../public/engine/data.mjs";
import * as helpers from "./helpers.mjs";
const { rng, step } = helpers;

const N = +(process.env.FUZZ_SEEDS || 150);
const mageSets = [[], ["voltak"], ["mythix"], ["noramir"], ["promethia"], ["voltak", "mythix", "noramir", "promethia"]];

test(`random legal play finishes every game (${N} seeds)`, () => {
  const ends = { won: 0, lost: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const r = rng(seed * 7919);
    const d = DRAGONS[seed % DRAGONS.length];
    const cfg = {
      campaign: d.campaign, dragon: d.id, mages: mageSets[seed % mageSets.length],
      difficulty: DIFFICULTIES[seed % DIFFICULTIES.length].id, cavalier: seed % 5 === 0, glass: seed % 3 === 0,
    };
    let s = newGame(cfg, seed);
    let n = 0;
    while (s.phase !== "won" && s.phase !== "lost") {
      s = step(s, r);
      // invariants: every live card is in exactly one zone
      const zones = [...s.deck, ...s.hand, ...s.discard];
      assert.equal(new Set(zones).size, zones.length, `seed ${seed}: duplicate card`);
      assert.deepEqual([...zones].sort((a, b) => a - b), liveCards(s).sort((a, b) => a - b), `seed ${seed}: lost a card`);
      for (const id of liveCards(s)) assert.ok(s.lv[id] >= 1 && s.lv[id] <= 4);
      assert.ok(++n < 2000, `seed ${seed}: game does not end`);
    }
    ends[s.phase]++;
    JSON.stringify(s);
  }
  console.log(ends);
});

test("a greedy player can win, with and without Northvale", () => {
  const { greedyStep } = helpers;
  const tally = {};
  for (const [campaign, dragonId, mages] of [["base", "rodving", []], ["base", "grimroch", []], ["north", "merinus", ["voltak"]], ["north", "blight-rider", ["promethia", "noramir"]], ["base", "helsang", ["mythix"]]]) {
    for (let seed = 1; seed <= 6; seed++) {
      const r = rng(seed * 31);
      let s = newGame({ campaign, dragon: dragonId, mages, difficulty: "casual" }, seed);
      let n = 0;
      while (s.phase !== "won" && s.phase !== "lost") { s = greedyStep(s, r); assert.ok(++n < 2000); }
      const k = `${dragonId}`;
      tally[k] = tally[k] || { won: 0, lost: 0, scores: [] };
      tally[k][s.phase]++;
      tally[k].scores.push(s.score);
    }
  }
  console.log(tally);
  assert.ok(Object.values(tally).some((t) => t.won > 0), "no game was won");
});
