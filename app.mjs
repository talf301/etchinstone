import { act, canDivert, dragon, encounter, evaluate, face, liveCards, newGame, regionDef, score, soakValue, soakable, upgradeCost, campaign } from "./engine/game.mjs";
import { CAMPAIGNS, DIFFICULTIES, DRAGONS, ELEMENT_NAME, GLOSSARY, MAGES, NORTH_CARDS, cardDef } from "./engine/data.mjs";

const SAVE = "etchinstone.save.v1";
const PREFS = "etchinstone.prefs.v1";
const $ = (q) => document.querySelector(q);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ROMAN = ["", "I", "II", "III", "IV"];

let G = null;
try { G = JSON.parse(localStorage.getItem(SAVE) || "null"); } catch { G = null; }
if (G && G.v !== 1) G = null;
let prefs = { campaign: "base", dragon: "rodving", mages: [], difficulty: "normal", cavalier: false, glass: false };
try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS) || "{}")); } catch { /* defaults */ }
const U = { screen: "title", sig: "", pos: {}, sel: null, mode: null, pick: null, fuse: null, fuseTmp: null, opts: {}, picks: [], why: false };

// ---------- icons ----------
const PATHS = {
  hp: "M12 21s-7-4.6-9.5-9C.6 8.4 2.5 4 6.5 4c2 0 3.6 1 5.5 3 1.9-2 3.5-3 5.5-3 4 0 5.9 4.4 4 8-2.5 4.4-9.5 9-9.5 9z",
  init: "M13 2 4 14h6l-1 8 9-12h-6z",
  attack: "M3 3h3l8 8-2 2-9-9zM21 3h-3l-8 8 2 2 9-9zM6 14l4 4-2 1-1 2-3-3 2-1zM18 14l-4 4 2 1 1 2 3-3-2-1z",
  move: "M8 3h6v9l5 3c1 .6 2 1.5 2 3v2H7v-3H5V6c0-2 1-3 3-3z",
  armor: "M12 2l8 3v6c0 5-3.5 9-8 11-4.500-2-8-6-8-11V5z",
  time: "M6 2h12v3c0 3-3 5-4 7 1 2 4 4 4 7v3H6v-3c0-3 3-5 4-7-1-2-4-4-4-7z",
  xp: "M12 2l3 6.5 7 .9-5 4.9 1.3 7L12 18l-6.300 3.300 1.300-7-5-4.900 7-.900z",
  boost: "M12 3l7 8h-4v10H9V11H5z",
  deck: "M5 3h11a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2zM8 20h11V7h1v15H8z",
  menu: "M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z",
  zoom: "M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z",
  fuse: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z",
};
const ic = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[n]}"/></svg>`;
const el = (e, extra = "") => (e ? `<i class="el el-${e} ${extra}" title="${ELEMENT_NAME[e]}"></i>` : `<i class="el el-none ${extra}"></i>`);
const stat = (icon, v, e, cls = "") => `<span class="stat ${cls}">${ic(icon)}<b>${v}</b>${e ? el(e) : ""}</span>`;

// ---------- persistence ----------
function save() {
  if (G) localStorage.setItem(SAVE, JSON.stringify(G));
  else localStorage.removeItem(SAVE);
}
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), 2600);
}
function dispatch(a) {
  try {
    G = act(G, a);
    save();
    U.sel = U.pick = U.mode = null;
    render();
  } catch (e) {
    toast(e.message);
  }
}

// ---------- slots ----------
const REGION_SLOTS = ["spell", "element", "boost", "reserve"];
const FINAL_SLOTS = ["s0", "e0", "b0", "s1", "e1", "b1", "reserve"];
const SLOT_NAME = { spell: "Spell", element: "Element", boost: "Boost", reserve: "Reserve", s0: "Spell", e0: "Element", b0: "Boost", s1: "Spell", e1: "Element", b1: "Boost" };
const SLOT_ICON = { spell: "attack", element: "init", boost: "boost", reserve: "deck", s0: "attack", e0: "init", b0: "boost", s1: "attack", e1: "init", b1: "boost" };
const isFinal = () => G.phase === "fj" || G.phase === "fe";
const planning = () => ["action", "fj", "fe"].includes(G.phase);

function slotKeys() {
  if (!isFinal()) return REGION_SLOTS;
  const extra = Math.max(0, G.hand.length - 7);
  return [...FINAL_SLOTS, ...[...Array(extra)].map((_, i) => `bench${i}`)];
}
function syncSlots() {
  const sig = `${G.phase}|${G.hand.join(",")}|${G.deck[0]}`;
  if (U.sig === sig) return;
  U.sig = sig;
  Object.assign(U, { pos: {}, sel: null, mode: null, pick: null, fuse: null, fuseTmp: null, opts: {}, why: false });
  const keys = slotKeys();
  let order = keys;
  if (isFinal() && G.hand.length < 6) order = ["s0", "s1", "e0", "b0", "e1", "b1", "reserve"];
  keys.forEach((k) => (U.pos[k] = null));
  G.hand.forEach((id, i) => { if (order[i]) U.pos[order[i]] = id; });
}
function plan() {
  const p = U.pos;
  const sets = isFinal()
    ? [{ spell: p.s0, element: p.e0, boost: p.b0 }, { spell: p.s1, element: p.e1, boost: p.b1 }]
    : [{ spell: p.spell, element: p.element, boost: p.boost }];
  return { sets, reserve: p.reserve ?? null, fuse: U.fuse, opts: U.opts };
}
function compact() {
  // After fusing, pull a spare card into an empty role.
  const roles = slotKeys().filter((k) => k !== "reserve" && !k.startsWith("bench"));
  const spare = slotKeys().filter((k) => k === "reserve" || k.startsWith("bench"));
  for (const r of roles) {
    if (U.pos[r] != null) continue;
    const from = spare.find((k) => U.pos[k] != null);
    if (!from) break;
    U.pos[r] = U.pos[from];
    U.pos[from] = null;
  }
}

// ---------- card rendering ----------
const cardImg = (id, lv = G.lv[id]) => `img/m/${cardDef(id).img}-${lv}.webp`;
function cardHTML(id, { badge = "", cls = "", under = null } = {}) {
  const lv = G.lv[id];
  return `<div class="card ${cls}" data-card="${id}">
    ${under != null ? `<img class="under" src="${cardImg(under)}" alt="">` : ""}
    <img src="${cardImg(id)}" alt="${esc(cardDef(id).name)} level ${lv}" draggable="false">
    <span class="lv lv${lv}">${ROMAN[lv]}</span>${badge}
    <button class="zoom" data-zoom="${id}" aria-label="Enlarge">${ic("zoom")}</button>
  </div>`;
}

// ---------- screens ----------
function render() {
  const app = $("#app");
  if (U.screen === "title" || !G && U.screen !== "setup") { U.screen = "title"; app.innerHTML = titleHTML(); return; }
  if (U.screen === "setup") { app.innerHTML = setupHTML(); return; }
  if (G.phase === "setup") { app.innerHTML = difficultyHTML(); return; }
  if (G.phase === "won" || G.phase === "lost") { app.innerHTML = endHTML(); return; }
  syncSlots();
  app.innerHTML = gameHTML();
}

function titleHTML() {
  return `<main class="title">
    <div class="title-art"></div>
    <div class="title-body">
      <p class="over">A solo adventure in the land of Vale</p>
      <h1><span>Dragons</span><em>of</em><span>Etchinstone</span></h1>
      <div class="title-btns">
        ${G && G.phase !== "won" && G.phase !== "lost" ? `<button class="btn gold" data-act="continue-game">Continue the hunt</button>` : ""}
        <button class="btn ${G ? "" : "gold"}" data-act="new">New expedition</button>
        <button class="btn ghost" data-act="rules">How to play</button>
      </div>
      <p class="credit">Game by Joe Klipfel. Unofficial fan implementation.</p>
    </div>
  </main>`;
}

function setupHTML() {
  const c = prefs;
  const dragons = DRAGONS.filter((d) => d.campaign === c.campaign);
  if (!dragons.some((d) => d.id === c.dragon)) c.dragon = dragons[0].id;
  const seg = (key, items) => `<div class="seg">${items.map(([v, label]) => `<button class="${c[key] === v ? "on" : ""}" data-set="${key}" data-v="${v}">${label}</button>`).join("")}</div>`;
  const d = DIFFICULTIES.find((x) => x.id === c.difficulty);
  return `<main class="setup">
    <header class="bar"><button class="link" data-act="title">‹ Back</button><h2>New expedition</h2><span></span></header>
    <div class="scroll">
      <h3>Realm</h3>
      ${seg("campaign", [["base", "Etchinstone"], ["north", "Northvale"]])}
      <p class="hint">${c.campaign === "base" ? "Jade Mountains, Living Marshes, Burning Basin, Forest of Gath." : "Severed Seaboard, Whispering Fields, Forgotten Foothills, Northvale. New enemy abilities and perils."}</p>
      <h3>Hunt a ${c.campaign === "base" ? "dragon" : "boss"}</h3>
      <div class="dragons">${dragons.map((g) => `<button class="dragon ${c.dragon === g.id ? "on" : ""}" data-set="dragon" data-v="${g.id}">
        <img src="img/d/${g.id}.webp" alt=""><span class="dn">${g.name}</span>
        <span class="ds">${stat("init", g.init)}${stat("attack", g.early, g.el)}${g.armor.map((a) => stat("armor", a.v, a.el)).join("")}</span>
      </button>`).join("")}</div>
      <h3>Ether mages <small>optional, from Northvale</small></h3>
      <div class="mages">${MAGES.map((m) => `<button class="mage ${c.mages.includes(m.id) ? "on" : ""}" data-mage="${m.id}"><b>${m.name}</b><span>${m.blurb}</span>
        <span class="mini">${NORTH_CARDS.filter((x) => x.mage === m.id).map((x) => `<img src="img/m/${x.img}-2.webp" alt="${esc(x.name)}">`).join("")}</span></button>`).join("")}</div>
      <h3>Difficulty</h3>
      <div class="seg wrap">${DIFFICULTIES.map((x) => `<button class="${c.difficulty === x.id ? "on" : ""}" data-set="difficulty" data-v="${x.id}">${x.name}</button>`).join("")}</div>
      <p class="hint">${d.text}</p>
      <h3>Alternate rules</h3>
      <label class="check"><input type="checkbox" data-toggle="cavalier" ${c.cavalier ? "checked" : ""}><span><b>Cavalier</b> You cannot fuse cards.</span></label>
      <label class="check"><input type="checkbox" data-toggle="glass" ${c.glass ? "checked" : ""}><span><b>Glass Cannon</b> Matching armor gives +1 instead of double.</span></label>
    </div>
    <footer class="actions"><button class="btn gold wide" data-act="begin">Begin the adventure</button></footer>
  </main>`;
}

function difficultyHTML() {
  const { drawn, pick, to } = G.setup;
  return `<main class="game">
    <header class="bar"><button class="iconbtn" data-act="menu">${ic("menu")}</button><h2>Prepare the deck</h2><span></span></header>
    <div class="top"><section class="panel"><h3>${to === 3 ? "Upgrade" : "Downgrade"} <b>${pick}</b> of these cards</h3><p class="hint">Chosen cards start at level ${to}. All five are shuffled back into the deck.</p></section></div>
    <div class="midwrap"><div class="hand grid2 scrolly">${drawn.map((id) => cardHTML(id, { cls: U.picks.includes(id) ? "picked" : "", badge: U.picks.includes(id) ? `<span class="badge good">Level ${to}</span>` : "" })).join("")}</div></div>
    <footer class="actions"><button class="btn gold wide" data-act="confirm-difficulty" ${U.picks.length === pick ? "" : "disabled"}>Confirm (${U.picks.length}/${pick})</button></footer>
  </main>`;
}

function topBar() {
  const final = isFinal() || (G.phase !== "action" && G.final);
  const pips = [1, 2, 3, 4].map((n) => `<i class="${n < G.region || inFinal() ? "done" : n === G.region ? "now" : ""}"></i>`).join("") + `<i class="boss ${inFinal() ? "now" : ""}"></i>`;
  const where = inFinal() ? dragon(G).name : regionDef(G).name;
  return `<header class="bar">
    <button class="iconbtn" data-act="menu" aria-label="Menu">${ic("menu")}</button>
    <div class="where"><b>${where}</b><span class="pips">${pips}</span></div>
    <button class="counts" data-act="cards" aria-label="Your cards">${ic("deck")}<b>${G.deck.length}</b><small>deck</small></button>
  </header>`;
}
const inFinal = () => G.phase === "fj" || G.phase === "fe" || (G.result && (G.result.kind === "FJ" || G.result.kind === "FE")) || (G.soak && G.soak.final) || G.final;

function gloss(k) {
  return GLOSSARY[k] ? `<button class="chip" data-gloss="${k}">${GLOSSARY[k][0]}</button>` : "";
}

function encounterHTML(E) {
  const t = E?.target || encounter(G);
  if (!t) return "";
  if (t.kind === "FJ" || t.kind === "FE") return dragonHTML(t.kind, E);
  const key = cardDef(t.key).name;
  let stats, title, chips = "";
  if (t.kind === "E") {
    const e = t.enemy;
    title = `Enemy ${t.n}`;
    stats = `${stat("hp", E?.need ?? e.hp)}${stat("init", e.init)}${stat("attack", e.atk, e.atkEl)}${e.armor.map((a) => stat("armor", a.v, a.el)).join("")}${stat("xp", e.xp, null, "xp")}`;
    chips = e.abilities.map(gloss).join("");
  } else {
    const j = t.journey;
    title = `Journey ${t.n}`;
    stats = `${stat("move", E?.need ?? j.mp, j.el)}${stat("time", j.tp)}${stat("xp", j.xp, null, "xp")}`;
    chips = j.peril ? gloss(j.peril) : "";
  }
  if (t.hardship) chips += `<button class="chip hard" data-gloss="${t.hardship}">${GLOSSARY[t.hardship][0]}</button>`;
  return `<section class="enc ${t.kind === "E" ? "enemy" : "journey"}">
    <button class="enc-art" data-act="region"><img src="img/e/${t.img}.webp" alt=""></button>
    <div class="enc-info">
      <div class="enc-title">${title}<small>Region ${t.region} · key card ${esc(key)}</small></div>
      <div class="stats">${stats}</div>
      <div class="chips">${chips || `<span class="nochip">No abilities or hardship</span>`}</div>
    </div>
  </section>`;
}

function dragonHTML(kind, E) {
  const d = dragon(G);
  const tiers = kind === "FJ" ? d.mp : d.hp;
  const rows = tiers.map((t, i) => `<div class="tier ${E && !E.errors.length && E.tier === i ? "on" : ""}">
      <span>Tier ${i + 1}</span>${kind === "FJ" ? `${stat("move", t.v, d.el)}${stat("time", t.tp)}` : `${stat("hp", t.v)}${stat("attack", t.atk, d.el)}`}</div>`).join("");
  return `<section class="enc dragonp">
    <button class="enc-art" data-act="dragon"><img src="img/d/${d.id}.webp" alt=""></button>
    <div class="enc-info">
      <div class="enc-title">${kind === "FJ" ? "The Final Journey" : "The Final Enemy"}<small>${d.name}${d.title ? ` · ${d.title}` : ""}</small></div>
      ${kind === "FE" ? `<div class="stats">${stat("init", d.init)}${stat("attack", d.early, d.el)}${d.armor.map((a) => stat("armor", a.v, a.el)).join("")}${d.abilities.map(gloss).join("")}</div>` : ""}
      <div class="tiers three">${rows}</div>
    </div>
  </section>`;
}

const OUTCOME = { complete: "Complete Victory", narrow: "Narrow Victory", loss: "Loss", lost: "Not enough", tier: "" };
function consequences(E) {
  const out = [];
  for (const d of E.dmg) out.push(`<span class="cq bad">${d.label} ${d.amount}${d.el ? el(d.el) : ""}</span>`);
  if (E.tp) out.push(`<span class="cq bad">${ic("time")} ${E.tp} time</span>`);
  if (E.xp) out.push(`<span class="cq good">${ic("xp")} ${E.xp} XP</span>`);
  if (E.unitCost) out.push(`<span class="cq">Unit −${isFinal() ? E.unitCost * 2 + " dmg" : E.unitCost + " XP"}</span>`);
  if (E.poison) out.push(`<span class="cq bad">Poison +${E.poison}</span>`);
  if (E.dropReserve) out.push(`<span class="cq bad">Reserve discarded</span>`);
  if (E.berserk) out.push(`<span class="cq good">Berserker ≤${E.berserk}</span>`);
  if (!out.length) out.push(`<span class="cq good">No penalty</span>`);
  return out.join("");
}
function meter(E) {
  let marks = "", max;
  if (E.kind === "E" || E.kind === "J") {
    max = E.need;
    marks = `<i style="left:${(E.half / max) * 100}%"></i>`;
  } else {
    const d = dragon(G), tiers = E.kind === "FJ" ? d.mp : d.hp;
    max = tiers[2].v;
    marks = tiers.slice(0, 2).map((t) => `<i style="left:${(t.v / max) * 100}%"></i>`).join("");
  }
  const pct = Math.max(0, Math.min(100, (E.action / max) * 100));
  return `<div class="meter"><b style="width:${pct}%"></b>${marks}</div>`;
}
function previewHTML(E) {
  if (E.errors.length) return `<section class="preview"><p class="need">${esc(E.errors[0])}</p>${optionsHTML(E)}</section>`;
  const cls = E.outcome === "tier" ? (E.tier === 2 ? "complete" : "narrow") : E.outcome === "lost" ? "loss" : E.outcome;
  const label = E.outcome === "tier" ? `Tier ${E.tier + 1}` : OUTCOME[E.outcome];
  const needIcon = E.kind === "E" || E.kind === "FE" ? "hp" : "move";
  const initRow = E.kind === "E" || E.kind === "FE"
    ? `<div class="initrow ${E.early ? "bad" : "good"}">${ic("init")}<b>${E.init}</b> vs ${E.enemyInit}<span>${E.early ? `early damage ${E.early}` : E.init >= E.enemyInit ? "you strike first" : "no early damage"}</span></div>` : "";
  const lines = [...E.sets.flatMap((r) => [...(r.lines || []), ...((E.kind === "E" || E.kind === "FE") && r.initLines?.length > 1 ? [r.initLines.join(" ")] : [])]), ...E.lines];
  return `<section class="preview ${cls}">
    <div class="vs">
      <div class="num you">${E.action}<small>${E.what}</small></div>
      <div class="mid">${meter(E)}<div class="outcome">${label}</div></div>
      <div class="num foe">${ic(needIcon)}${E.kind === "E" || E.kind === "J" ? E.need : dragonTop(E)}</div>
    </div>
    ${initRow}
    <div class="conseq">${consequences(E)}</div>
    ${optionsHTML(E)}
    <button class="whybtn" data-act="why">${U.why ? "Hide the sums" : "Show the sums"}</button>
    ${U.why ? `<ul class="why">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
  </section>`;
}
function dragonTop(E) {
  const d = dragon(G), tiers = E.kind === "FJ" ? d.mp : d.hp;
  const next = tiers.find((t) => t.v > E.action);
  return next ? next.v : tiers[2].v;
}
function optionsHTML(E) {
  if (!E.options.length) return "";
  return `<div class="opts ${E.options.length > 1 ? "two" : ""}">${E.options.map((o) => `<div class="opt"><span>${esc(o.label)}</span><div class="seg small">${o.choices.map((c) =>
    `<button class="${c.v === o.value ? "on" : ""}" data-opt="${o.key}" data-v='${JSON.stringify(c.v)}'>${"WFLS".includes(c.label) && c.label.length === 1 ? el(c.label) + ELEMENT_NAME[c.label] : esc(c.label)}</button>`).join("")}</div></div>`).join("")}</div>`;
}

function slotHTML(key, E) {
  const id = U.pos[key];
  const sel = U.sel === key ? "sel" : "";
  const bench = key.startsWith("bench");
  let inner = `<div class="empty">${bench ? "" : SLOT_NAME[key]}</div>`;
  if (id != null) {
    let cls = "";
    if (U.mode === "fuse-top" && !canFuseWith(id)) cls = "dim";
    if (U.pick === id) cls += " picked";
    const fusedTop = U.fuse && U.fuse.top === id;
    inner = cardHTML(id, { cls, under: fusedTop ? U.fuse.bottom : null, badge: fusedTop ? `<span class="badge fuse">${el(U.fuse.color)}Fused</span>` : "" });
  }
  return `<div class="slot ${sel} ${id == null ? "vacant" : ""} ${bench ? "bench" : ""}" data-slot="${key}">
    <div class="tag">${bench ? "Unused" : `${ic(SLOT_ICON[key])}${/[01]$/.test(key) ? `<i>${+key.at(-1) + 1}</i>` : ""}${SLOT_NAME[key]}`}</div>${inner}</div>`;
}
function canFuseWith(id) {
  const b = U.fuseTmp?.bottom;
  if (b == null || b === id) return false;
  return face(G, id).bg.some((c) => face(G, b).bg.includes(c));
}

function handHTML(E) {
  if (!isFinal()) return `<div class="hand grid2 fit">${REGION_SLOTS.map((k) => slotHTML(k, E)).join("")}</div>`;
  const keys = slotKeys();
  const row = (ks) => ks.map((k) => slotHTML(k, E)).join("");
  return `<div class="hand final scrolly">
    <div class="grid3 set1">${row(["s0", "e0", "b0"])}</div>
    <div class="grid3 set2">${row(["s1", "e1", "b1"])}</div>
    <div class="grid3">${row(keys.slice(6))}</div>
  </div>`;
}

function modeBanner() {
  const m = {
    divert: "Divert: choose a card to discard with the key card.",
    regroup: "Regroup: choose one card to discard. The other six are shuffled to the back of the deck.",
    "fuse-bottom": "Fuse: tap the card to tuck underneath.",
    "fuse-top": "Fuse: tap a card of the same element to keep on top.",
  }[U.mode];
  if (m) return `<div class="banner">${m}</div>`;
  if (U.sel != null && U.pos[U.sel] != null) return `<div class="banner">Now tap the role for ${esc(cardDef(U.pos[U.sel]).name)}. The two cards swap.</div>`;
  return `<div class="tip">Tap a card, then tap another role to swap them.</div>`;
}

function actionsHTML(E) {
  if (U.mode === "divert" || U.mode === "regroup") {
    const verb = U.mode === "divert" ? "Divert" : "Regroup";
    return `<button class="btn" data-act="cancel">Cancel</button>
      <button class="btn gold grow" data-act="confirm-${U.mode}" ${U.pick == null ? "disabled" : ""}>${U.pick == null ? "Choose a card" : `${verb}: discard ${esc(cardDef(U.pick).name)}`}</button>`;
  }
  if (U.mode?.startsWith("fuse")) return `<button class="btn grow" data-act="cancel">Cancel fusing</button>`;
  const out = [];
  if (G.phase === "action") out.push(`<button class="btn" data-act="divert" ${canDivert(G) ? "" : "disabled"}>Divert<small>${2 - G.enc.diverts} left</small></button>`);
  if (G.phase === "fj") out.push(`<button class="btn" data-act="regroup" ${G.regrouped ? "disabled" : ""}>Regroup<small>${G.regrouped ? "used" : "once"}</small></button>`);
  if (!G.cfg.cavalier) out.push(`<button class="btn ${U.fuse ? "on" : ""}" data-act="fuse" ${G.hand.length < 2 ? "disabled" : ""}>${U.fuse ? "Unfuse" : "Fuse"}<small>${U.fuse ? "undo" : "2 cards"}</small></button>`);
  const ok = !E.errors.length;
  const verb = G.phase === "fj" ? "Make the journey" : G.phase === "fe" ? "Attack the dragon" : E.kind === "J" ? "Journey" : "Fight";
  out.push(`<button class="btn gold grow" data-act="resolve" ${ok ? "" : "disabled"}>${verb}</button>`);
  return out.join("");
}

function resultHTML() {
  const r = G.result;
  const cls = r.outcome === "tier" ? (r.tier === 2 ? "complete" : "narrow") : r.outcome === "lost" ? "loss" : r.outcome;
  const label = r.outcome === "tier" ? `Tier ${r.tier + 1} reached` : r.outcome === "lost" ? "You fall short" : OUTCOME[r.outcome];
  const E = { dmg: r.dmg, tp: r.tp, xp: r.xp, unitCost: r.unitCost };
  const img = r.img ? `img/e/${r.img}.webp` : `img/d/${G.cfg.dragon}.webp`;
  return `<section class="result ${cls}">
    <img class="rimg" src="${img}" alt="">
    <h2>${label}</h2>
    <p class="rnum">${r.what} <b>${r.action}</b> against <b>${r.need}</b>${r.init != null && r.enemyInit != null ? ` · Initiative <b>${r.init}</b> against <b>${r.enemyInit}</b>` : ""}</p>
    <div class="conseq">${consequences(E)}</div>
    <ul class="why">${r.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
  </section>`;
}

function recapHTML() {
  const r = G.result;
  if (!r) return "";
  const cls = r.outcome === "tier" ? (r.tier === 2 ? "complete" : "narrow") : r.outcome === "lost" ? "loss" : r.outcome;
  const label = r.outcome === "tier" ? `Tier ${r.tier + 1}` : OUTCOME[r.outcome];
  const img = r.img ? `img/e/${r.img}.webp` : `img/d/${G.cfg.dragon}.webp`;
  return `<section class="recap ${cls}"><img src="${img}" alt=""><div><b>${label}</b><span>${r.what} ${r.action} against ${r.need}</span></div><div class="conseq">${consequences({ dmg: r.dmg, tp: r.tp, xp: r.xp, unitCost: 0 })}</div></section>`;
}
function soakPanel() {
  const k = G.soak;
  const pick = U.pick;
  let prev = `<p class="hint">Tap a card to downgrade it. Each card soaks damage equal to its armor${k.els.length ? `; ${k.els.map((e) => el(e)).join("")} armor counts ${G.cfg.glass ? "+1" : "double"}` : ""}${k.pierce ? "; Pierce ignores armor color" : ""}.</p>`;
  if (k.mod && k.first) prev += `<p class="hint">The first card you choose has ${k.mod > 0 ? "+" : ""}${k.mod} armor.</p>`;
  if (k.berserk) {
    prev = `<p class="hint">Berserker may turn damage into XP.</p><div class="seg">${[...Array(k.berserk + 1).keys()].map((n) => `<button data-berserk="${n}">${n === 0 ? "Keep it" : `${n} → XP`}</button>`).join("")}</div>`;
  } else if (pick != null) {
    const lv = G.lv[pick];
    prev = `<div class="change"><img src="${cardImg(pick)}" alt=""><span>→</span>${lv > 1 ? `<img src="${cardImg(pick, lv - 1)}" alt="">` : `<div class="trash">Trashed<small>removed from the game</small></div>`}</div>`;
  }
  return `<section class="panel soak">
    <h3>${esc(k.label)}: soak <b>${k.amount}</b>${k.total !== k.amount ? ` <small>of ${k.total}</small>` : ""}</h3>${prev}</section>`;
}
function upgradePanel() {
  const pick = U.pick;
  let prev = `<p class="hint">Tap a card to upgrade it. Cards downgraded this encounter cannot be upgraded. Unspent XP is lost.</p>`;
  if (pick != null) prev = `<div class="change"><img src="${cardImg(pick)}" alt=""><span>→</span><img src="${cardImg(pick, G.lv[pick] + 1)}" alt=""></div>`;
  return `<section class="panel upgrade"><h3>${ic("xp")} Spend <b>${G.enc.xp}</b> XP</h3>${prev}</section>`;
}
function plainHand(badgeFor) {
  const n = G.hand.length;
  return `<div class="hand ${n > 4 ? "grid3" : "grid2 fit"} scrolly">${G.hand.map((id) => {
    const b = badgeFor(id);
    return cardHTML(id, { cls: `${b.cls || ""} ${U.pick === id ? "picked" : ""}`, badge: b.html || "" });
  }).join("")}</div>`;
}

function gameHTML() {
  let top = "", mid = "", actions = "";
  if (planning()) {
    const E = evaluate(G, plan());
    // keep the chosen options in step with what is offered
    top = encounterHTML(E) + previewHTML(E) + modeBanner();
    mid = handHTML(E);
    actions = actionsHTML(E);
  } else if (G.phase === "result") {
    top = resultHTML();
    mid = plainHand(() => ({}));
    actions = `<button class="btn gold wide" data-act="next">Continue</button>`;
  } else if (G.phase === "soak") {
    const ok = soakable(G);
    top = recapHTML() + soakPanel();
    mid = plainHand((id) => ok.includes(id)
      ? { html: `<span class="badge soakb">${ic("armor")}${soakValue(G, id)}</span>` }
      : { cls: "dim", html: `<span class="badge off">${G.soak.noSoak.includes(id) ? "Pierced" : "Already hit"}</span>` });
    actions = `<button class="btn gold wide" data-act="confirm-soak" ${U.pick == null ? "disabled" : ""}>${U.pick == null ? (G.soak.berserk ? "Decide Berserker first" : "Choose a card") : `Downgrade ${esc(cardDef(U.pick).name)} (soaks ${soakValue(G, U.pick)})`}</button>`;
  } else if (G.phase === "upgrade") {
    top = recapHTML() + upgradePanel();
    mid = plainHand((id) => {
      const c = upgradeCost(G, id);
      if (c == null) return { cls: "dim", html: `<span class="badge off">${G.lv[id] >= 4 ? "Max level" : "Downgraded"}</span>` };
      return c <= G.enc.xp ? { html: `<span class="badge xpb">${ic("xp")}${c}</span>` } : { cls: "dim", html: `<span class="badge off">${ic("xp")}${c}</span>` };
    });
    actions = `<button class="btn" data-act="end-upgrade">Done</button><button class="btn gold grow" data-act="confirm-upgrade" ${U.pick == null ? "disabled" : ""}>${U.pick == null ? "Choose a card" : `Upgrade ${esc(cardDef(U.pick).name)} (${upgradeCost(G, U.pick)} XP)`}</button>`;
  }
  return `<main class="game ph-${G.phase}">${topBar()}<div class="top">${top}</div><div class="midwrap">${mid}</div><footer class="actions">${actions}</footer></main>`;
}

function endHTML() {
  const won = G.phase === "won";
  const d = dragon(G);
  return `<main class="end ${won ? "won" : "lost"}">
    <img class="endart" src="img/landscape.webp" alt="">
    <div class="endbody">
      <p class="over">${won ? "Protector of the Realm" : "The hunt ends here"}</p>
      <h1>${won ? `${d.name} is slain` : "You have fallen"}</h1>
      ${won ? `<div class="scorebox"><small>Score</small><b>${G.score}</b><small>sum of your surviving card levels</small></div>` : `<p class="lostwhy">${esc(G.lostWhy || "")}</p>`}
      <div class="title-btns"><button class="btn gold" data-act="new">New expedition</button><button class="btn ghost" data-act="cards">Review your cards</button><button class="btn ghost" data-act="log">Read the chronicle</button></div>
    </div>
  </main>`;
}

// ---------- modals ----------
function modal(html, cls = "") {
  $("#modal").innerHTML = `<div class="shade" data-act="close"></div><div class="sheet ${cls}">${html}<button class="btn wide" data-act="close">Close</button></div>`;
  $("#modal").classList.add("on");
}
function closeModal() {
  $("#modal").classList.remove("on");
  $("#modal").innerHTML = "";
}
function zoomModal(id, lv = G.lv[id]) {
  const def = cardDef(id);
  const f = def.levels[lv - 1];
  const notes = [];
  if (f.hardship) notes.push(`As key card: ${GLOSSARY[f.hardship][0]}. ${GLOSSARY[f.hardship][1]}`);
  if (f.ability) notes.push(abilityText(f.ability));
  modal(`<h3>${esc(def.name)}</h3>
    <img class="big" src="${cardImg(id, lv)}" alt="">
    <div class="seg">${[1, 2, 3, 4].map((n) => `<button class="${n === lv ? "on" : ""}" data-zoomlv="${id}:${n}">${ROMAN[n]}${n === G.lv[id] ? " ●" : ""}</button>`).join("")}</div>
    <p class="hint">Level ${lv}${lv === G.lv[id] ? " (current)" : ""}. Key card for ${f.enc.t === "E" ? "enemy" : "journey"} ${f.enc.n}. ${f.xp ? `Upgrade cost ${f.xp} XP.` : "Fully upgraded."}</p>
    ${notes.map((n) => `<p class="note">${esc(n)}</p>`).join("")}`, "zoomsheet");
}
function abilityText(a) {
  switch (a.kind) {
    case "power": return `As Element: +${a.element} to your spell.${a.reserve ? ` In Reserve: +${a.reserve} to your spell.` : ""}`;
    case "slowWit": return `As Spell or Boost: −${a.x} Initiative. Colorless: gives no ether, so as Element your spell uses its basic action. Cannot be fused.`;
    case "windwalker": return `You may face a neighbouring encounter. Left when this card is ${a.left.join(" or ")}; right when it is ${a.right.join(" or ")}.`;
    case "chain": return "Enhanced action: play the ether action of your Reserve card instead, plus the printed bonus.";
    case "pursuer": return "Pursuer while in hand, unless this card is your Element: enemies have +1 HP (+2 in regions 3 and 4); on a journey you must also beat the same-numbered enemy's Initiative or suffer its attack.";
    case "drain": return `In Reserve: your Boost is reduced by ${a.x}. Its enhanced action triggers on either printed ether.`;
    case "unit": return `Unit, rank ${a.rank}: you may hire it for +${a.rank} ${a.skills.join(" or +" + a.rank + " ")}. Cost by this card's role: Boost 1 XP, Spell 2, Element 3, Reserve 4. Unpaid XP becomes damage. In the Final Battle the cost is paid as double damage.`;
    case "berserk": return `As Element or Spell: you may turn up to ${a.x} enemy damage into XP.`;
    case "contingency": return `While in hand, by the ether color of your Reserve card: Fire +${a.x} Attack, Shadow +${a.x} Move, Water +${a.x} armor on the first card you soak with, Lightning +${a.x} Initiative.`;
    case "illumined": return `While in hand, by the ether color of your Boost card: Fire −${a.x} armor on the first card you soak with, Shadow or Water −${a.x} Move, Lightning −${a.x} Initiative.`;
    case "seeingRed": return `In Reserve or as Spell: if your Boost's basic action is an attack, +${a.plus} Attack; if it is a move, −${a.minus} Move.`;
  }
  return "";
}
function regionModal() {
  const r = regionDef(G), key = regionDef(G).img;
  const now = encounter(G);
  const cell = (kind, n) => `<button class="rc ${now && now.kind === kind && now.n === n ? "now" : ""}"><img src="img/e/${key}${kind === "E" ? "e" : "j"}${n}.webp" alt=""><small>${kind === "E" ? "Enemy" : "Journey"} ${n}</small></button>`;
  const abilities = [...new Set([...r.enemies.flatMap((e) => e.abilities), ...r.journeys.map((j) => j.peril).filter(Boolean)])];
  modal(`<h3>${r.name} <small>Region ${G.region}</small></h3>
    <div class="rgrid">${[1, 2, 3, 4].map((n) => cell("E", n)).join("")}${[1, 2, 3, 4].map((n) => cell("J", n)).join("")}</div>
    ${abilities.map((a) => `<p class="note"><b>${GLOSSARY[a][0]}.</b> ${GLOSSARY[a][1]}</p>`).join("")}`);
}
function dragonModal() {
  const d = dragon(G);
  const img = d.campaign === "north" ? `img/r/n-${d.id}.webp` : `img/d/${d.id}.webp`;
  modal(`<h3>${d.name}</h3><img class="big" src="${img}" alt="">
    <div class="stats center">${stat("init", d.init)}${stat("attack", d.early, d.el)}${d.armor.map((a) => stat("armor", a.v, a.el)).join("")}</div>
    <p class="hint">Initiative, Early Damage, Armor.</p>
    <div class="tiers two"><div>${d.mp.map((t, i) => `<div class="tier"><span>Journey ${i + 1}</span>${stat("move", t.v, d.el)}${stat("time", t.tp)}</div>`).join("")}</div>
    <div>${d.hp.map((t, i) => `<div class="tier"><span>Enemy ${i + 1}</span>${stat("hp", t.v)}${stat("attack", t.atk, d.el)}</div>`).join("")}</div></div>
    ${d.abilities.map((a) => `<p class="note"><b>${GLOSSARY[a][0]}.</b> ${a === "poison" ? `After all other damage you must also soak ${d.poison} poison damage; cards may be downgraded again. Your score is recorded first.` : GLOSSARY[a][1]}</p>`).join("")}`);
}
function cardsModal() {
  const zone = (id) => G.trashed.includes(id) ? "Trashed" : G.hand.includes(id) ? "Hand" : G.deck.includes(id) ? "Deck" : "Discard";
  const ids = Object.keys(G.lv).map(Number);
  const order = { Hand: 0, Deck: 1, Discard: 2, Trashed: 3 };
  ids.sort((a, b) => order[zone(a)] - order[zone(b)] || a - b);
  modal(`<h3>Your mage cards <small>score now ${score(G)}</small></h3>
    <p class="hint">Deck ${G.deck.length} · Discard ${G.discard.length} · Trashed ${G.trashed.length}. Deck order stays hidden.</p>
    <div class="allcards">${ids.map((id) => `<button class="mini ${zone(id).toLowerCase()}" data-zoom="${id}"><img src="${cardImg(id)}" alt="${esc(cardDef(id).name)}"><small>${zone(id)} · ${ROMAN[G.lv[id]]}</small></button>`).join("")}</div>`, "tall");
}
function logModal() {
  modal(`<h3>Chronicle</h3><ol class="log">${G.log.slice().reverse().map((l) => `<li>${esc(l)}</li>`).join("")}</ol>`, "tall");
}
function menuModal() {
  modal(`<h3>Dragons of Etchinstone</h3>
    <div class="menu">
      <button class="btn" data-act="cards">Your cards</button>
      ${G && G.phase !== "setup" ? `<button class="btn" data-act="region">Region card</button><button class="btn" data-act="dragon">${dragon(G).name}</button>` : ""}
      <button class="btn" data-act="log">Chronicle</button>
      <button class="btn" data-act="rules">How to play</button>
      <button class="btn" data-act="title">Save and leave</button>
      <button class="btn danger" data-act="abandon">Abandon expedition</button>
    </div>
    <p class="hint">${CAMPAIGNS[G.cfg.campaign].name} · ${DIFFICULTIES.find((d) => d.id === G.cfg.difficulty).name}${G.cfg.cavalier ? " · Cavalier" : ""}${G.cfg.glass ? " · Glass Cannon" : ""}${G.cfg.mages.length ? " · " + G.cfg.mages.map((m) => MAGES.find((x) => x.id === m).name).join(", ") : ""}</p>`);
}
function rulesModal() {
  const g = (k) => `<p class="note"><b>${GLOSSARY[k][0]}.</b> ${GLOSSARY[k][1]}</p>`;
  modal(`<h3>How to play</h3><div class="rules">
    <p>Cross four regions, make the Final Journey, and defeat a dragon. Each region lasts one pass through your deck of 16 mage cards.</p>
    <h4>An encounter</h4>
    <p>The top card of the deck is the <b>key card</b>: it names the enemy or journey you face and may add a hardship. You may <b>divert</b> up to twice: discard the key card and one hand card to face the next encounter.</p>
    <p>Give three of your four cards a role. The fourth is your <b>Reserve</b> and stays in hand.</p>
    <ul><li><b>Spell</b>: your Attack against an enemy or Move on a journey. A move played as an attack, or the reverse, counts as 1.</li>
    <li><b>Element</b>: its color is your ether and its Initiative is yours. If it matches the color of the Spell's lower action, the Spell is <b>enhanced</b>.</li>
    <li><b>Boost</b>: adds its bonus to Attack or Initiative (enemy) or Move (journey).</li></ul>
    <p><b>Fuse</b> once per encounter: tuck one card under another of the same color and give the top card any color. Both are discarded afterwards.</p>
    <h4>Enemies</h4>
    <p>If the enemy's Initiative is higher than yours, you suffer its attack as Early Damage. An enhanced attack is reduced by enemy armor of the same color. Reach its HP for a Complete Victory; reach half for a Narrow Victory (XP, but you suffer its attack); less is a Loss.</p>
    <h4>Journeys</h4>
    <p>An enhanced move of the journey's color also adds your Reserve card's boost. Reach the MP for a Complete Victory; half is a Narrow Victory (XP, but you lose time); less is a Loss.</p>
    <h4>Penalties</h4>
    <p><b>Time</b> discards cards from the top of the deck. <b>Damage</b> is soaked by downgrading hand cards: each soaks its armor, doubled when the armor's color matches the attack. A card is downgraded once per encounter; a level 1 card is trashed. If you cannot soak it all you are knocked out: every card is downgraded and four cards are discarded.</p>
    <h4>Upgrades</h4>
    <p>Spend XP from a victory to raise hand cards that were not downgraded. Then your three role cards are discarded and you draw back to four.</p>
    <h4>The Final Battle</h4>
    <p>Draw seven cards and build two action sets; their total Move must reach the dragon's first tier. You may regroup once. Then draw every remaining card and build two sets again: total Attack must reach the first HP tier, total Initiative decides Early Damage, and you must soak the damage to win. Your score is the sum of your surviving card levels.</p>
    <h4>Hardships</h4>${["ambush", "hazards", "night", "storm"].map(g).join("")}
    <h4>Enemy abilities</h4>${["freeze", "poison", "ranged", "slow", "adaptable", "aggressive", "defensive", "evasive", "fortified", "pierce", "summon"].map(g).join("")}
    <h4>Journey perils</h4>${["steep", "treacherous", "camp", "guarded", "labyrinth"].map(g).join("")}
  </div>`, "tall");
}

// ---------- events ----------
function onSlot(key) {
  const id = U.pos[key];
  if (U.mode === "divert" || U.mode === "regroup") { if (id != null) U.pick = id; return render(); }
  if (U.mode === "fuse-bottom") {
    if (id == null) return;
    if (!face(G, id).bg.length) return toast("A colorless card cannot be fused.");
    U.fuseTmp = { bottom: id };
    U.mode = "fuse-top";
    return render();
  }
  if (U.mode === "fuse-top") {
    if (id == null || !canFuseWith(id)) return toast("Choose a card that shares an element.");
    U.fuseTmp.top = id;
    return modal(`<h3>Fused element</h3><p class="hint">${esc(cardDef(id).name)} counts as this element. Both cards are discarded after the encounter.</p>
      <div class="colors">${"WFLS".split("").map((c) => `<button class="btn colorbtn" data-fusecolor="${c}">${el(c, "lg")}${ELEMENT_NAME[c]}</button>`).join("")}</div>`);
  }
  if (U.sel == null) { if (id != null) U.sel = key; return render(); }
  if (U.sel !== key) [U.pos[U.sel], U.pos[key]] = [U.pos[key], U.pos[U.sel]];
  U.sel = null;
  render();
}

document.addEventListener("click", (ev) => {
  // A tap anywhere on a slot (its card included) selects it; only the enlarge button is separate.
  const inSlot = ev.target.closest("[data-slot]");
  if (inSlot && !ev.target.closest("[data-zoom]")) return onSlot(inSlot.dataset.slot);
  const t = ev.target.closest("[data-zoom],[data-zoomlv],[data-act],[data-slot],[data-card],[data-opt],[data-set],[data-mage],[data-gloss],[data-berserk],[data-fusecolor]");
  if (!t) return;
  const d = t.dataset;
  if (d.zoom != null) return zoomModal(+d.zoom);
  if (d.zoomlv) { const [id, lv] = d.zoomlv.split(":").map(Number); return zoomModal(id, lv); }
  if (d.gloss) return toast(`${GLOSSARY[d.gloss][0]}: ${GLOSSARY[d.gloss][1]}`);
  if (d.opt) { U.opts[d.opt] = JSON.parse(d.v); return render(); }
  if (d.set) { prefs[d.set] = d.v; return savePrefs(); }
  if (d.mage) { prefs.mages = prefs.mages.includes(d.mage) ? prefs.mages.filter((m) => m !== d.mage) : [...prefs.mages, d.mage]; return savePrefs(); }
  if (d.berserk != null) return dispatch({ type: "berserk", n: +d.berserk });
  if (d.fusecolor) {
    U.fuse = { ...U.fuseTmp, color: d.fusecolor };
    for (const k of Object.keys(U.pos)) if (U.pos[k] === U.fuse.bottom) U.pos[k] = null;
    compact();
    U.mode = null;
    closeModal();
    return render();
  }
  if (d.slot) return onSlot(d.slot);
  if (d.card != null && !t.closest("[data-slot]")) {
    const id = +d.card;
    if (G.phase === "setup") {
      U.picks = U.picks.includes(id) ? U.picks.filter((x) => x !== id) : U.picks.length < G.setup.pick ? [...U.picks, id] : U.picks;
    } else if (G.phase === "soak") {
      if (G.soak.berserk) return toast("Decide what Berserker converts first.");
      if (soakable(G).includes(id)) U.pick = U.pick === id ? null : id;
      else return toast("That card cannot soak this damage.");
    } else if (G.phase === "upgrade") {
      const c = upgradeCost(G, id);
      if (c != null && c <= G.enc.xp) U.pick = U.pick === id ? null : id;
      else return toast(c == null ? "That card cannot be upgraded now." : `That upgrade costs ${c} XP.`);
    }
    return render();
  }
  switch (d.act) {
    case "close": return closeModal();
    case "continue-game": U.screen = "game"; return render();
    case "new": closeModal(); U.screen = "setup"; return render();
    case "title": closeModal(); U.screen = "title"; return render();
    case "begin":
      G = newGame({ ...prefs, mages: [...prefs.mages] });
      U.picks = []; U.sig = ""; U.screen = "game";
      save();
      return render();
    case "confirm-difficulty": { const cards = U.picks; U.picks = []; return dispatch({ type: "pickDifficulty", cards }); }
    case "menu": return menuModal();
    case "cards": return cardsModal();
    case "log": return logModal();
    case "rules": return rulesModal();
    case "region": return regionModal();
    case "dragon": return dragonModal();
    case "abandon":
      if (!confirm("Abandon this expedition?")) return;
      G = null; save(); closeModal(); U.screen = "title";
      return render();
    case "why": U.why = !U.why; return render();
    case "divert": U.mode = "divert"; U.pick = null; U.sel = null; return render();
    case "regroup": U.mode = "regroup"; U.pick = null; U.sel = null; return render();
    case "cancel": U.mode = null; U.pick = null; U.fuseTmp = null; return render();
    case "confirm-divert": U.sig = ""; return dispatch({ type: "divert", card: U.pick });
    case "confirm-regroup": U.sig = ""; return dispatch({ type: "regroup", card: U.pick });
    case "fuse":
      if (U.fuse) {
        const empty = slotKeys().find((k) => U.pos[k] == null);
        if (empty) U.pos[empty] = U.fuse.bottom;
        U.fuse = null;
      } else { U.mode = "fuse-bottom"; U.sel = null; }
      return render();
    case "resolve": return dispatch({ type: "resolve", plan: plan() });
    case "next": return dispatch({ type: "continue" });
    case "confirm-soak": return dispatch({ type: "soak", card: U.pick });
    case "confirm-upgrade": return dispatch({ type: "upgrade", card: U.pick });
    case "end-upgrade": return dispatch({ type: "endUpgrade" });
  }
});
document.addEventListener("change", (ev) => {
  const k = ev.target.dataset?.toggle;
  if (k) { prefs[k] = ev.target.checked; savePrefs(); }
});
function savePrefs() {
  localStorage.setItem(PREFS, JSON.stringify(prefs));
  const sc = $(".scroll")?.scrollTop;
  render();
  if (sc != null && $(".scroll")) $(".scroll").scrollTop = sc;
}

// ---------- start ----------
const q = new URLSearchParams(location.search);
if (q.has("new")) {
  // development: ?new={"campaign":"north"}&seed=3&auto=40&bot=greedy
  G = newGame(JSON.parse(q.get("new") || "{}"), +(q.get("seed") || 1));
  U.screen = "game";
  const n = +(q.get("auto") || 0);
  if (n) {
    const h = await import("../tests/helpers.mjs");
    const r = h.rng(+(q.get("seed") || 1));
    const until = q.get("until");
    for (let i = 0; i < n && G.phase !== "won" && G.phase !== "lost"; i++) {
      if (until && G.phase === until) break;
      G = (q.get("bot") === "random" ? h.step : h.greedyStep)(G, r);
    }
  }
} else if (q.has("screen")) U.screen = q.get("screen");
render();
if (q.has("modal")) ({ rules: rulesModal, cards: cardsModal, region: regionModal, dragon: dragonModal, menu: menuModal, zoom: () => zoomModal(G.hand[0]) })[q.get("modal")]?.();
if (q.has("why")) { U.why = true; render(); }
if (q.has("click")) for (const sel of q.get("click").split(";")) { const n = document.querySelector(sel); if (n) n.click(); else console.warn("no " + sel); }

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
