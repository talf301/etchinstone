import { act, evaluate, soakable, upgradeCost, canDivert } from "../public/engine/game.mjs";

export function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A random but legal plan for the current phase.
export function randomPlan(s, r) {
  const final = s.phase !== "action";
  const hand = [...s.hand].sort(() => r() - 0.5);
  let fuse = null;
  if (!s.cfg.cavalier && r() < 0.2) {
    const cands = [];
    for (const a of hand) for (const b of hand) if (a !== b) cands.push({ top: a, bottom: b, color: "WFLS"[Math.floor(r() * 4)] });
    for (const f of cands.sort(() => r() - 0.5)) {
      if (!evaluate(s, { sets: [], fuse: f }).errors.some((e) => /share|Cavalier/.test(e))) { fuse = f; break; }
    }
  }
  const vis = hand.filter((id) => !fuse || id !== fuse.bottom);
  const sets = [];
  const roles = ["spell", "element", "boost"];
  for (let i = 0; i < (final ? 2 : 1); i++) sets.push({});
  let k = 0;
  if (final) {
    // spells first so that every used set has one
    const order = [[0, "spell"], [1, "spell"], [0, "element"], [0, "boost"], [1, "element"], [1, "boost"]];
    for (const [i, role] of order) if (k < vis.length) sets[i][role] = vis[k++];
  } else {
    const rs = vis.length >= 3 ? roles : vis.length === 2 ? ["spell", r() < 0.5 ? "element" : "boost"] : ["spell"];
    for (const role of rs) if (k < vis.length) sets[0][role] = vis[k++];
  }
  const plan = { sets, fuse, opts: {}, reserve: vis[k] ?? null };
  // pick random values for every offered option
  for (let pass = 0; pass < 3; pass++) {
    const E = evaluate(s, plan);
    for (const o of E.options) if (!(o.key in plan.opts)) plan.opts[o.key] = o.choices[Math.floor(r() * o.choices.length)].v;
  }
  return plan;
}

export function step(s, r) {
  switch (s.phase) {
    case "setup": {
      const c = [...s.setup.drawn].sort(() => r() - 0.5).slice(0, s.setup.pick);
      return act(s, { type: "pickDifficulty", cards: c });
    }
    case "action":
      if (canDivert(s) && r() < 0.15) return act(s, { type: "divert", card: s.hand[Math.floor(r() * s.hand.length)] });
      return act(s, { type: "resolve", plan: randomPlan(s, r) });
    case "fj":
      if (!s.regrouped && r() < 0.3) return act(s, { type: "regroup", card: s.hand[Math.floor(r() * s.hand.length)] });
      return act(s, { type: "resolve", plan: randomPlan(s, r) });
    case "fe":
      return act(s, { type: "resolve", plan: randomPlan(s, r) });
    case "result":
      return act(s, { type: "continue" });
    case "soak": {
      if (s.soak.berserk) return act(s, { type: "berserk", n: Math.floor(r() * (s.soak.berserk + 1)) });
      const c = soakable(s);
      return act(s, { type: "soak", card: c[Math.floor(r() * c.length)] });
    }
    case "upgrade": {
      const c = s.hand.filter((id) => upgradeCost(s, id) != null && upgradeCost(s, id) <= s.enc.xp);
      if (r() < 0.1) return act(s, { type: "endUpgrade" });
      return act(s, { type: "upgrade", card: c[Math.floor(r() * c.length)] });
    }
  }
  throw new Error("stuck in " + s.phase);
}

// ---- a greedy player, used to check that games can be won ----
function perms(a, k) {
  if (k === 0) return [[]];
  const out = [];
  a.forEach((x, i) => { for (const p of perms([...a.slice(0, i), ...a.slice(i + 1)], k - 1)) out.push([x, ...p]); });
  return out;
}
function optionCombos(s, plan) {
  const E = evaluate(s, plan);
  let plans = [plan];
  for (const o of E.options) {
    plans = plans.flatMap((p) => o.choices.map((c) => ({ ...p, opts: { ...p.opts, [o.key]: c.v } })));
    if (plans.length > 64) break;
  }
  return plans;
}
function value(s, E) {
  if (E.errors.length) return -1e9;
  if (E.kind === "FJ") return E.outcome === "lost" ? -1e6 + E.action : 100 - E.tp * 10 + E.action * 0.01;
  if (E.kind === "FE") return E.outcome === "lost" ? -1e6 + E.action : 1000 - E.damage * 10;
  return E.xp * 2 - E.damage * 3 - E.tp * 2 + E.action * 0.01;
}
export function bestPlan(s, r) {
  const final = s.phase !== "action";
  let best = null;
  const consider = (plan) => {
    for (const p of optionCombos(s, plan)) {
      const v = value(s, evaluate(s, p));
      if (!best || v > best.v) best = { v, plan: p };
    }
  };
  if (!final) {
    const k = Math.min(3, s.hand.length);
    for (const p of perms(s.hand, k)) {
      const [spell, b, c] = p;
      if (k === 3) consider({ sets: [{ spell, element: b, boost: c }], opts: {} });
      else if (k === 2) { consider({ sets: [{ spell, element: b }], opts: {} }); consider({ sets: [{ spell, boost: b }], opts: {} }); }
      else consider({ sets: [{ spell }], opts: {} });
    }
  } else {
    for (let n = 0; n < 1500; n++) {
      const h = [...s.hand].sort(() => r() - 0.5);
      const order = [[0, "spell"], [1, "spell"], [0, "element"], [0, "boost"], [1, "element"], [1, "boost"]];
      const sets = [{}, {}];
      let k = 0;
      for (const [i, role] of order) if (k < h.length) sets[i][role] = h[k++];
      consider({ sets, reserve: h[k] ?? null, opts: {} });
    }
  }
  return best.plan;
}
export function greedyStep(s, r) {
  switch (s.phase) {
    case "action": case "fj": case "fe":
      return act(s, { type: "resolve", plan: bestPlan(s, r) });
    case "soak": {
      if (s.soak.berserk) return act(s, { type: "berserk", n: s.soak.berserk });
      const c = soakable(s).sort((a, b) => s.lv[b] - s.lv[a]);
      return act(s, { type: "soak", card: c[0] });
    }
    case "upgrade": {
      const c = s.hand.filter((id) => upgradeCost(s, id) != null && upgradeCost(s, id) <= s.enc.xp);
      return act(s, { type: "upgrade", card: c.sort((a, b) => upgradeCost(s, a) - upgradeCost(s, b))[0] });
    }
    default:
      return step(s, r);
  }
}
