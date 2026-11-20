export const MODULE_ID = "pf2e-stealthy";

export const CONSOLE_COLORS = [
  "background: #222; color: #80ffff",
  "color: #fff",
];

export const REFRESH_OPTIONS = {
  refreshLighting: true,
  refreshVision: true,
  refreshSounds: true,
  refreshOcclusion: true,
};

export const ITEM_IDS = {
  hidden: "iU0fEDdBp3rXpTMC",
  observed: "1wQY3JYyhMYeeV2G",
  offGuard: "AJh5ex99aV6VTggg",
  undetected: "VRSef5y1LmL2Hkjf",
};

export const CONDITION_PACKS = {
  pf2e: "pf2e.conditionitems",
  sf2e: "sf2e.conditions",
};

export const SKILL_ACTIONS = [
  "action:hide",
  "action:create-a-diversion",
  "action:sneak",
];

export const LOCALIZATION_KEYS = {
  observed: "PF2E.condition.observed.name",
  hidden: "PF2E.condition.hidden.name",
  undetected: "PF2E.condition.undetected.name",
  invisible: "PF2E.condition.invisible.name",
};

export const SLUGS = {
  avoidNotice: "avoid-notice",
  blinded: "blinded",
  circumstanceBonus: "circumstance-bonus",
  deafened: "deafened",
  foilSenses: "foil-senses",
  incredibleScout: "incredible-scout",
  perception: "perception",
  scout: "scout",
  scoutDedication: "scout-dedication",
  sneakAdept: "sneak-adept",
  stealth: "stealth",
  stealthy: `${MODULE_ID}-stealth`,
};

export const COMBAT_STATES = {
  inactive: "inactive",
  active: "active",
  started: "started",
};

export const DOS = {
  criticalFailure: 0,
  failure: 1,
  success: 2,
  criticalSuccess: 3,
};

export const DOS_KEYS = [
  `${MODULE_ID}-critical-failure`,
  `${MODULE_ID}-failure`,
  `${MODULE_ID}-success`,
  `${MODULE_ID}-critical-success`,
];

export const DOS_CARD_KEYS = [
  `${MODULE_ID}-card-critical-failure`,
  `${MODULE_ID}-card-failure`,
  `${MODULE_ID}-card-success`,
  `${MODULE_ID}-card-critical-success`,
];

export const STEALTH = {
  observed: 0,
  hidden: 1,
  undetected: 2,
};

export const STEALTH_LABELS = ["observed", "hidden", "undetected"];

export const ACUITY = {
  precise: 0,
  imprecise: 1,
  vague: 2,
  none: 3,
};
