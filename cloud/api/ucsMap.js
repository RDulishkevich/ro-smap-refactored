/**
 * Полёвка kind / eco from UCS 8.2.1 CatID.
 * kind and eco are never taken from the model — only this table.
 */

const KIND_SET = new Set(['nature', 'water', 'urban', 'forest', 'birds']);
const ECO_SET = new Set(['geophony', 'biophony', 'anthrophony']);

const CATEGORY_DEFAULTS = {
  AIR: { kind: 'nature', eco: 'geophony' },
  AIRCRAFT: { kind: 'urban', eco: 'anthrophony' },
  ALARMS: { kind: 'urban', eco: 'anthrophony' },
  AMBIENCE: { kind: 'nature', eco: 'geophony' },
  ANIMALS: { kind: 'nature', eco: 'biophony' },
  ARCHIVED: { kind: 'nature', eco: 'geophony' },
  BEEPS: { kind: 'urban', eco: 'anthrophony' },
  BELLS: { kind: 'urban', eco: 'anthrophony' },
  BIRDS: { kind: 'birds', eco: 'biophony' },
  BOATS: { kind: 'water', eco: 'anthrophony' },
  BULLETS: { kind: 'urban', eco: 'anthrophony' },
  CARTOON: { kind: 'nature', eco: 'geophony' },
  CERAMICS: { kind: 'urban', eco: 'anthrophony' },
  CHAINS: { kind: 'urban', eco: 'anthrophony' },
  CHEMICALS: { kind: 'urban', eco: 'anthrophony' },
  CLOCKS: { kind: 'urban', eco: 'anthrophony' },
  CLOTH: { kind: 'urban', eco: 'anthrophony' },
  COMMUNICATIONS: { kind: 'urban', eco: 'anthrophony' },
  COMPUTERS: { kind: 'urban', eco: 'anthrophony' },
  CREATURES: { kind: 'nature', eco: 'biophony' },
  CROWDS: { kind: 'urban', eco: 'anthrophony' },
  DESIGNED: { kind: 'nature', eco: 'geophony' },
  DESTRUCTION: { kind: 'urban', eco: 'anthrophony' },
  'DIRT & SAND': { kind: 'nature', eco: 'geophony' },
  DOORS: { kind: 'urban', eco: 'anthrophony' },
  DRAWERS: { kind: 'urban', eco: 'anthrophony' },
  ELECTRICITY: { kind: 'urban', eco: 'anthrophony' },
  EQUIPMENT: { kind: 'urban', eco: 'anthrophony' },
  EXPLOSIONS: { kind: 'urban', eco: 'anthrophony' },
  FARTS: { kind: 'urban', eco: 'anthrophony' },
  FIGHT: { kind: 'urban', eco: 'anthrophony' },
  FIRE: { kind: 'nature', eco: 'geophony' },
  FIREWORKS: { kind: 'urban', eco: 'anthrophony' },
  FOLEY: { kind: 'urban', eco: 'anthrophony' },
  'FOOD & DRINK': { kind: 'urban', eco: 'anthrophony' },
  FOOTSTEPS: { kind: 'urban', eco: 'anthrophony' },
  GAMES: { kind: 'urban', eco: 'anthrophony' },
  GEOTHERMAL: { kind: 'nature', eco: 'geophony' },
  GLASS: { kind: 'urban', eco: 'anthrophony' },
  GORE: { kind: 'urban', eco: 'anthrophony' },
  GUNS: { kind: 'urban', eco: 'anthrophony' },
  HORNS: { kind: 'urban', eco: 'anthrophony' },
  HUMAN: { kind: 'urban', eco: 'anthrophony' },
  ICE: { kind: 'nature', eco: 'geophony' },
  LASERS: { kind: 'urban', eco: 'anthrophony' },
  LEATHER: { kind: 'urban', eco: 'anthrophony' },
  'LIQUID & MUD': { kind: 'water', eco: 'geophony' },
  MACHINES: { kind: 'urban', eco: 'anthrophony' },
  MAGIC: { kind: 'nature', eco: 'geophony' },
  MECHANICAL: { kind: 'urban', eco: 'anthrophony' },
  METAL: { kind: 'urban', eco: 'anthrophony' },
  MOTORS: { kind: 'urban', eco: 'anthrophony' },
  MOVEMENT: { kind: 'nature', eco: 'geophony' },
  MUSICAL: { kind: 'urban', eco: 'anthrophony' },
  'NATURAL DISASTER': { kind: 'nature', eco: 'geophony' },
  OBJECTS: { kind: 'urban', eco: 'anthrophony' },
  PAPER: { kind: 'urban', eco: 'anthrophony' },
  PLASTIC: { kind: 'urban', eco: 'anthrophony' },
  RAIN: { kind: 'water', eco: 'geophony' },
  ROBOTS: { kind: 'urban', eco: 'anthrophony' },
  ROCKS: { kind: 'nature', eco: 'geophony' },
  ROPE: { kind: 'urban', eco: 'anthrophony' },
  RUBBER: { kind: 'urban', eco: 'anthrophony' },
  SCIFI: { kind: 'urban', eco: 'anthrophony' },
  SNOW: { kind: 'nature', eco: 'geophony' },
  SPORTS: { kind: 'urban', eco: 'anthrophony' },
  SWOOSHES: { kind: 'nature', eco: 'geophony' },
  TOOLS: { kind: 'urban', eco: 'anthrophony' },
  TOYS: { kind: 'urban', eco: 'anthrophony' },
  TRAINS: { kind: 'urban', eco: 'anthrophony' },
  'USER INTERFACE': { kind: 'urban', eco: 'anthrophony' },
  VEGETATION: { kind: 'nature', eco: 'biophony' },
  VEHICLES: { kind: 'urban', eco: 'anthrophony' },
  VOICES: { kind: 'urban', eco: 'anthrophony' },
  WATER: { kind: 'water', eco: 'geophony' },
  WEAPONS: { kind: 'urban', eco: 'anthrophony' },
  WEATHER: { kind: 'nature', eco: 'geophony' },
  WHISTLES: { kind: 'urban', eco: 'anthrophony' },
  WIND: { kind: 'nature', eco: 'geophony' },
  WINDOWS: { kind: 'urban', eco: 'anthrophony' },
  WINGS: { kind: 'birds', eco: 'biophony' },
  WOOD: { kind: 'nature', eco: 'geophony' },
};

const CATID_OVERRIDES = {
  AMBForst: { kind: 'forest', eco: 'biophony' },
  AMBBird: { kind: 'birds', eco: 'biophony' },
  AMBInsc: { kind: 'nature', eco: 'biophony' },
  AMBPark: { kind: 'nature', eco: 'biophony' },
  AMBTrop: { kind: 'nature', eco: 'biophony' },
  AMBSwmp: { kind: 'nature', eco: 'biophony' },
  AMBUrbn: { kind: 'urban', eco: 'anthrophony' },
  AMBTown: { kind: 'urban', eco: 'anthrophony' },
  AMBTraf: { kind: 'urban', eco: 'anthrophony' },
  AMBTran: { kind: 'urban', eco: 'anthrophony' },
  AMBSubn: { kind: 'urban', eco: 'anthrophony' },
  AMBCnst: { kind: 'urban', eco: 'anthrophony' },
  AMBInd: { kind: 'urban', eco: 'anthrophony' },
  AMBHome: { kind: 'urban', eco: 'anthrophony' },
  AMBOffc: { kind: 'urban', eco: 'anthrophony' },
  AMBRest: { kind: 'urban', eco: 'anthrophony' },
  AMBSchl: { kind: 'urban', eco: 'anthrophony' },
  AMBHosp: { kind: 'urban', eco: 'anthrophony' },
  AMBPrisn: { kind: 'urban', eco: 'anthrophony' },
  AMBPubl: { kind: 'urban', eco: 'anthrophony' },
  AMBMrkt: { kind: 'urban', eco: 'anthrophony' },
  AMBRoom: { kind: 'urban', eco: 'anthrophony' },
  AMBCele: { kind: 'urban', eco: 'anthrophony' },
  AMBPrtst: { kind: 'urban', eco: 'anthrophony' },
  AMBSprt: { kind: 'urban', eco: 'anthrophony' },
  AMBAmus: { kind: 'urban', eco: 'anthrophony' },
  AMBEmrg: { kind: 'urban', eco: 'anthrophony' },
  AMBRlgn: { kind: 'urban', eco: 'anthrophony' },
  AMBHist: { kind: 'urban', eco: 'anthrophony' },
  AMBTech: { kind: 'urban', eco: 'anthrophony' },
  AMBWar: { kind: 'urban', eco: 'anthrophony' },
  AMBSea: { kind: 'water', eco: 'geophony' },
  AMBLake: { kind: 'water', eco: 'geophony' },
  AMBUndwtr: { kind: 'water', eco: 'geophony' },
  AMBNaut: { kind: 'water', eco: 'anthrophony' },
  AMBRurl: { kind: 'nature', eco: 'anthrophony' },
  AMBFarm: { kind: 'nature', eco: 'anthrophony' },
  WINGBird: { kind: 'birds', eco: 'biophony' },
  WINGInsc: { kind: 'nature', eco: 'biophony' },
  FEETAnml: { kind: 'nature', eco: 'biophony' },
  FEETHors: { kind: 'nature', eco: 'biophony' },
  MOVEAnml: { kind: 'nature', eco: 'biophony' },
  MOVEInsc: { kind: 'nature', eco: 'biophony' },
  ANMLInsc: { kind: 'nature', eco: 'biophony' },
};

const FALLBACK = { kind: 'nature', eco: 'geophony' };

function mapCatId(catId, category) {
  const id = String(catId || '').trim();
  if (CATID_OVERRIDES[id]) return CATID_OVERRIDES[id];
  const cat = String(category || '').trim();
  return CATEGORY_DEFAULTS[cat] || FALLBACK;
}

function isKind(v) {
  return KIND_SET.has(String(v || ''));
}

function isEco(v) {
  return ECO_SET.has(String(v || ''));
}

module.exports = {
  CATEGORY_DEFAULTS,
  CATID_OVERRIDES,
  mapCatId,
  isKind,
  isEco,
  FALLBACK,
};
