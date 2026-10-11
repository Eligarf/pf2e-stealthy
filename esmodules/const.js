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

export const CONDITION_IDS = {
  observed: "1wQY3JYyhMYeeV2G",
  hidden: "iU0fEDdBp3rXpTMC",
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
};

export const SLUGS = {
  avoidNotice: "avoid-notice",
  circumstanceBonus: "circumstance-bonus",
  incredibleScout: "incredible-scout",
  perception: "perception",
  scout: "scout",
  scoutDedication: "scout-dedication",
  stealth: "stealth",
  stealthEffect: `${MODULE_ID}-stealth`,
};

export const COMBAT_STATES = {
  inactive: "inactive",
  active: "active",
  started: "started",
};

export const CRITICAL_FAILURE = 0;
export const FAILURE = 1;
export const SUCCESS = 2;
export const CRITICAL_SUCCESS = 3;

export const DOS_KEYS = [
  "critical-failure",
  "failure",
  "success",
  "critical-success",
];

export const OBSERVED = 0;
export const HIDDEN = 1;
export const UNDETECTED = 2;

export const STEALTH_LABELS = ["observed", "hidden", "undetected"];
