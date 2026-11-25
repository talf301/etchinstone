// Rules engine for Dragons of Etchinstone (base game and original Northvale).
// The state is plain JSON. Every player decision is one call to act(state, action).

import { CAMPAIGNS, DIFFICULTIES, ELEMENTS, GLOSSARY, NORTH_CARDS, OPPOSITE, cardDef, dragonDef } from "./data.mjs";

const clone = (o) => JSON.parse(JSON.stringify(o));
const ceilHalf = (n) => Math.ceil(n / 2);
const UNIT_COST = { boost: 1, spell: 2, element: 3, reserve: 4 };

// ---------- random ----------
function rand(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- accessors ----------
export const face = (s, id) => cardDef(id).levels[s.lv[id] - 1];
export const campaign = (s) => CAMPAIGNS[s.cfg.campaign];
export const regionDef = (s) => campaign(s).regions[s.region - 1];
export const dragon = (s) => dragonDef(s.cfg.dragon);
export const liveCards = (s) => Object.keys(s.lv).map(Number).filter((id) => !s.trashed.includes(id));
export const score = (s) => liveCards(s).reduce((n, id) => n + s.lv[id], 0);

function log(s, text) {
  s.log.push(text);
  if (s.log.length > 80) s.log.shift();
}

// ---------- setup ----------
export function newGame(cfg, seed = (Math.random() * 2 ** 31) | 0) {
  cfg = { campaign: "base", dragon: "rodving", mages: [], difficulty: "normal", cavalier: false, glass: false, ...cfg };
  const ids = [...Array(16).keys()];
  for (const c of NORTH_CARDS) if (cfg.mages.includes(c.mage)) ids[c.replaces] = c.id;
  const s = {
    v: 1, cfg, seed, rng: seed | 0,
    lv: Object.fromEntries(ids.map((id) => [id, 2])),
    deck: [], hand: [], discard: [], trashed: [],
    region: 1, phase: "setup", enc: null, todo: [], result: null, soak: null,
    poison: 0, regrouped: false, fjUnit: 0, log: [], setup: null, final: null, score: null,
  };
  s.deck = shuffle(s, ids);
  const d = DIFFICULTIES.find((x) => x.id === cfg.difficulty);
  if (d.draw) {
    s.setup = { drawn: s.deck.slice(0, d.draw), pick: d.pick, to: d.to };
    if (d.pick === d.draw) return act(s, { type: "pickDifficulty", cards: s.setup.drawn });
    return s;
  }
  return beginAdventure(s);
}

function beginAdventure(s) {
  s.setup = null;
  shuffle(s, s.deck);
  draw(s, 4);
  log(s, `The adventure begins in ${regionDef(s).name}.`);
  return startEncounter(s);
}

function draw(s, upTo) {
  while (s.hand.length < upTo && s.deck.length) s.hand.push(s.deck.shift());
}

function startEncounter(s) {
  if (!s.deck.length) return endRegion(s);
  s.enc = { diverts: 0, down: [], xp: 0 };
  s.phase = "action";
  s.result = null;
  return s;
}

// The encounter shown by the key card (top of the deck).
export function encounter(s, shift = 0) {
  if (s.phase === "fj") return { kind: "FJ", dragon: dragon(s) };
  if (s.phase === "fe") return { kind: "FE", dragon: dragon(s) };
  const key = s.deck[0];
  if (key == null) return null;
  const f = face(s, key);
  const n = ((f.enc.n - 1 + shift + 4) % 4) + 1;
  const r = regionDef(s);
  return {
    kind: f.enc.t, n, key, hardship: f.hardship, region: s.region, regionName: r.name,
    enemy: f.enc.t === "E" ? r.enemies[n - 1] : null,
    journey: f.enc.t === "J" ? r.journeys[n - 1] : null,
    img: `${r.img}${f.enc.t === "E" ? "e" : "j"}${n}`,
  };
}

// ---------- plan evaluation ----------
// plan: { sets: [{spell, element, boost}], reserve, fuse: {top, bottom, color}, opts: {} }
export function evaluate(s, plan) {
  const final = s.phase === "fj" || s.phase === "fe";
  const E = { errors: [], options: [], lines: [], sets: [], kind: null };
  const opts = plan.opts || {};
  const fuse = plan.fuse || null;
  const nSets = final ? 2 : 1;
  const sets = [...Array(nSets)].map((_, i) => ({ spell: null, element: null, boost: null, ...(plan.sets?.[i] || {}) }));
  const err = (m) => E.errors.push(m);
  const option = (key, label, choices, dflt) => {
    const value = choices.some((c) => c.v === opts[key]) ? opts[key] : dflt;
    E.options.push({ key, label, choices, value });
    return value;
  };

  // --- legality of the assignment ---
  if (fuse) {
    if (s.cfg.cavalier) err("Cavalier: you cannot fuse cards.");
    const { top, bottom, color } = fuse;
    if (top === bottom || !s.hand.includes(top) || !s.hand.includes(bottom)) err("Fuse two different cards from your hand.");
    else if (!face(s, top).bg.some((c) => face(s, bottom).bg.includes(c))) err("Fused cards must share an ether element.");
    if (!ELEMENTS.includes(color)) err("Choose an element for the fused card.");
  }
  const visible = s.hand.filter((id) => !fuse || id !== fuse.bottom);
  const assigned = sets.flatMap((x) => [x.spell, x.element, x.boost]).filter((x) => x != null);
  if (new Set(assigned).size !== assigned.length) err("A card can hold only one role.");
  if (assigned.some((id) => !visible.includes(id))) err("Assign cards from your hand.");
  const need = Math.min(3 * nSets, visible.length);
  if (assigned.length < need) err(need === 3 * nSets ? "Assign every role." : "Assign all of your cards.");
  sets.forEach((x, i) => {
    if ((x.element != null || x.boost != null) && x.spell == null) err(nSets > 1 ? `Set ${i + 1} needs a Spell.` : "One role must be a Spell.");
  });
  if (!sets.some((x) => x.spell != null) && visible.length) err("One role must be a Spell.");
  const free = visible.filter((id) => !assigned.includes(id));
  let reserve = null;
  if (free.length === 1 && (!final || s.phase === "fj")) reserve = free[0];
  else if (plan.reserve != null && free.includes(plan.reserve)) reserve = plan.reserve;
  E.reserve = reserve;
  E.free = free.filter((id) => id !== reserve);
  if (E.errors.length) return E;

  const enc = encounter(s, 0);
  const bgOf = (id) => (id == null ? [] : fuse && fuse.top === id ? [fuse.color] : face(s, id).bg);
  const etherOf = (id) => (id == null ? [] : [...new Set(face(s, id).enh.flatMap((v) => v.els))]);
  const roleOf = (id) => {
    for (let i = 0; i < sets.length; i++) for (const r of ["spell", "element", "boost"]) if (sets[i][r] === id) return { role: r, set: i };
    return id === reserve ? { role: "reserve", set: -1 } : { role: "bench", set: -1 };
  };
  const abil = (id) => (id == null ? null : face(s, id).ability);
  const withAbility = (kind) => visible.filter((id) => abil(id)?.kind === kind);
  const name = (id) => cardDef(id).name;

  // --- Windwalker: choose a neighbouring encounter ---
  let shift = 0;
  if (!final) {
    const dirs = new Set();
    for (const id of withAbility("windwalker")) {
      const a = abil(id), r = roleOf(id).role;
      if (a.left.includes(r)) dirs.add(-1);
      if (a.right.includes(r)) dirs.add(1);
    }
    if (dirs.size) {
      const what = enc.kind === "E" ? "enemy" : "journey";
      const ch = [{ v: 0, label: "Stay" }];
      if (dirs.has(-1)) ch.push({ v: -1, label: `← ${what} ${encounter(s, -1).n}` });
      if (dirs.has(1)) ch.push({ v: 1, label: `${what} ${encounter(s, 1).n} →` });
      shift = option("shift", "Windwalker", ch, 0);
    }
  }
  const target = final ? enc : encounter(s, shift);
  E.target = target;
  E.kind = target.kind;
  const attacking = target.kind === "E" || target.kind === "FE";
  const moving = !attacking;
  const slow = target.kind === "E" && target.enemy.abilities.includes("slow");
  const region = s.region;
  const hardship = final ? null : target.hardship;

  // --- hand-wide abilities ---
  let shieldMod = 0;
  const shieldNotes = [];
  const globalInit = [];   // [amount, label]
  const globalAct = [];
  for (const id of withAbility("contingency")) {
    if (reserve == null) continue;
    const cols = etherOf(reserve);
    const col = cols.length > 1 ? option("cp", "Contingency Plan reads", cols.map((c) => ({ v: c, label: c })), cols[0]) : cols[0];
    const x = abil(id).x;
    if (col === "F" && attacking) globalAct.push([x, "Contingency Plan"]);
    if (col === "S" && moving) globalAct.push([x, "Contingency Plan"]);
    if (col === "W") { shieldMod += x; shieldNotes.push(`Contingency Plan +${x} armor`); }
    if (col === "L") globalInit.push([x, "Contingency Plan"]);
  }
  let unitCost = 0;
  for (const id of withAbility("unit")) {
    const a = abil(id);
    const skill = option(`unit${id}`, `${name(id)} unit (rank ${a.rank})`, [{ v: "none", label: "Rest" }, ...a.skills.map((k) => ({ v: k, label: `+${a.rank} ${k}` }))], "none");
    if (skill === "none") continue;
    const cost = UNIT_COST[roleOf(id).role] || 4;
    unitCost += cost;
    E.lines.push(final ? `${name(id)}'s unit costs ${cost * 2} damage.` : `${name(id)}'s unit costs ${cost} XP.`);
    if (skill === "attack" && attacking) globalAct.push([a.rank, "Unit"]);
    if (skill === "move" && moving) globalAct.push([a.rank, "Unit"]);
    if (skill === "initiative") globalInit.push([a.rank, "Unit"]);
    if (skill === "armor") { shieldMod += a.rank; shieldNotes.push(`Unit +${a.rank} armor`); }
  }
  E.unitCost = unitCost;
  const pursuer = !final && withAbility("pursuer").some((id) => roleOf(id).role !== "element");
  let berserk = 0;
  for (const id of withAbility("berserk")) if (["element", "spell"].includes(roleOf(id).role)) berserk += abil(id).x;

  // --- each action set ---
  const fit = (t) => t === "x" || slow || (attacking ? t === "a" : t === "m");
  sets.forEach((x, i) => {
    const R = { i, lines: [], value: 0, init: 0, boost: 0, enhanced: false, el: null, empty: x.spell == null };
    E.sets.push(R);
    if (x.spell == null) return;
    const what = attacking ? "Attack" : "Move";
    // element
    const bg = bgOf(x.element);
    const sp = face(s, x.spell);
    let el = bg[0] ?? null;
    if (bg.length > 1) {
      const wanted = bg.find((c) => sp.enh.some((v) => v.els.includes(c))) ?? bg[0];
      el = option(`el${i}`, `${name(x.element)} element`, bg.map((c) => ({ v: c, label: c })), wanted);
    }
    R.el = el;
    // spell
    let actn = { ...sp.basic, enhanced: false };
    const variant = el && sp.enh.find((v) => v.els.includes(el));
    if (variant && variant.chain != null) {
      const cands = reserve == null ? [] : face(s, reserve).enh.filter((v) => v.chain == null);
      if (cands.length) {
        const best = cands.slice().sort((a, b) => (fit(b.t) ? b.v : -99) - (fit(a.t) ? a.v : -99))[0];
        actn = { t: best.t, v: best.v + variant.chain, enhanced: true };
        R.lines.push(`Ether Chain plays ${name(reserve)}'s ether action +${variant.chain}.`);
      } else R.lines.push("Ether Chain has no Reserve card to copy: basic action.");
    } else if (variant) actn = { t: variant.t, v: variant.v, enhanced: true };
    let value;
    if (fit(actn.t)) {
      value = actn.v;
      R.enhanced = actn.enhanced;
      R.lines.push(`${name(x.spell)}: ${actn.enhanced ? "Enhanced" : "Basic"} ${what} ${value}`);
    } else {
      value = 1;
      R.lines.push(`${name(x.spell)} has no ${what} here: ${what} 1`);
    }
    const add = (n, why) => { if (n) { value += n; R.lines.push(`${n > 0 ? "+" : ""}${n} ${why}`); } };
    // positional abilities
    const pe = abil(x.element), pr = abil(reserve), ps = abil(x.spell), pb = abil(x.boost);
    if (pe?.kind === "power") add(pe.element, `${name(x.element)} as Element`);
    if (pr?.kind === "power") add(pr.reserve, `${name(reserve)} in Reserve`);
    for (const id of [reserve, x.spell]) {
      const a = abil(id);
      if (a?.kind !== "seeingRed" || x.boost == null) continue;
      const bt = face(s, x.boost).basic.t;
      if ((bt === "a" || bt === "x") && attacking) add(a.plus, "Seeing Red");
      else if (bt === "m" && moving) add(-a.minus, "Seeing Red");
    }
    if (i === 0) for (const [n, why] of globalAct) add(n, why);
    // boost
    let boost = x.boost == null ? 0 : face(s, x.boost).boost;
    if (x.boost != null && pr?.kind === "drain") boost = Math.max(0, boost - pr.x);
    // initiative
    let init = x.element == null ? 0 : face(s, x.element).init;
    const initLines = [`Initiative ${init}`];
    const addInit = (n, why) => { if (n) { init += n; initLines.push(`${n > 0 ? "+" : ""}${n} ${why}`); } };
    if (ps?.kind === "slowWit") addInit(-ps.x, name(x.spell));
    if (pb?.kind === "slowWit") addInit(-pb.x, name(x.boost));
    if (i === 0) for (const [n, why] of globalInit) addInit(n, why);
    for (const id of withAbility("illumined")) {
      if (x.boost == null) continue;
      const cols = etherOf(x.boost);
      const col = cols.length > 1 ? option(`ip${i}`, "Illumined Path reads", cols.map((c) => ({ v: c, label: c })), cols[0]) : cols[0];
      const n = abil(id).x;
      if (col === "F" && i === 0) { shieldMod -= n; shieldNotes.push(`Illumined Path −${n} armor`); }
      if ((col === "S" || col === "W") && moving) add(-n, "Illumined Path");
      if (col === "L") addInit(-n, "Illumined Path");
    }
    if (hardship === "night" && x.boost != null) {
      const cut = Math.max(0, init);
      if (cut && boost > 0) R.lines.push(`Night Travel: Boost ${boost} − ${cut}`);
      boost = Math.max(0, boost - cut);
    }
    Object.assign(R, { value, init, boost, initLines, boostBg: bgOf(x.boost), spellBg: bgOf(x.spell) });
  });

  const live = E.sets.filter((r) => !r.empty);
  if (!live.length && !final) live.push({ i: 0, lines: ["No cards to play."], initLines: [], value: 0, init: 0, boost: 0, enhanced: false, el: null, boostBg: [], spellBg: [] });
  const resBoost = reserve == null ? 0 : face(s, reserve).boost;
  E.berserk = 0;
  E.dmg = [];        // {amount, el, label}
  E.tp = 0;
  E.xp = 0;
  E.shieldMod = 0;
  E.dropReserve = false;
  E.noSoak = [];
  E.pierce = false;
  E.poison = 0;
  const say = (t) => E.lines.push(t);
  const boostTarget = (R) => {
    if (!attacking) return "action";
    if (sets[R.i].boost == null) return "action";
    return option(`boost${R.i}`, nSets > 1 ? `Set ${R.i + 1} Boost +${R.boost}` : `Boost +${R.boost}`, [{ v: "action", label: slow ? "Attack / Move" : "Attack" }, { v: "initiative", label: "Initiative" }], "action");
  };
  const applyBoost = (R) => {
    const to = boostTarget(R);
    if (!R.boost) return;
    if (to === "action") { R.value += R.boost; R.lines.push(`${R.boost > 0 ? "+" : ""}${R.boost} Boost`); }
    else { R.init += R.boost; R.initLines.push(`+${R.boost} Boost`); }
  };

  if (target.kind === "E") {
    const R = live[0], en = target.enemy, ab = en.abilities;
    const boostBg = R.boostBg;
    let hp = en.hp;
    if (pursuer) { hp += region <= 2 ? 1 : 2; say(`Pursuer: enemy HP ${hp}.`); }
    if (ab.includes("fortified")) {
      if (boostBg.some((c) => en.armor.some((a) => a.el === c))) say("Fortified ignored: your Boost matches its armor.");
      else { R.init -= region; R.initLines.push(`−${region} Fortified`); }
    }
    applyBoost(R);
    const short = Math.max(0, en.init - R.init);
    let atk = en.atk;
    if (ab.includes("summon") && reserve != null) {
      const other = regionDef(s).enemies.find((o) => bgOf(reserve).includes(o.atkEl));
      if (other) { atk = other.atk; say(`Summon: attack ${atk}.`); }
    }
    // armor
    let armor = en.armor.map((a) => ({ ...a }));
    if (ab.includes("adaptable")) {
      const cols = [...new Set([...R.spellBg, ...boostBg])];
      armor = armor.flatMap((a) => (a.el == null ? cols.map((c) => ({ v: a.v, el: c })) : [a]));
    }
    if (ab.includes("evasive") && short) armor.forEach((a) => (a.v += short));
    if (R.enhanced && R.el) {
      const sub = armor.filter((a) => a.el === R.el).reduce((n, a) => n + a.v, 0);
      if (sub) { R.value -= sub; R.lines.push(`−${sub} enemy armor`); }
    }
    R.value = Math.max(0, R.value);
    // initiative and early damage
    let early = 0;
    const ranged = ab.includes("ranged");
    let ignore = false;
    if (ranged && reserve != null) ignore = option("ranged", "Ranged", [{ v: false, label: "Take it" }, { v: true, label: `Discard ${name(reserve)}` }], false);
    const lostInit = en.init > R.init;
    if (lostInit || (ranged && !ignore)) {
      early = atk + (ab.includes("aggressive") ? 1 : 0) - (ab.includes("defensive") ? 1 : 0);
      early = Math.max(0, early);
      if (hardship === "ambush") early *= 2;
    }
    if (ranged && ignore) E.dropReserve = true;
    const outcome = R.value >= hp ? "complete" : R.value >= ceilHalf(hp) ? "narrow" : "loss";
    const combat = outcome === "complete" ? 0 : atk;
    if (early) E.dmg.push({ amount: early, el: en.atkEl, label: "Early Damage", enemy: true });
    if (combat) E.dmg.push({ amount: combat, el: en.atkEl, label: "Combat Damage", enemy: true });
    if (outcome !== "loss") E.xp = en.xp;
    if (hardship === "hazards") E.tp += (early ? 1 : 0) + (combat ? 1 : 0);
    if (ab.includes("freeze") && early && reserve != null) { E.dropReserve = true; say(`Freeze: ${name(reserve)} is discarded.`); }
    if (ab.includes("poison")) E.poison = (early ? 1 : 0) + (combat ? 1 : 0);
    if (ab.includes("pierce")) { E.pierce = true; if (combat) E.noSoak = [sets[0].spell]; }
    E.berserk = Math.min(berserk, early + combat);
    Object.assign(E, { outcome, action: R.value, need: hp, half: ceilHalf(hp), init: R.init, enemyInit: en.init, early, combat, what: slow ? "Attack / Move" : "Attack" });
  } else if (target.kind === "J") {
    const R = live[0], j = target.journey;
    applyBoost(R);
    if (R.enhanced && R.el === j.el && reserve != null && resBoost) { R.value += resBoost; R.lines.push(`${resBoost > 0 ? "+" : ""}${resBoost} Reserve Boost (matching ether)`); }
    let mp = j.mp;
    if (j.peril === "steep" && reserve != null) { mp += resBoost; say(`Steep: MP ${mp}.`); }
    if (j.peril === "guarded" && R.enhanced && R.el === OPPOSITE[j.el]) { R.value -= region; R.lines.push(`−${region} Guarded`); }
    let tp = j.tp;
    if (j.peril === "labyrinth") {
      const js = regionDef(s).journeys;
      const adj = [js[(target.n + 2) % 4].el, js[target.n % 4].el];
      if (R.boostBg.some((c) => adj.includes(c))) { tp += 1; say("Labyrinth: +1 Time Penalty."); }
    }
    const outcome = R.value >= mp ? "complete" : R.value >= ceilHalf(mp) ? "narrow" : "loss";
    if (outcome !== "loss") E.xp = j.xp;
    let early = 0;
    if (pursuer) {
      const en = regionDef(s).enemies[target.n - 1];
      if (en.init > R.init) {
        early = en.atk * (hardship === "ambush" ? 2 : 1);
        E.dmg.push({ amount: early, el: en.atkEl, label: "Pursuer", enemy: true });
        say(`Pursuer: initiative ${R.init} vs ${en.init}.`);
      } else say(`Pursuer outrun: initiative ${R.init} vs ${en.init}.`);
    }
    let camp = 0;
    if (outcome !== "complete") {
      E.tp += tp;
      if (j.peril === "treacherous") E.dmg.push({ amount: 1, el: null, label: "Treacherous" });
      if (j.peril === "camp") {
        const foes = regionDef(s).enemies.filter((o) => R.spellBg.includes(o.atkEl));
        if (foes.length) {
          const foe = foes.sort((a, b) => b.atk - a.atk)[0];
          camp = foe.atk;
          E.dmg.push({ amount: camp, el: foe.atkEl, label: "Enemy Camp", enemy: true });
        }
      }
    }
    if (hardship === "hazards") E.tp += (early ? 1 : 0) + (camp ? 1 : 0);
    E.berserk = Math.min(berserk, early + camp);
    Object.assign(E, { outcome, action: R.value, need: mp, half: ceilHalf(mp), init: R.init, early, combat: 0, what: "Move" });
  } else if (target.kind === "FJ") {
    const d = target.dragon;
    live.forEach(applyBoost);
    let total = live.reduce((n, R) => n + R.value, 0);
    if (reserve != null && resBoost && live.some((R) => R.enhanced && R.el === d.el)) { total += resBoost; say(`+${resBoost} Reserve Boost (matching ether)`); }
    let tier = -1;
    d.mp.forEach((t, k) => { if (total >= t.v) tier = k; });
    if (tier >= 0) E.tp = d.mp[tier].tp;
    Object.assign(E, { outcome: tier < 0 ? "lost" : "tier", tier, action: total, need: d.mp[0].v, what: "Move" });
  } else {
    const d = target.dragon, ab = d.abilities;
    if (ab.includes("fortified")) {
      const left = d.armor[0].el;
      if (live.some((R) => R.boostBg.includes(left))) say("Fortified ignored: a Boost matches its armor.");
      else if (live.length) { live[0].init -= 5; live[0].initLines.push("−5 Fortified"); }
    }
    live.forEach(applyBoost);
    let total = live.reduce((n, R) => n + R.value, 0);
    const init = live.reduce((n, R) => n + R.init, 0);
    const short = Math.max(0, d.init - init);
    for (const a of d.armor) {
      const v = a.v + (ab.includes("evasive") ? short : 0);
      if (live.some((R) => R.enhanced && R.el === a.el)) { total -= v; say(`−${v} dragon armor (${GLOSSARY_EL[a.el]})`); }
    }
    total = Math.max(0, total);
    let tier = -1;
    d.hp.forEach((t, k) => { if (total >= t.v) tier = k; });
    const early = init < d.init ? d.early : 0;
    const combat = tier < 0 ? 0 : d.hp[tier].atk;
    if (early) E.dmg.push({ amount: early, el: d.el, label: "Early Damage", enemy: true });
    if (combat) E.dmg.push({ amount: combat, el: d.el, label: "Combat Damage", enemy: true });
    if (ab.includes("pierce")) { E.pierce = true; E.noSoak = sets.map((x) => x.spell).filter((x) => x != null); }
    E.berserk = Math.min(berserk, early + combat);
    Object.assign(E, { outcome: tier < 0 ? "lost" : "tier", tier, action: total, need: d.hp[0].v, init, enemyInit: d.init, early, combat, what: "Attack" });
  }
  E.shieldMod = shieldMod;
  if (shieldMod) say(`${shieldNotes.join(", ")} on the first card that soaks damage.`);
  E.damage = E.dmg.reduce((n, x) => n + x.amount, 0);
  E.used = [...assigned, ...(fuse ? [fuse.bottom] : [])];
  return E;
}
const GLOSSARY_EL = { W: "water", F: "fire", L: "lightning", S: "shadow" };

// ---------- soaking damage ----------
export function soakValue(s, id, k = s.soak) {
  const f = face(s, id);
  let a = f.armor;
  if (k.first && k.mod) a = Math.max(0, a + k.mod);
  if (f.armorEl && !k.pierce && k.els.includes(f.armorEl)) a = s.cfg.glass ? a + 1 : a * 2;
  return a;
}
export function soakable(s, k = s.soak) {
  return s.hand.filter((id) => !k.used.includes(id) && !k.noSoak.includes(id) && (k.allowRe || !s.enc?.down.includes(id)));
}
function capacity(s, k) {
  const ids = soakable(s, k);
  const plain = ids.map((id) => soakValue(s, id, { ...k, first: false }));
  const sum = plain.reduce((a, b) => a + b, 0);
  if (!k.first || !k.mod) return sum;
  let best = -Infinity;
  ids.forEach((id, i) => { best = Math.max(best, sum - plain[i] + soakValue(s, id, k)); });
  return ids.length ? best : 0;
}
function downgrade(s, id, mark) {
  if (mark && s.enc) s.enc.down.push(id);
  if (s.lv[id] === 1) {
    s.trashed.push(id);
    s.hand = s.hand.filter((x) => x !== id);
    log(s, `${cardDef(id).name} is trashed.`);
  } else s.lv[id]--;
}
function knockOut(s, k) {
  if (k.final) {
    log(s, "You cannot soak the damage.");
    return lose(s, "The dragon's damage knocked you out.");
  }
  log(s, "Knocked out! Every card is downgraded and four cards are discarded.");
  for (const id of [...s.hand]) if (!s.enc.down.includes(id) && !(k.mark === false && k.used.includes(id))) downgrade(s, id, true);
  s.discard.push(...s.deck.splice(0, 4));
  s.enc.ko = true;
  s.soak = null;
  return advance(s);
}
function beginSoak(s, step) {
  const k = { els: [], noSoak: [], allowRe: false, mod: 0, mark: true, final: false, berserk: 0, label: "Damage", ...step, used: [], first: true };
  k.total = k.amount;
  if (k.amount <= 0) return advance(s);
  s.soak = k;
  s.phase = "soak";
  if (!k.berserk && capacity(s, k) < k.amount) return knockOut(s, k);
  return s;
}

// ---------- flow ----------
function advance(s) {
  for (;;) {
    if (s.phase === "won" || s.phase === "lost") return s;
    const step = s.todo.shift();
    if (!step) throw new Error("nothing to do");
    switch (step.t) {
      case "tp": {
        const n = Math.min(step.n, s.deck.length);
        const gone = s.deck.splice(0, n);
        s.discard.push(...gone);
        if (step.n) log(s, `Time Penalty ${step.n}: ${gone.map((id) => cardDef(id).name).join(", ") || "no cards left"}.`);
        const over = step.n - n;
        const extra = over + (step.storm ? step.n : 0);
        if (extra) {
          const next = s.todo.find((x) => x.t === "soak" && x.main);
          if (next) next.amount += extra;
          else s.todo.unshift({ t: "soak", amount: extra, main: true, final: step.final, label: step.storm ? "Storm" : "Out of time" });
          if (over) log(s, `${over} card${over > 1 ? "s" : ""} short: ${over} damage.`);
          if (step.storm) log(s, `Storm: ${step.n} damage.`);
        }
        break;
      }
      case "soak":
        return beginSoak(s, step);
      case "upgrade": {
        const short = step.unitCost - s.enc.xp;
        if (step.unitCost) {
          s.enc.xp = Math.max(0, s.enc.xp - step.unitCost);
          log(s, `Units paid ${step.unitCost - Math.max(0, short)} XP.`);
          if (short > 0) {
            s.todo.unshift({ t: "soak", amount: short, allowRe: true, mark: true, label: "Unpaid units" }, { t: "upgrade", unitCost: 0 });
            break;
          }
        }
        if (canUpgradeAny(s)) { s.phase = "upgrade"; return s; }
        break;
      }
      case "cleanup": {
        const e = s.enc;
        const toss = s.hand.filter((id) => e.used.includes(id) || (e.dropReserve && id === e.reserve));
        const kept = s.hand.length - toss.length;
        if (s.poison && kept + s.deck.length < 5) {
          const n = s.poison;
          s.poison = 0;
          s.todo.unshift({ t: "soak", amount: n, label: "Poison" }, step);
          break;
        }
        s.hand = s.hand.filter((id) => !toss.includes(id));
        s.discard.push(...toss);
        if (s.hand.length + s.deck.length < 5) return endRegion(s);
        draw(s, 4);
        if (s.poison) {
          const n = s.poison;
          s.poison = 0;
          s.enc = { diverts: 0, down: [], xp: 0 };
          s.todo.unshift({ t: "soak", amount: n, label: "Poison", mark: false, allowRe: true }, { t: "encounter" });
          break;
        }
        return startEncounter(s);
      }
      case "encounter":
        return startEncounter(s);
      case "rest": {
        s.discard.push(...s.hand);
        s.hand = [];
        s.hand.push(...s.deck.splice(0));
        s.enc = { diverts: 0, down: [], xp: 0 };
        log(s, `You rest, then draw ${s.hand.length} cards to face ${dragon(s).name}.`);
        if (s.fjUnit) s.todo.unshift({ t: "soak", amount: s.fjUnit, final: true, mark: false, allowRe: true, label: "Unit payment" });
        s.todo.push({ t: "fe" });
        break;
      }
      case "fe":
        s.phase = "fe";
        s.result = null;
        return s;
      case "score":
        s.score = score(s);
        break;
      case "win":
        s.phase = "won";
        if (s.score == null) s.score = score(s);
        log(s, `${dragon(s).name} is defeated. Score ${s.score}.`);
        return s;
      case "lose":
        return lose(s, step.why);
    }
  }
}
function lose(s, why) {
  s.phase = "lost";
  s.score = 0;
  s.lostWhy = why;
  s.todo = [];
  s.soak = null;
  log(s, why);
  return s;
}
function canUpgradeAny(s) {
  return s.hand.some((id) => upgradeCost(s, id) != null && upgradeCost(s, id) <= s.enc.xp);
}
export function upgradeCost(s, id) {
  if (!s.enc || s.enc.down.includes(id) || s.lv[id] >= 4 || !s.hand.includes(id)) return null;
  return face(s, id).xp;
}
function endRegion(s) {
  const all = liveCards(s);
  s.hand = [];
  s.discard = [];
  s.deck = shuffle(s, all);
  s.poison = 0;
  s.todo = [];
  if (s.region >= 4) {
    log(s, `The regions are behind you. ${dragon(s).name} awaits.`);
    s.phase = "fj";
    s.result = null;
    s.enc = { diverts: 0, down: [], xp: 0 };
    draw(s, 7);
    return s;
  }
  s.region++;
  log(s, `You enter ${regionDef(s).name}.`);
  draw(s, 4);
  return startEncounter(s);
}

// ---------- actions ----------
export function act(state, a) {
  const s = clone(state);
  const bad = (m) => { throw new Error(m); };
  switch (a.type) {
    case "pickDifficulty": {
      if (s.phase !== "setup" || !s.setup) bad("Not in setup.");
      const cards = [...new Set(a.cards)];
      if (cards.length !== s.setup.pick || cards.some((id) => !s.setup.drawn.includes(id))) bad(`Choose ${s.setup.pick} cards.`);
      for (const id of cards) s.lv[id] = s.setup.to;
      return beginAdventure(s);
    }
    case "divert": {
      if (s.phase !== "action") bad("You cannot divert now.");
      if (!canDivert(s)) bad("You cannot divert again.");
      if (!s.hand.includes(a.card)) bad("Discard a card from your hand.");
      const key = s.deck.shift();
      s.hand = s.hand.filter((id) => id !== a.card);
      s.discard.push(key, a.card);
      s.enc.diverts++;
      log(s, `Diverted: discarded ${cardDef(key).name} and ${cardDef(a.card).name}.`);
      return s;
    }
    case "regroup": {
      if (s.phase !== "fj" || s.regrouped) bad("You cannot regroup now.");
      if (!s.hand.includes(a.card)) bad("Discard a card from your hand.");
      s.regrouped = true;
      const rest = shuffle(s, s.hand.filter((id) => id !== a.card));
      s.discard.push(a.card);
      s.deck.push(...rest);
      s.hand = [];
      draw(s, 7);
      log(s, `Regrouped: discarded ${cardDef(a.card).name}.`);
      return s;
    }
    case "resolve": {
      if (!["action", "fj", "fe"].includes(s.phase)) bad("Nothing to resolve.");
      const E = evaluate(s, a.plan);
      if (E.errors.length) bad(E.errors[0]);
      return resolve(s, E, a.plan);
    }
    case "continue": {
      if (s.phase !== "result") bad("Nothing to continue.");
      return advance(s);
    }
    case "berserk": {
      const k = s.soak;
      if (s.phase !== "soak" || !k.berserk || !k.first) bad("Nothing to convert.");
      const n = Math.max(0, Math.min(a.n | 0, k.berserk, k.amount));
      k.berserk = 0;
      k.amount -= n;
      s.enc.xp += n;
      if (n) log(s, `Berserker turns ${n} damage into XP.`);
      if (k.amount <= 0) { s.soak = null; return advance(s); }
      if (capacity(s, k) < k.amount) return knockOut(s, k);
      return s;
    }
    case "soak": {
      const k = s.soak;
      if (s.phase !== "soak") bad("No damage to soak.");
      if (k.berserk) k.berserk = 0;
      if (!soakable(s).includes(a.card)) bad("That card cannot soak this damage.");
      const v = soakValue(s, a.card);
      k.used.push(a.card);
      k.first = false;
      k.amount -= v;
      log(s, `${cardDef(a.card).name} soaks ${v}.`);
      downgrade(s, a.card, k.mark);
      if (k.amount <= 0) { s.soak = null; return advance(s); }
      if (capacity(s, k) < k.amount) return knockOut(s, k);
      return s;
    }
    case "upgrade": {
      if (s.phase !== "upgrade") bad("You cannot upgrade now.");
      const cost = upgradeCost(s, a.card);
      if (cost == null || cost > s.enc.xp) bad("You cannot upgrade that card.");
      s.enc.xp -= cost;
      s.lv[a.card]++;
      log(s, `${cardDef(a.card).name} rises to level ${s.lv[a.card]}.`);
      if (!canUpgradeAny(s)) return advance(s);
      return s;
    }
    case "endUpgrade": {
      if (s.phase !== "upgrade") bad("You cannot do that now.");
      return advance(s);
    }
  }
  bad(`Unknown action ${a.type}`);
}

export function canDivert(s) {
  return s.phase === "action" && s.enc.diverts < 2 && s.deck.length >= 2 && s.hand.length >= 2;
}

function resolve(s, E, plan) {
  const t = E.target;
  const els = [...new Set(E.dmg.filter((d) => d.el).map((d) => d.el))];
  const summary = {
    kind: E.kind, outcome: E.outcome, tier: E.tier ?? null, action: E.action, need: E.need, what: E.what,
    init: E.init ?? null, enemyInit: E.enemyInit ?? null, dmg: E.dmg, tp: E.tp, xp: E.xp, img: t.img || null,
    n: t.n ?? null, unitCost: E.unitCost, lines: [...E.sets.flatMap((r) => r.lines), ...E.lines],
  };
  s.result = summary;
  s.phase = "result";
  const soakStep = { t: "soak", main: true, amount: E.damage, els, pierce: E.pierce, noSoak: E.noSoak, mod: E.shieldMod, berserk: E.berserk, label: "Damage" };
  if (E.kind === "E" || E.kind === "J") {
    const who = E.kind === "E" ? `enemy ${t.n}` : `journey ${t.n}`;
    log(s, `${t.regionName} ${who}: ${E.what} ${E.action} vs ${E.need} — ${{ complete: "Complete Victory", narrow: "Narrow Victory", loss: "Loss" }[E.outcome]}.`);
    Object.assign(s.enc, { used: E.used, reserve: E.reserve, dropReserve: E.dropReserve, xp: E.xp });
    s.poison += E.poison;
    s.todo = [];
    if (E.tp) s.todo.push({ t: "tp", n: E.tp, storm: t.hardship === "storm" });
    s.todo.push(soakStep, { t: "upgrade", unitCost: E.unitCost }, { t: "cleanup" });
  } else if (E.kind === "FJ") {
    s.todo = [];
    if (E.outcome === "lost") {
      log(s, `Final Journey: Move ${E.action} falls short of ${E.need}.`);
      s.todo.push({ t: "lose", why: `Your Move of ${E.action} could not reach ${dragon(s).name}.` });
    } else {
      log(s, `Final Journey: Move ${E.action} reaches tier ${E.tier + 1}.`);
      s.fjUnit = E.unitCost * 2;
      s.todo.push({ t: "tp", n: E.tp, final: true }, { t: "rest" });
    }
  } else {
    s.todo = [];
    if (E.outcome === "lost") {
      log(s, `Final Enemy: Attack ${E.action} falls short of ${E.need}.`);
      s.todo.push({ t: "lose", why: `Your Attack of ${E.action} could not wound ${dragon(s).name}.` });
    } else {
      log(s, `Final Enemy: Attack ${E.action} reaches tier ${E.tier + 1}.`);
      soakStep.amount += E.unitCost * 2;
      soakStep.final = true;
      s.todo.push(soakStep, { t: "score" });
      const d = dragon(s);
      if (d.poison) s.todo.push({ t: "soak", amount: d.poison, final: true, allowRe: true, mark: false, label: "Poison" });
      s.todo.push({ t: "win" });
    }
  }
  return s;
}

export { GLOSSARY };
