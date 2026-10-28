import { cachedSettings } from "./settings.js";
import { findInitiativeCard, applyInitiativeConditions } from "./initiative.js";
import { findBaseCoverBonus } from "./cover.js";
import { clearAllStealth } from "./stealth.js";
import { resolveStealthCheck } from "./observation-logic.js";
import { updateInitiativeCards } from "./render-status.js";
import { zoomToCombat } from "./socket.js";
import { resolveAvoidNotice } from "./sneak.js";
import { breakdownRoll, debuglog, refreshPerception } from "./utils.js";
import { MODULE_ID, SLUGS } from "./const.js";

let lastDeadNotificationTime = 0;
const NOTIFICATION_COOLDOWN_MS = 500;

export function findCompanionsOnCanvas() {
  const minionTokens = canvas.scene.tokens.filter(
    (t) =>
      t?.actor?.system?.traits?.value?.includes("minion") &&
      t?.actor?.system?.details?.alliance === "party",
  );
  const eidolonTokens = canvas.scene.tokens.filter(
    (t) => t?.actor?.system?.details?.class?.trait === "eidolon",
  );
  return { minionTokens, eidolonTokens };
}

export function findPossibleTargets({
  encounter,
  origin,
  minionTokens,
  eidolonTokens,
}) {
  const alliance = origin.actor?.system?.details?.alliance;
  const tokens = encounter.combatants.contents.map((c) => c.token);
  const them = tokens
    .concat(
      alliance !== "party" || cachedSettings.hideFromAllies ? minionTokens : [],
    )
    .concat(eidolonTokens)
    .filter((t) =>
      cachedSettings.hideFromAllies
        ? t.id !== origin.id
        : t.actor?.system?.details?.alliance !== alliance,
    )
    .map((t) =>
      t instanceof foundry.canvas.placeables.Token ? t.document : t,
    );

  const us = tokens
    .concat(
      alliance === "party" && !cachedSettings.hideFromAllies
        ? minionTokens
        : [],
    )
    .concat(eidolonTokens)
    .filter(
      (t) =>
        !cachedSettings.hideFromAllies &&
        t.id !== origin.id &&
        t.actor?.system?.details?.alliance === alliance,
    )
    .map((t) => t.id);
  return { us, them };
}

function preCreateCombatant(combatant, _data, _options, userId) {
  if (userId !== game.user.id) return true;
  if (!cachedSettings.keepDeadOut) return true;
  if (!combatant.isDefeated) {
    const actor = combatant.actor;
    if (!actor) return true;

    const isNPC = actor.type === "npc";
    if (!isNPC) return true;
    const isDead = actor.itemTypes?.condition?.some((c) => c.slug === "dead");
    const noHp = actor.system.attributes?.hp?.value <= 0;
    if (!(isDead || noHp)) return true;
  }

  const now = Date.now();
  if (now - lastDeadNotificationTime > NOTIFICATION_COOLDOWN_MS) {
    ui.notifications.info(
      game.i18n.localize(`${MODULE_ID}.notifications.keepDeadOut`),
    );
    lastDeadNotificationTime = now;
  }

  return false;
}

async function startCombatWrapper(wrapped, ...args) {
  if (!game.user.isGM) return wrapped(...args);

  const encounter = this;

  const avoidanceCheckMessageId =
    encounter.flags[MODULE_ID]?.avoidanceCheckMessageId;
  const avoidanceCheckMessage = avoidanceCheckMessageId
    ? game.messages.get(avoidanceCheckMessageId)
    : null;

  // Build out the various lists of combatant types
  // Pc are in parties and can have exploration activities
  let pcs = [];
  let avoiders = [];
  let ineligiblePcs = [];
  encounter.combatants.contents.forEach((c) => {
    const isPc = c.actor?.parties?.size > 0 && c.actor.system?.exploration;
    const isStealth =
      c.flags[game.system.id]?.initiativeStatistic === "stealth";
    if (!isPc) {
      if (isStealth) avoiders.push(c);
    } else {
      pcs.push(c);
      if (!cachedSettings.requireActivity) {
        if (isStealth) avoiders.push(c);
      } else {
        const isAvoiding = c.actor.system.exploration.some(
          (a) => c.actor.items.get(a)?.system?.slug === SLUGS.avoidNotice,
        );
        if (isStealth && !isAvoiding) ineligiblePcs.push(c);
        else if (isAvoiding) avoiders.push(c);
      }
    }
  });

  const { minionTokens, eidolonTokens } = findCompanionsOnCanvas();

  // initialize the aggregators
  let observations = {};

  //
  // Walk through all the avoiders and test them against the appropriate observers,
  // recording the results for later batch processing
  //
  for (const avoidingCombatant of avoiders) {
    // log("avoider", avoider);

    const initiativeCard = await findInitiativeCard(avoidingCombatant);
    let rawRollDosDelta = 0;
    if (initiativeCard) {
      ({ rawRollDosDelta } = breakdownRoll(initiativeCard?.rolls?.[0]));
    } else {
      const avoidanceCheck =
        avoidanceCheckMessage?.flags?.[MODULE_ID]?.avoidanceCheck;
      if (avoidanceCheck) {
        const tokenId = avoidingCombatant.token.id;
        if (tokenId in avoidanceCheck.enemyStealth) {
          rawRollDosDelta =
            avoidanceCheck.enemyStealth[tokenId].rawRollDosDelta;
        } else if (tokenId in avoidanceCheck.friendlyStealth) {
          rawRollDosDelta =
            avoidanceCheck.friendlyStealth[tokenId].rawRollDosDelta;
        }
      }
    }

    const { them: observers, us } = findPossibleTargets({
      encounter,
      origin: avoidingCombatant.token,
      minionTokens,
      eidolonTokens,
    });
    if (!observers.length) continue;

    const isAvoiderToken =
      avoidingCombatant.token instanceof foundry.canvas.placeables.Token;
    const avoiderTokenDoc = isAvoiderToken
      ? avoidingCombatant.token.document
      : avoidingCombatant.token;

    const origin = {
      tokenDoc: avoiderTokenDoc,
      skillResult: avoidingCombatant.initiative,
      rawRollDosDelta,
      baseCoverBonus: findBaseCoverBonus({ actor: avoidingCombatant.actor }),
      combatant: avoidingCombatant,
    };

    const alliance = avoiderTokenDoc.actor?.system?.details?.alliance;
    const avoiderSeenBy = {
      avoider: origin,
      observers: {},
      allies: alliance === "party" ? us : [],
    };
    observations[avoidingCombatant.id] = avoiderSeenBy;

    for (const observerTokenDoc of observers) {
      const observerActor = observerTokenDoc.actor;
      if (observerActor.type === "hazard") continue;
      const check = resolveStealthCheck({
        origin,
        target: observerTokenDoc,
        resolver: resolveAvoidNotice,
      });
      avoiderSeenBy.observers[observerTokenDoc.id] = check;
    }
  }

  // Any manipulations go here
  if (avoiders.length > 0 && cachedSettings.vetCombatStart) {
    debuglog("Need to vet combat", { encounter, ineligiblePcs, observations });
  }

  const update = {
    flags: {
      [MODULE_ID]: {
        ineligiblePcs: ineligiblePcs.map((c) => c.id),
        observations: Object.fromEntries(
          Object.entries(observations).map(([id, data]) => [
            id,
            {
              allies: data.allies,
              observers: Object.entries(data.observers).map(([_, o]) => {
                return {
                  ...Object.fromEntries(
                    Object.entries(o).filter(([k, _]) => k !== "tokenDoc"),
                  ),
                };
              }),
            },
          ]),
        ),
      },
    },
  };
  await encounter.update(update);
  return wrapped(...args);
}

async function combatStart(encounter) {
  const flags = encounter.flags[MODULE_ID];
  if (!flags) return;
  const ineligiblePcs = (flags.ineligiblePcs || []).map((id) =>
    encounter.combatants.get(id),
  );
  const observations = flags.observations;

  //
  // All observation calculations have been done at this point. Now we walk through
  // the result structure and build the messages for each affected chat card, as well
  // as the calls we need to do for the visibility manager
  //
  await updateInitiativeCards(encounter, observations);

  // Print out the warnings for PCs that aren't using Avoid Notice
  for (const pc of ineligiblePcs) {
    const initiativeMessage = await findInitiativeCard(pc);
    if (!initiativeMessage) continue;
    const update = {
      flags: {
        [MODULE_ID]: {
          card: "initiative",
          initiative: {
            name: pc.tokenDoc?.name || pc.name,
            error: `${MODULE_ID}.requireActivity.error`,
          },
        },
      },
    };
    await initiativeMessage.update(update);
  }

  let tokenUpdates = [];

  // Adjust the avoider's condition
  await applyInitiativeConditions(encounter, observations, tokenUpdates);

  // Reveal GM-hidden combatants so that their sneak results can control visibility
  // Do this last to avoid any flashes of observability
  const ghostedIds = encounter.combatants.contents
    .map((c) =>
      c.token instanceof foundry.canvas.placeables.Token
        ? c.token.document
        : c.token,
    )
    .filter((t) => t.hidden && t.actor.type !== "hazard")
    .map((t) => t.id);
  for (const t of ghostedIds) {
    let update = tokenUpdates.find((u) => u._id === t);
    if (update) {
      update.hidden = false;
    } else {
      tokenUpdates.push({ _id: t, hidden: false });
    }
  }

  // Update all the tokens at once, skipping an empty update
  if (tokenUpdates.length > 0) {
    canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
  }

  zoomToCombat(encounter, observations);
  refreshPerception();
}

globalThis.Hooks.once("ready", () => {
  globalThis.Hooks.on("preCreateCombatant", preCreateCombatant);
  globalThis.Hooks.on("combatStart", combatStart);
  globalThis.Hooks.on("deleteCombat", async () => {
    if (!game.user?.isActiveGM) return;
    return clearAllStealth();
  });

  libWrapper.register(
    MODULE_ID,
    "CONFIG.Combat.documentClass.prototype.startCombat",
    startCombatWrapper,
    "MIXED",
  );
});
