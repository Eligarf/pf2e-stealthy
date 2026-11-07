import { clampDos, debuglog } from "./utils.js";
import { MODULE_ID } from "./const.js";
import { cachedSettings } from "./settings.js";

function computeCreatureCover(origin, target) {
  if (!cachedSettings.creatureCoverApi) return { bonus: 0, token: null };
  const mode = game.toolbelt?.getToolSetting("autoCover", "creatureMode");
  const sideScale = game.toolbelt?.getToolSetting("autoCover", "creatureSide");
  const skipDead = game.toolbelt?.getToolSetting("autoCover", "creatureDead");
  const skipProne = game.toolbelt?.getToolSetting("autoCover", "creatureProne");
  const test = cachedSettings.creatureCoverApi(origin, target, {
    context: {},
    debug: false,
    mode,
    sideScale,
    skipDead,
    skipProne,
  });
  if (!test) return { bonus: 0, token: null };
  const token = test.collisions?.token;
  switch (test.level) {
    case "lesser":
      return { bonus: 1, token };
    case "standard":
      return { bonus: 2, token };
    case "greater":
      return { bonus: 4, token };
    default:
      return { bonus: 0, token };
  }
}

const SIZE_RANK = {
  tiny: 0,
  sm: 1,
  med: 2,
  lg: 3,
  large: 3,
  huge: 4,
  grg: 5,
};

export function computeCover(origin, target, base = 0) {
  let bonus = base;
  let creatureBonus = 0;
  let tooltips = [];
  let creatureCover = null;
  if (cachedSettings.wallCoverApi) {
    const wallCover = cachedSettings.wallCoverApi(origin, target);
    bonus = wallCover.bonus;
    if (cachedSettings.creatureCoverApi) {
      creatureCover = computeCreatureCover(origin, target);
      creatureBonus = creatureCover.bonus;
    }
  }

  if (bonus === 4 || creatureBonus === 4) {
    bonus = 4;
    tooltips.push({ format: `${MODULE_ID}.greaterCover` });
  } else if (bonus === 2 || creatureBonus === 2) {
    bonus = 2;
    tooltips.push({
      format: `${MODULE_ID}.standardCover`,
    });
  } else {
    bonus = 0;
    if (creatureBonus === 1) {
      const found = origin.actor.items.some(
        (i) => i.system.slug === "distracting-shadows",
      );
      if (found) {
        const token = creatureCover.token;
        if (token) {
          const coverSize = token.actor?.system?.traits?.size?.value;
          const originSize = origin.actor?.system?.traits?.size?.value;
          if (SIZE_RANK[coverSize] > SIZE_RANK[originSize]) {
            tooltips.push({
              format: `${MODULE_ID}.distractingShadows.bigger`,
            });
          }
        } else {
          tooltips.push({
            format: `${MODULE_ID}.distractingShadows.maybe`,
          });
        }
      }
    }
  }

  return { bonus, tooltips };
}

export function resolveStealthCheck({ origin, target, resolver }) {
  const check = {
    dc: target.actor.system.perception.dc,
    name: target.name,
    tokenId: target.id,
    tokenDoc: target,
  };

  const cover = computeCover(
    origin.tokenDoc,
    target,
    origin.baseCoverBonus || 0,
  );

  if (cover.bonus > 0) check.coverBonus = cover.bonus;
  (check.tooltips ??= []).push(...cover.tooltips);

  const delta = origin.skillResult + cover.bonus - check.dc;
  check.delta = delta;
  check.deltaStr = delta < 0 ? `${delta}` : `+${delta}`;
  check.degreeOfSuccess = clampDos(delta, origin.rawRollDosDelta);
  resolver(origin, check);

  return check;
}

export function resolveStealthChecks({ origin, targets, resolver }) {
  const checks = targets
    .filter((target) => target.actor?.system?.perception?.dc)
    .map((target) =>
      resolveStealthCheck({
        origin,
        target,
        resolver,
      }),
    );
  return checks.sort((a, b) => a.delta - b.delta);
}

export function resolveSeekCheck({ origin, target, resolver }) {
  let check = {
    dc: target.actor.system.skills.stealth.dc,
    name: target.name,
    observerId: target.id,
    tokenDoc: target,
  };

  const delta = origin.skillResult - check.dc;
  check.delta = delta;
  check.deltaStr = delta < 0 ? `${delta}` : `+${delta}`;
  check.degreeOfSuccess = clampDos(delta, origin.rawRollDosDelta);
  resolver(origin, check);
  return check;
}

export function summarizeTargetList(checks) {
  return checks.reduce((acc, o) => {
    const check = o.check ?? o;
    const stealth = check.stealth;
    acc[stealth] = (acc[stealth] || 0) + 1;
    return acc;
  }, {});
}
