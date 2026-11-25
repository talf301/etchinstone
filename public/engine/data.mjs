// Card data, transcribed from the print-and-play card faces.
// Elements: W water (blue), F fire (red), L lightning (yellow), S shadow (gray).

export const ELEMENTS = ["W", "F", "L", "S"];
export const ELEMENT_NAME = { W: "Water", F: "Fire", L: "Lightning", S: "Shadow" };
export const OPPOSITE = { W: "F", F: "W", L: "S", S: "L" };

// Level row: [upgradeCost, initiative, boost, basic, enhanced, armor, armorElement,
//             encounter ("E3" enemy 3, "J2" journey 2), hardship]
// basic/enhanced types: a attack, m move, x attack or move.
function card(id, name, el, basicType, enhType, enhEl, rows, extra = {}) {
  const levels = rows.map((r, i) => {
    const [xp, init, boost, bv, ev, armor, armorEl, enc, hardship] = r;
    return {
      level: i + 1,
      xp,
      init,
      boost,
      basic: { t: basicType, v: bv },
      enh: Array.isArray(ev)
        ? ev
        : [{ t: enhType, v: ev, els: [...enhEl] }],
      armor,
      armorEl: armorEl || null,
      enc: { t: enc[0], n: +enc[1] },
      hardship: hardship || null,
      bg: [el].filter(Boolean),
      ability: null,
    };
  });
  const c = { id, name, el, levels, img: extra.img || `b${id}`, ...extra };
  if (extra.bg) extra.bg.forEach((b, i) => (levels[i].bg = [...b]));
  if (extra.abilities) extra.abilities.forEach((a, i) => (levels[i].ability = a));
  return c;
}

export const BASE_CARDS = [
  card(0, "Destruction", "W", "a", "a", "F", [
    [2, 1, 1, 2, 6, 1, 0, "E1", "hazards"],
    [4, 1, 2, 3, 8, 1, 0, "E1"],
    [5, 2, 2, 5, 10, 2, "F", "E3"],
    [0, 3, 3, 6, 13, 3, "F", "E4"],
  ]),
  card(1, "Sword of Light", "W", "a", "a", "L", [
    [2, 4, 2, 2, 4, 1, 0, "J2"],
    [3, 6, 2, 3, 6, 2, 0, "J1", "night"],
    [4, 8, 3, 4, 7, 3, 0, "J3"],
    [0, 10, 4, 6, 10, 4, 0, "J1"],
  ]),
  card(2, "Brute Force", "W", "m", "a", "S", [
    [1, 1, 2, 2, 4, 1, 0, "E1", "ambush"],
    [3, 1, 3, 3, 5, 2, 0, "E3"],
    [4, 2, 4, 5, 9, 2, "S", "E1"],
    [0, 3, 5, 6, 11, 3, "S", "E2"],
  ]),
  card(3, "Frostfire Wall", "W", "a", "a", "W", [
    [1, 4, 1, 2, 3, 2, 0, "J2"],
    [3, 5, 2, 3, 5, 2, "W", "J2", "storm"],
    [4, 6, 4, 4, 7, 4, "W", "J1"],
    [0, 7, 5, 6, 10, 6, "W", "J3"],
  ]),
  card(4, "Rain of Blood", "L", "a", "a", "F", [
    [1, 2, 1, 3, 6, 2, 0, "E3", "hazards"],
    [3, 3, 1, 5, 8, 2, 0, "E2"],
    [4, 3, 2, 6, 11, 3, 0, "E4"],
    [0, 4, 3, 7, 14, 5, 0, "E4"],
  ]),
  card(5, "Fleet Footed", "L", "m", "m", "L", [
    [2, 5, 1, 3, 5, 2, 0, "J4"],
    [4, 5, 2, 5, 9, 3, 0, "J3", "night"],
    [6, 6, 4, 6, 11, 3, "L", "J4"],
    [0, 7, 5, 8, 14, 4, "L", "J2"],
  ]),
  card(6, "Adapt", "L", "x", "x", "S", [
    [2, 2, 2, 2, 3, 1, 0, "E3"],
    [3, 3, 3, 3, 5, 2, 0, "E4"],
    [4, 4, 4, 4, 7, 3, 0, "E2"],
    [0, 4, 5, 6, 9, 3, "S", "E2", "hazards"],
  ]),
  card(7, "River Swiftness", "L", "m", "m", "W", [
    [2, 5, 1, 2, 4, 2, 0, "J4"],
    [4, 6, 2, 3, 6, 2, 0, "J1"],
    [5, 8, 3, 5, 9, 5, 0, "J2"],
    [0, 9, 5, 8, 12, 5, "W", "J4", "storm"],
  ]),
  card(8, "Burning Bridges", "F", "m", "m", "F", [
    [2, 1, 1, 2, 4, 1, 0, "E2", "hazards"],
    [4, 1, 2, 3, 5, 1, 0, "E1"],
    [5, 2, 2, 4, 7, 2, "F", "E3"],
    [0, 3, 3, 5, 9, 3, "F", "E4"],
  ]),
  card(9, "Motivated Flight", "F", "m", "m", "L", [
    [1, 4, 1, 2, 4, 2, 0, "J3"],
    [3, 5, 2, 4, 8, 2, "L", "J3"],
    [4, 7, 3, 5, 10, 3, "L", "J4", "night"],
    [0, 9, 5, 6, 12, 5, "L", "J1"],
  ]),
  card(10, "Adapt", "F", "x", "x", "S", [
    [2, 2, 2, 2, 3, 1, 0, "E2", "ambush"],
    [3, 3, 3, 3, 5, 2, 0, "E3"],
    [4, 4, 4, 4, 7, 3, 0, "E1"],
    [0, 4, 5, 6, 9, 3, "S", "E2"],
  ]),
  card(11, "Frostfire Wall", "F", "a", "a", "W", [
    [1, 4, 1, 2, 3, 2, 0, "J3", "storm"],
    [3, 5, 2, 3, 5, 2, "W", "J4"],
    [4, 6, 4, 4, 7, 4, "W", "J2"],
    [0, 7, 5, 6, 10, 6, "W", "J3"],
  ]),
  card(12, "Rain of Blood", "S", "a", "a", "F", [
    [1, 2, 1, 3, 6, 2, 0, "E4"],
    [3, 3, 1, 5, 8, 2, 0, "E2"],
    [4, 3, 2, 6, 11, 3, 0, "E4", "ambush"],
    [0, 4, 3, 7, 14, 5, 0, "E1"],
  ]),
  card(13, "Fleet Footed", "S", "m", "m", "L", [
    [2, 5, 1, 3, 5, 2, 0, "J1"],
    [4, 5, 2, 5, 9, 3, 0, "J4"],
    [6, 6, 4, 6, 11, 3, "L", "J1"],
    [0, 7, 5, 8, 14, 4, "L", "J2", "night"],
  ]),
  card(14, "Determined March", "S", "a", "m", "S", [
    [2, 2, 2, 3, 5, 2, 0, "E4"],
    [3, 3, 3, 4, 7, 3, 0, "E4"],
    [5, 4, 5, 5, 9, 3, 0, "E2", "ambush"],
    [0, 5, 6, 5, 12, 4, "S", "E2"],
  ]),
  card(15, "River Swiftness", "S", "m", "m", "W", [
    [2, 5, 1, 2, 4, 2, 0, "J1"],
    [4, 6, 2, 3, 6, 2, 0, "J2"],
    [5, 8, 3, 5, 9, 5, 0, "J3", "storm"],
    [0, 9, 5, 8, 12, 5, "W", "J4"],
  ]),
];

// Northvale mage cards. `replaces` is the base card id. Abilities per level.
const perLevel = (f) => [1, 2, 3, 4].map((l) => f(l - 1));
const chain = (vals) => vals.map((v) => [{ chain: v, els: ["L"] }]);

export const MAGES = [
  { id: "voltak", name: "Voltak", blurb: "Colorless grit. Positions his cards to add power to the spell." },
  { id: "mythix", name: "Mythix", blurb: "Many elements and tricks, weak boosts, and a pursuer on his trail." },
  { id: "noramir", name: "Noramir", blurb: "Hires units for XP. His strongest spells weaken with the wrong ether." },
  { id: "promethia", name: "Promethia", blurb: "Turns damage into XP. Gains and loses power by ether color." },
];

export const NORTH_CARDS = [
  // Voltak
  card(16, "Swirling Blades", "W", "a", "a", "L", [
    [2, 2, 2, 2, 4, 1, 0, "J2"],
    [3, 3, 2, 3, 6, 2, 0, "J1"],
    [4, 5, 3, 4, 7, 3, 0, "J3"],
    [0, 6, 4, 6, 10, 4, 0, "J1"],
  ], { mage: "voltak", replaces: 1, img: "n-swirling-blades",
    abilities: perLevel((i) => ({ kind: "power", element: [1, 2, 3, 3][i], reserve: [1, 1, 1, 2][i] })) }),
  card(17, "Ice Breaker", "W", "a", "a", "W", [
    [1, 2, 1, 2, 3, 2, 0, "J2"],
    [3, 3, 2, 3, 5, 2, "W", "J2"],
    [4, 4, 4, 4, 7, 4, "W", "J1"],
    [0, 5, 5, 6, 10, 6, "W", "J3"],
  ], { mage: "voltak", replaces: 3, img: "n-ice-breaker",
    abilities: perLevel((i) => ({ kind: "power", element: [2, 2, 3, 3][i], reserve: [0, 1, 1, 2][i] })) }),
  card(18, "Grit", null, "x", "x", "S", [
    [2, 2, 2, 3, 4, 1, 0, "E2"],
    [3, 3, 3, 4, 6, 2, 0, "E3"],
    [4, 4, 4, 6, 9, 3, 0, "E1"],
    [0, 4, 5, 7, 11, 4, 0, "E2"],
  ], { mage: "voltak", replaces: 10, img: "n-grit",
    abilities: perLevel((i) => ({ kind: "slowWit", x: [4, 3, 2, 2][i] })) }),
  card(19, "Warrior's Wisdom", null, "a", "m", "W", [
    [2, 2, 2, 5, 6, 2, 0, "E4"],
    [3, 3, 3, 6, 7, 3, 0, "E4"],
    [5, 4, 5, 8, 10, 3, 0, "E2"],
    [0, 5, 6, 10, 12, 4, 0, "E2"],
  ], { mage: "voltak", replaces: 14, img: "n-warriors-wisdom",
    abilities: perLevel((i) => ({ kind: "slowWit", x: [4, 3, 2, 1][i] })) }),
  // Mythix
  card(20, "Windwalker", "L", "a", "a", "F", [
    [1, 2, -1, 2, 5, 2, 0, "E3"],
    [3, 3, 1, 4, 7, 2, 0, "E2"],
    [4, 3, 2, 5, 9, 3, 0, "E4"],
    [0, 4, 3, 6, 11, 5, 0, "E4"],
  ], { mage: "mythix", replaces: 4, img: "n-windwalker",
    abilities: [
      null,
      { kind: "windwalker", left: ["element"], right: ["boost"] },
      { kind: "windwalker", left: ["element"], right: ["spell", "boost"] },
      { kind: "windwalker", left: ["reserve", "element"], right: ["spell", "boost"] },
    ] }),
  card(21, "Ether Chain", "L", "x", "x", "L", [
    [2, 2, 2, 2, chain([1])[0], 1, 0, "E3"],
    [3, 3, 3, 3, chain([2])[0], 2, 0, "E4"],
    [4, 4, 4, 4, chain([2])[0], 3, 0, "E2"],
    [0, 4, 5, 6, chain([3])[0], 3, "L", "E2", "hazards"],
  ], { mage: "mythix", replaces: 6, img: "n-ether-chain",
    bg: [["L"], ["L"], ["L", "W"], ["W", "L", "F"]],
    abilities: perLevel(() => ({ kind: "chain" })) }),
  card(22, "Tricky Spell", "F", "m", "m", "L", [
    [1, 4, 1, 2, [{ t: "m", v: 4, els: ["L"] }, { t: "m", v: -2, els: ["S"] }], 2, 0, "J3"],
    [3, 5, 2, 4, [{ t: "m", v: 7, els: ["L"] }, { t: "m", v: 1, els: ["S"] }], 2, "L", "J3"],
    [4, 7, 3, 5, [{ t: "m", v: 10, els: ["L"] }, { t: "m", v: 3, els: ["S"] }], 3, "L", "J4"],
    [0, 9, 5, 6, [{ t: "m", v: 12, els: ["L"] }, { t: "m", v: 4, els: ["S"] }], 5, "L", "J1"],
  ], { mage: "mythix", replaces: 9, img: "n-tricky-spell",
    abilities: perLevel(() => ({ kind: "pursuer" })) }),
  card(23, "Elemental Shift", "S", "m", "m", "W", [
    [2, 5, -3, 2, 4, 2, 0, "J1"],
    [4, 6, -2, 3, 6, 2, 0, "J2"],
    [5, 8, -1, 5, 9, 5, 0, "J3"],
    [0, 9, 0, 8, 12, 5, "W", "J4"],
  ], { mage: "mythix", replaces: 15, img: "n-elemental-shift",
    bg: [["S"], ["S"], ["S", "L"], ["L", "S", "W"]],
    abilities: perLevel(() => ({ kind: "pursuer" })) }),
  // Noramir
  card(24, "Imbalance", "W", "a", "a", "FL", [
    [2, 1, 1, 5, 2, 1, 0, "E1"],
    [4, 1, 2, 6, 3, 1, 0, "E1"],
    [5, 2, 2, 8, 4, 2, "F", "E3"],
    [0, 3, 3, 9, 5, 3, "F", "E4"],
  ], { mage: "noramir", replaces: 0, img: "n-imbalance",
    abilities: perLevel((i) => ({ kind: "drain", x: [4, 3, 2, 2][i] })) }),
  card(25, "Time Lapse", "L", "m", "m", "WF", [
    [2, 5, 1, 4, 2, 2, 0, "J4"],
    [4, 6, 2, 5, 3, 2, 0, "J1"],
    [5, 8, 3, 7, 4, 5, 0, "J2"],
    [0, 9, 5, 9, 6, 5, "W", "J4"],
  ], { mage: "noramir", replaces: 7, img: "n-time-lapse",
    abilities: perLevel((i) => ({ kind: "drain", x: [3, 2, 2, 1][i] })) }),
  card(26, "Decisive Leader", "F", "a", "a", "W", [
    [1, 4, 1, 2, 3, 2, 0, "J3", "storm"],
    [3, 5, 2, 3, 5, 2, "W", "J4"],
    [4, 6, 4, 4, 7, 4, "W", "J2"],
    [0, 7, 5, 6, 10, 6, "W", "J3"],
  ], { mage: "noramir", replaces: 11, img: "n-decisive-leader",
    abilities: [null, ...[2, 3, 4].map((rank) => ({ kind: "unit", rank, skills: ["move", "initiative"] }))] }),
  card(27, "Wise Commander", "S", "m", "m", "L", [
    [2, 5, 1, 3, 5, 2, 0, "J1"],
    [4, 5, 2, 5, 9, 3, 0, "J4"],
    [6, 6, 4, 6, 11, 3, "L", "J1"],
    [0, 7, 5, 8, 14, 4, "L", "J2"],
  ], { mage: "noramir", replaces: 13, img: "n-wise-commander",
    abilities: [null, ...[2, 3, 4].map((rank) => ({ kind: "unit", rank, skills: ["attack", "armor"] }))] }),
  // Promethia
  card(28, "Berserker", "W", "m", "a", "S", [
    [1, 1, 2, 2, 5, 1, 0, "E1"],
    [3, 1, 3, 3, 5, 2, 0, "E3"],
    [4, 2, 4, 5, 10, 1, "S", "E1"],
    [0, 3, 5, 6, 12, 2, "S", "E2"],
  ], { mage: "promethia", replaces: 2, img: "n-berserker",
    abilities: perLevel((i) => ({ kind: "berserk", x: [1, 2, 2, 3][i] })) }),
  card(29, "Contingency Plan", "F", "m", "m", "F", [
    [2, 1, 1, 2, 4, 1, 0, "E2", "hazards"],
    [4, 1, 2, 3, 5, 1, 0, "E1"],
    [5, 2, 2, 4, 7, 2, "F", "E3"],
    [0, 3, 3, 5, 9, 3, "F", "E4"],
  ], { mage: "promethia", replaces: 8, img: "n-contingency-plan",
    abilities: [null, ...[2, 3, 4].map((x) => ({ kind: "contingency", x }))] }),
  card(30, "Illumined Path", "L", "m", "m", "L", [
    [2, 5, 1, 2, 4, 2, 0, "J4"],
    [4, 5, 2, 4, 8, 2, 0, "J3"],
    [6, 6, 4, 5, 10, 2, "L", "J4"],
    [0, 7, 5, 7, 12, 3, "L", "J2"],
  ], { mage: "promethia", replaces: 5, img: "n-illumined-path",
    abilities: perLevel((i) => ({ kind: "illumined", x: [4, 3, 2, 1][i] })) }),
  card(31, "Seeing Red", "S", "a", "a", "F", [
    [1, 2, 1, 3, 6, 2, 0, "E4"],
    [3, 3, 1, 5, 8, 2, 0, "E2"],
    [4, 3, 2, 6, 11, 3, 0, "E4"],
    [0, 4, 3, 7, 14, 5, 0, "E1"],
  ], { mage: "promethia", replaces: 12, img: "n-seeing-red",
    abilities: perLevel((i) => ({ kind: "seeingRed", plus: [1, 1, 2, 3][i], minus: [4, 2, 2, 1][i] })) }),
];

export const ALL_CARDS = [...BASE_CARDS, ...NORTH_CARDS];
export const cardDef = (id) => ALL_CARDS[id];

const armor = (s) => (s ? s.split(" ").map((t) => ({ v: +t.slice(0, -1), el: t.at(-1) === "k" ? null : t.at(-1) })) : []);
const enemy = ([hp, xp, init, atk, arm, abilities = ""]) => ({
  hp, xp, init, atk: +atk.slice(0, -1), atkEl: atk.at(-1), armor: armor(arm),
  abilities: abilities ? abilities.split(" ") : [],
});
const journey = ([mp, el, tp, xp, peril]) => ({ mp, el, tp, xp, peril: peril || null });
const region = (name, img, enemies, journeys) => ({ name, img, enemies: enemies.map(enemy), journeys: journeys.map(journey) });

export const CAMPAIGNS = {
  base: {
    id: "base",
    name: "Etchinstone",
    regions: [
      region("Jade Mountains", "b1",
        [[7, 4, 8, "1L", "1L"], [11, 7, 4, "2F", "1F"], [9, 5, 6, "2W", "2W"], [13, 8, 2, "3S", "3S"]],
        [[12, "L", 2, 5], [8, "W", 1, 3], [11, "F", 2, 4], [10, "S", 1, 3]]),
      region("Living Marshes", "b2",
        [[9, 5, 6, "2S", "1S", "ranged"], [10, 4, 8, "2L", "1L"], [15, 8, 2, "4F", "3F", "slow"], [13, 7, 5, "3W", "2W", "freeze"]],
        [[10, "F", 2, 4, "treacherous"], [13, "W", 2, 7], [11, "L", 3, 5], [9, "S", 2, 4, "steep"]]),
      region("Burning Basin", "b3",
        [[17, 9, 5, "3S", "3S"], [14, 8, 4, "3W", "3W", "slow"], [11, 7, 9, "2F", "2F", "poison"], [9, 5, 7, "2L", "2L", "ranged"]],
        [[14, "W", 2, 7, "steep"], [12, "L", 3, 6], [10, "F", 3, 5, "treacherous"], [11, "S", 2, 5]]),
      region("Forest of Gath", "b4",
        [[13, 7, 6, "2S", "3S 2W", "poison"], [9, 5, 10, "3F", "1F", "ranged"], [14, 8, 8, "4L", "2L 2F", "freeze"], [17, 9, 7, "5W", "3W 2S"]],
        [[14, "W", 2, 7, "treacherous"], [13, "S", 3, 6], [12, "F", 2, 5], [11, "L", 3, 5, "steep"]]),
    ],
  },
  north: {
    id: "north",
    name: "Northvale",
    regions: [
      region("Severed Seaboard", "n1",
        [[7, 5, 8, "1S", "1S", "pierce"], [11, 8, 6, "2L", "3L", "defensive"], [12, 7, 3, "3F", "2F"], [8, 4, 4, "2W", "1W", "ranged"]],
        [[9, "W", 1, 3], [11, "S", 2, 4], [10, "L", 2, 5, "labyrinth"], [10, "F", 1, 3]]),
      region("Whispering Fields", "n2",
        [[14, 7, 5, "4F", "3F", "slow defensive"], [11, 7, 6, "2L", "2L", "ranged aggressive"], [8, 4, 8, "2W", "1W 1F 1L", "evasive"], [12, 6, 3, "3S", "2S", "poison"]],
        [[12, "S", 2, 7, "guarded"], [13, "L", 3, 4], [10, "F", 2, 4, "camp"], [11, "W", 2, 5, "guarded"]]),
      region("Forgotten Foothills", "n3",
        [[9, 5, 6, "3L", "3L", "fortified defensive"], [12, 6, 4, "2F", "4F", "summon"], [14, 8, 6, "3W", "2W", "aggressive"], [16, 9, 5, "3S", "3S", "slow ranged"]],
        [[11, "F", 2, 5, "treacherous"], [12, "W", 3, 7, "steep"], [11, "S", 2, 4], [14, "L", 3, 6, "labyrinth"]]),
      region("Northvale", "n4",
        [[7, 6, 11, "3L", "1k", "evasive adaptable"], [17, 8, 2, "4S", "4S 3W", "slow fortified"], [14, 7, 6, "3W", "3W 3F", "freeze defensive"], [13, 9, 7, "4F", "3F 2L", "aggressive ranged pierce"]],
        [[11, "L", 2, 5, "camp"], [13, "F", 3, 6, "treacherous"], [15, "W", 2, 6, "labyrinth"], [12, "S", 3, 4, "steep"]]),
    ],
  },
};

const dragon = (id, name, title, campaign, el, init, early, arm, mp, hp, abilities = [], extra = {}) => ({
  id, name, title, campaign, el, init, early, armor: armor(arm),
  mp: mp.map(([v, tp]) => ({ v, tp })), hp: hp.map(([v, atk]) => ({ v, atk })), abilities, ...extra,
});

export const DRAGONS = [
  dragon("rodving", "Rodving", "The Last Breath", "base", "F", 9, 9, "4F", [[20, 3], [23, 2], [28, 1]], [[22, 27], [27, 24], [32, 15]]),
  dragon("vuurhast", "Vuurhast", "", "base", "L", 13, 8, "4L 1F", [[17, 4], [21, 3], [25, 2]], [[16, 23], [21, 20], [29, 13]]),
  dragon("grimroch", "Grimroch", "", "base", "W", 10, 4, "5W 3L 2S", [[15, 4], [21, 3], [27, 1]], [[22, 26], [25, 20], [31, 11]]),
  dragon("helsang", "Helsang", "", "base", "S", 12, 6, "4S 3W", [[19, 3], [23, 2], [29, 1]], [[21, 26], [26, 20], [30, 12]]),
  dragon("merinus", "Merinus", "", "north", "W", 9, 6, "6W 4L 3S", [[16, 3], [23, 2], [27, 1]], [[21, 25], [27, 19], [32, 15]], ["pierce"]),
  dragon("blight-rider", "Blight Rider", "", "north", "F", 12, 7, "6F", [[15, 4], [21, 3], [26, 1]], [[19, 27], [24, 25], [29, 17]], ["poison"], { poison: 9 }),
  dragon("the-waykeeper", "The Waykeeper", "", "north", "S", 16, 4, "3S 2W 1F 1L", [[18, 3], [24, 2], [28, 1]], [[16, 25], [22, 20], [26, 13]], ["evasive"]),
  dragon("aqualis", "Aqualis", "", "north", "L", 12, 8, "5L 3F", [[16, 4], [22, 3], [26, 2]], [[17, 24], [22, 21], [28, 12]], ["fortified"]),
];
export const dragonDef = (id) => DRAGONS.find((d) => d.id === id);

export const DIFFICULTIES = [
  { id: "casual", name: "Casual", draw: 5, pick: 4, to: 3, text: "Upgrade four of five drawn cards to level 3." },
  { id: "easy", name: "Easy", draw: 5, pick: 2, to: 3, text: "Upgrade two of five drawn cards to level 3." },
  { id: "normal", name: "Normal", draw: 0, pick: 0, to: 2, text: "No changes." },
  { id: "hard", name: "Hard", draw: 5, pick: 2, to: 1, text: "Downgrade two of five drawn cards to level 1." },
  { id: "impossible", name: "Impossible", draw: 5, pick: 5, to: 1, text: "Downgrade five cards to level 1." },
  { id: "deti", name: "Don't Even Try It", draw: 7, pick: 7, to: 1, text: "Downgrade seven cards to level 1." },
];

export const GLOSSARY = {
  ambush: ["Ambush", "Double the Early Damage you suffer this encounter."],
  hazards: ["Hazards", "Suffer 1 Time Penalty if you suffer Early Damage and 1 if you suffer Combat Damage."],
  night: ["Night Travel", "Reduce your Boost by your Initiative, to a minimum of 0."],
  storm: ["Storm", "If you suffer Time Penalties this encounter, suffer an equal amount of damage."],
  freeze: ["Freeze", "If this enemy deals Early Damage, discard your Reserve card during Cleanup."],
  poison: ["Poison", "When you suffer damage, apply 1 more damage to the next hand you draw in this region (2 if you suffered both Early and Combat Damage)."],
  ranged: ["Ranged", "Deals Early Damage even if you beat its Initiative, unless you discard your Reserve card."],
  slow: ["Slow", "You may compare your Move instead of your Attack against this enemy's HP."],
  adaptable: ["Adaptable", "Its armor also covers the ether colors of your Spell and Boost cards."],
  evasive: ["Evasive", "Gains +1 to all its armor for every point of Initiative you are short."],
  pierce: ["Pierce", "Ignores the color of your armor (no doubling). If you suffer Combat Damage you cannot soak with your Spell card."],
  summon: ["Summon", "Uses the attack value of the enemy in this region whose attack color matches your Reserve card."],
  fortified: ["Fortified", "Reduces your Initiative by the region number (5 for a boss) unless your Boost's color matches its armor."],
  defensive: ["Defensive", "Its Early Damage is 1 lower than its attack."],
  aggressive: ["Aggressive", "Its Early Damage is 1 higher than its attack."],
  steep: ["Steep", "Increase the journey's MP by the Boost of your Reserve card."],
  treacherous: ["Treacherous", "If you fail to attain Complete Victory, suffer 1 damage after the Time Penalty."],
  labyrinth: ["Labyrinth", "+1 Time Penalty if your Boost's color matches either adjacent journey's color."],
  guarded: ["Guarded", "The journey has armor equal to the region number against Enhanced Moves of its opposite color."],
  camp: ["Enemy Camp", "Without Complete Victory, suffer the attack of the enemy here whose attack color matches your Spell card's color."],
};
