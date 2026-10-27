import {
  ITEM_IDS,
  CONDITION_PACKS,
  HIDDEN,
  MODULE_ID,
  OBSERVED,
  SLUGS,
  UNDETECTED,
  STEALTH_LABELS,
} from "./const.js";
import { debuglog } from "./utils.js";
import { cachedSettings } from "./settings.js";

export function isAvoider(tokenOrActor) {
  const actor = tokenOrActor?.actor ?? tokenOrActor;
  // If you have a stealth effect you are an avoider
  if (actor?.items?.some((item) => item.system.slug === SLUGS.stealthy))
    return true;

  // once combat starts, a combantant has to have the stealth effect
  const combat = game?.combat;
  const combatant = combat?.combatants?.contents?.some(
    (c) => c.token?.id === tokenOrActor.id || c.actor?.id === tokenOrActor.id,
  );
  if (combat?.round > 0 && !!combatant && combatant?.initiative !== null)
    return false;

  // If activities aren't required, you are an avoider if your initiative is stealth.
  const requireActivity = cachedSettings.requireActivity;
  if (!requireActivity)
    return actor?.system?.initiative?.statistic === SLUGS.stealth;

  // If you don't have an exploration activity, you are an avoider if your initiative is stealth.
  if (!(actor?.parties?.size > 0 && actor?.system?.exploration))
    return actor?.system?.initiative?.statistic === SLUGS.stealth;

  // You are an avoider if you have an exploration activity with the avoidNotice slug.
  return actor.system.exploration.some(
    (a) => actor.items.get(a)?.system?.slug === SLUGS.avoidNotice,
  );
}

export function getStealthyEffect(token) {
  const actor = token?.actor;
  return actor?.items?.find((item) => item.system.slug === SLUGS.stealthy);
}

export function getStealthBaseline(stealth) {
  return stealth?.system?.badge?.value || OBSERVED;
}

export async function reduceStealthBaseline(token, baseline) {
  const actor = token?.actor;
  const stealth = actor?.items?.find(
    (item) => item.system.slug === SLUGS.stealthy,
  );
  if (!stealth) return;
  const oldBaseline = stealth.system?.badge?.value || 0;
  if (oldBaseline > baseline)
    return stealth.update({
      system: {
        badge: {
          value: baseline,
        },
      },
    });
}

export function getStealthinessTo(origin, targetId) {
  const actor = origin.actor || origin.tokenDoc.actor;
  const stealthy = actor?.items?.find(
    (item) => item.system.slug === SLUGS.stealthy,
  );
  const stealthBaseline = getStealthBaseline(stealthy);
  const flags = stealthy?.flags?.[MODULE_ID];
  if (stealthBaseline === UNDETECTED) {
    const undetected = flags?.undetected || {};
    if (!undetected?.except?.includes(targetId)) return UNDETECTED;
  }
  if (stealthBaseline >= HIDDEN) {
    const hidden = flags?.hidden || {};
    if (!hidden?.except?.includes(targetId)) return HIDDEN;
  }
  return OBSERVED;
}

function buildRulesFromFlags(flags, stealthBaseline) {
  const rules = [];
  let offGuardPredicate = [];
  for (let stealth = HIDDEN; stealth <= stealthBaseline; ++stealth) {
    const stealthLabel = STEALTH_LABELS[stealth];
    rules.push({
      key: "GrantItem",
      uuid: `Compendium.${CONDITION_PACKS[game.system.id]}.Item.${ITEM_IDS[stealthLabel]}`,
      predicate: [{ gte: ["parent.badge.value", stealth] }],
      reevaluateOnUpdate: true,
      inMemoryOnly: true,
    });

    const exceptions = flags[stealthLabel]?.except || [];
    if (exceptions.length > 0) {
      const re = {
        key: "RollOption",
        domain: "all",
        option: `self:condition:${stealthLabel}`,
        value: false,
        predicate: [
          exceptions.length > 1
            ? {
                or: exceptions.map(
                  (id) => `target:signature:${flags.detectors[id].signature}`,
                ),
              }
            : `target:signature:${flags.detectors[exceptions[0]].signature}`,
        ],
      };
      rules.push(re);
      if (stealth === HIDDEN) offGuardPredicate = re.predicate;
    }
  }

  if (rules.length > 0)
    rules.push({
      key: "EphemeralEffect",
      ...(offGuardPredicate.length > 0
        ? { predicate: [{ not: offGuardPredicate[0] }] }
        : {}),
      selectors: [
        "strike-attack-roll",
        "spell-attack-roll",
        "strike-damage",
        "attack-spell-damage",
      ],
      uuid: `Compendium.${CONDITION_PACKS[game.system.id]}.Item.${ITEM_IDS.offGuard}`,
    });
  return rules;
}

export async function setStealthinessTo(origin, target, stealth) {
  const actor = origin.actor || origin.tokenDoc.actor;
  const stealthy = actor?.items?.find(
    (item) => item.system.slug === SLUGS.stealthy,
  );
  if (stealthy?.flags?.[MODULE_ID]?.detectors?.[target.id]?.stealth === stealth)
    return;

  const stealthBaseline = getStealthBaseline(stealthy);
  let flags = foundry.utils.duplicate(stealthy?.flags?.[MODULE_ID]);
  if (stealthBaseline <= stealth) {
    for (let condition = stealthBaseline; condition >= HIDDEN; --condition) {
      const stealthLabel = STEALTH_LABELS[condition];
      let except = flags[stealthLabel]?.except;
      if (!except.length) continue;
      except = except.filter((id) => id !== target.id);
      if (!except.length) delete flags[stealthLabel].except;
      else flags[stealthLabel] = except;
    }
    if (target.id in flags.detectors) delete flags.detectors[target.id];
  } else {
    for (let condition = stealthBaseline; condition > stealth; --condition) {
      const stealthLabel = STEALTH_LABELS[condition];
      const except = ((flags[stealthLabel] ??= {}).except ??= []);
      if (!except.includes(target.id)) except.push(target.id);
    }
    (flags.detectors ??= {})[target.id] = {
      stealth,
      signature: target.actor.signature,
    };
  }

  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
    system: {
      rules: buildRulesFromFlags(flags, stealthBaseline),
    },
  };
  return stealthy.update(update);
}

export async function undoRevealsOf({ avoiders, observers = [] }) {
  debuglog("undoRevealsOf", { avoiders, observers });
  for (const avoider of avoiders) {
    const actor = avoider?.actor;
    const stealthy = actor?.items?.find(
      (item) => item.system.slug === SLUGS.stealthy,
    );
    const flags = stealthy?.flags?.[MODULE_ID] || {};
    if (!flags) continue;
    const undoSet = new Set(flags.hidden?.except || []);
    (flags.undetected?.except || []).forEach((id) => undoSet.add(id));
    let undos = [...undoSet];
    if (observers.length > 0) {
      undos = undos.filter((id) => observers.some((o) => o.id === id));
    }

    const oldDetectors = foundry.utils.duplicate(flags.detectors);
    const baselineStealth = getStealthBaseline(stealthy);
    const detectors = Object.fromEntries(
      Object.entries(oldDetectors).filter(([id, _]) => !undos.includes(id)),
    );
    await adaptStealthyToObservers({
      actor,
      baselineStealth,
      detectors,
    });
  }
}

const REVEALED_AS = {
  observed: OBSERVED,
  hidden: HIDDEN,
  undetected: UNDETECTED,
};

export async function revealAvoidersTo({
  avoiders,
  observers,
  revealedAs = "observed",
}) {
  const revealedStealth = REVEALED_AS[revealedAs];
  debuglog("revealAvoidersTo", {
    avoiders,
    observers,
    revealedAs,
    revealedStealth,
  });
  for (const avoider of avoiders) {
    const actor = avoider?.actor;
    const stealthy = actor?.items?.find(
      (item) => item.system.slug === SLUGS.stealthy,
    );
    if (!stealthy) continue;
    const flags = stealthy?.flags?.[MODULE_ID] || {};
    if (!flags) continue;
    const detectors = foundry.utils.duplicate(flags.detectors || {});
    const baselineStealth = getStealthBaseline(stealthy);
    for (const detector of observers) {
      const id = detector.id;
      if (id in detectors) {
        detectors[id].stealth = Math.min(
          detectors[id].stealth,
          revealedStealth,
        );
      } else {
        detectors[id] = {
          stealth: revealedStealth,
          signature: detector.actor.signature,
        };
      }
    }
    await adaptStealthyToObservers({
      actor,
      baselineStealth,
      detectors,
    });
  }
}

async function createStealthEffect(actor, rules, flags, baselineStealth) {
  let effectData = {
    type: "effect",
    name: game.i18n.localize(`${MODULE_ID}.effects.stealthy.name`),
    img: "systems/pf2e/icons/conditions/unnoticed.webp",
    flags: {
      [MODULE_ID]: flags,
    },
    system: {
      description: {
        value: game.i18n.localize(`${MODULE_ID}.effects.stealthy.description`),
      },
      slug: SLUGS.stealthy,
      duration: {
        value: -1,
        unit: "unlimited",
        sustained: false,
        expiry: null,
      },
      rules: rules,
      tokenIcon: {
        show: false,
      },
      unidentified: false,
      badge: {
        type: "counter",
        value: baselineStealth,
        labels: [
          game.i18n.localize(`${MODULE_ID}.badge.hidden`),
          game.i18n.localize(`${MODULE_ID}.badge.undetected`),
        ],
        min: null,
        max: null,
      },
    },
  };

  return actor.createEmbeddedDocuments("Item", [effectData]);
}

function buildStealthSets(observers, baselineStealth = undefined) {
  const observations = Object.entries(observers);
  const list = observations.map(([_, o]) => o.stealth);
  const resultGroups = new Set(list);
  if (baselineStealth !== undefined) resultGroups.add(baselineStealth);
  const stealths = resultGroups.reduce((acc, stealth) => {
    if (stealth >= baselineStealth) return acc;
    const matches = observations.filter(([_, o]) => o.stealth === stealth);
    acc.push([STEALTH_LABELS[stealth], Object.fromEntries(matches)]);
    return acc;
  }, []);
  return Object.fromEntries(stealths);
}

function buildFlagsForExcept(stealth, exceptions, baselineStealth) {
  const flags = {};
  if (baselineStealth >= stealth && exceptions.length) {
    flags.except = exceptions.map(([id, _]) => id);
  }
  return flags;
}

function buildFlagsAndRules(stealths, detectors, baselineStealth) {
  const flags = {
    ...(Object.keys(detectors).length > 0 ? { detectors: detectors } : {}),
  };

  const observed = Object.entries(stealths.observed || {});
  {
    const hFlags = buildFlagsForExcept(HIDDEN, observed, baselineStealth);
    if (Object.keys(hFlags).length > 0) flags.hidden = hFlags;
  }

  {
    const uFlags = buildFlagsForExcept(
      UNDETECTED,
      observed.concat(Object.entries(stealths.hidden || {})),
      baselineStealth,
    );
    if (Object.keys(uFlags).length > 0) flags.undetected = uFlags;
  }

  return { flags, rules: buildRulesFromFlags(flags, baselineStealth) };
}

export async function adaptStealthyToObservers({
  actor,
  baselineStealth,
  detectors,
}) {
  // debuglog("adaptStealthEffectToObservers", {
  //   actor,
  //   baselineStealth,
  //   detectors,
  // });
  const stealths = buildStealthSets(detectors, baselineStealth);
  const { flags, rules } = buildFlagsAndRules(
    stealths,
    detectors,
    baselineStealth,
  );
  const effect = actor?.items?.find(
    (item) => item.system.slug === SLUGS.stealthy,
  );
  if (effect) {
    const update = {
      flags: {
        [MODULE_ID]: _replace(flags),
      },
      system: {
        badge: {
          value: baselineStealth,
        },
        rules: _replace(rules),
      },
    };
    return effect.update(update);
  }
  return createStealthEffect(actor, rules, flags, baselineStealth);
}
