import { clampDos, debuglog } from "./utils.js";
import { MODULE_ID } from "./const.js";
import { cachedSettings } from "./settings.js";

export function computeCover(origin, target, base = 0) {
  let bonus = base;
  let creatureBonus = 0;
  let tooltips = [];
  let creatureCover = null;
  if (cachedSettings.coverApi) {
    const cover = cachedSettings.coverApi(origin, target);
    bonus = cover.bonus;
    if (cachedSettings.creatureCoverApi) {
      creatureCover = cachedSettings.creatureCoverApi(origin, target);
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
        tooltips.push({
          format: `${MODULE_ID}.distractingShadows`,
        });
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
