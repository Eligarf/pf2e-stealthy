import { isAvoider } from "./effects.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { findBaseCoverBonus } from "./cover.js";
import { sendStealthRollToGM } from "./socket.js";
import { resolveStealthChecks } from "./observation-logic.js";
import { resolveAvoidNotice } from "./sneak.js";
import {
  renderSummary,
  renderTargetList,
  prepareTargetList,
} from "./render-status.js";
import {
  getToken,
  breakdownRoll,
  debuglog,
  iterateTokensAndParties,
  localizeString,
  renderTemplateAndEnrich,
} from "./utils.js";

async function rollStealth(actor, { skipDialog = true, player = false } = {}) {
  const options = { skipDialog, player };
  const skill = actor?.skills?.stealth;
  if (!skill) return null;
  const roll = await skill.roll({
    rollMode: "gmroll",
    skipDialog: options.skipDialog,
    createMessage: options.player,
    traits: ["secret", "exploration"],
  });
  return roll;
}

function resolveStealthRoll({
  avoider,
  roll = null,
  targets,
  rawRollDosDelta = 0,
  skillResult = 10,
}) {
  if (roll) {
    ({ rawRollDosDelta } = breakdownRoll(roll));
    skillResult = roll.total;
  }
  const origin = {
    tokenDoc: avoider?.document ?? avoider,
    skillResult,
    rawRollDosDelta,
    baseCoverBonus: findBaseCoverBonus({
      actor: avoider?.actor ?? avoider,
    }),
  };
  return resolveStealthChecks({
    origin,
    targets,
    resolver: resolveAvoidNotice,
  });
}

function makeMissingActorsString() {
  const clownCar = localizeString("PF2E.Actor.Party.ClownCar.Deposit");
  const createEncounter = localizeString(
    `${MODULE_ID}.avoidanceCheck.createEncounter`,
  );
  return localizeString(`${MODULE_ID}.avoidanceCheck.missingActors`, {
    clownCar,
    createEncounter,
  });
}

async function renderEncounterSection(avoidanceCheck, context) {
  const templateData = {
    moduleId: MODULE_ID,
    ...(avoidanceCheck.missing.length > 0
      ? { missing: makeMissingActorsString() }
      : {}),
  };
  if (avoidanceCheck.missing.length > 0)
    templateData.missing = makeMissingActorsString();
  if (!avoidanceCheck.addedToCombat) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = createEncounter;
    templateData.clickId = clickId;
    templateData.title = `${MODULE_ID}.avoidanceCheck.createEncounterTooltip`;
    templateData.create = `${MODULE_ID}.avoidanceCheck.createEncounter`;
  }
  return renderTemplateAndEnrich(
    `modules/${MODULE_ID}/templates/encounter.hbs`,
    templateData,
  );
}

async function prepareAvoidanceCheckData(tokens) {
  const friendlyTokens = tokens.filter((t) => t.document.disposition === 1);
  const enemyTokens = tokens.filter((t) => t.document.disposition !== 1);

  let friendlies = [];
  await iterateTokensAndParties(friendlyTokens, async (combatant) => {
    if (!friendlies.includes(combatant)) friendlies.push(combatant);
  });

  const friendlyAvoiders = friendlies.filter((f) => isAvoider(f));
  const enemyAvoiders = enemyTokens.filter((t) => isAvoider(t));
  const noticableEnemies = enemyTokens
    .filter((t) => !enemyAvoiders.includes(t))
    .map((t) => ({ id: t.id, name: t.name }));
  const noticableFriendlies = friendlies
    .filter((t) => !friendlyAvoiders.includes(t))
    .map((t) => ({ id: t.id, name: t.name }));

  let enemyStealth = {};
  if (enemyAvoiders.length > 0) {
    for (const avoider of enemyAvoiders) {
      const roll = await rollStealth(avoider.actor);
      const { rawRollDosDelta } = breakdownRoll(roll);
      const checks = resolveStealthRoll({
        avoider,
        roll,
        targets: friendlies,
      }).sort((a, b) => b.dc - a.dc || a.name.localeCompare(b.name));
      const targetList = prepareTargetList(checks);

      enemyStealth[avoider.id] = {
        name: avoider.name,
        skillResult: roll.total,
        rawRollDosDelta,
        targetList,
      };
    }
  }

  let friendlyStealth = {};
  if (friendlyAvoiders.length > 0) {
    for (const avoider of friendlyAvoiders) {
      friendlyStealth[avoider.id || avoider.actor.id] = {
        name: avoider.name,
        skillResult: null,
        rawRollDosDelta: null,
      };
    }
  }

  const avoidanceCheckData = {
    addedToCombat: false,
    noticableEnemies: noticableEnemies,
    enemyIds: enemyTokens.map((t) => t.id),
    enemyStealth: enemyStealth ?? {},
    noticableFriendlies: noticableFriendlies,
    friendlyIds: friendlies.map((c) => c.id || c.actor.id),
    friendlyStealth: friendlyStealth ?? {},
    missing: friendlies.filter((c) => !getToken(c.id)).map((c) => c.actor.id),
  };
  return avoidanceCheckData;
}

async function renderAvoidanceCheck(avoidanceCheck, context) {
  debuglog("renderAvoidanceCheck", { avoidanceCheck, context });
  const templateData = {
    moduleId: MODULE_ID,
    title: `${MODULE_ID}.avoidanceCheck.title`,
    observedEnemies: `${MODULE_ID}.avoidanceCheck.observedEnemies`,
    observedFriendlies: `${MODULE_ID}.avoidanceCheck.observedFriendlies`,
  };

  const enemyIds = avoidanceCheck.enemyIds;
  if (enemyIds.length > 0) {
    templateData.enemyIds = avoidanceCheck.enemyIds;
    if (avoidanceCheck.noticableEnemies.length > 0) {
      templateData.noticableEnemies = avoidanceCheck.noticableEnemies.map(
        (n) => {
          const hoverId = foundry.utils.randomID();
          (context["hoverIds"] ??= {})[hoverId] = n.id;
          return { hoverId, name: n.name };
        },
      );
    }

    if (Object.keys(avoidanceCheck.enemyStealth).length > 0) {
      templateData.enemyAvoiders = [];
      for (let [tokenId, avoider] of Object.entries(
        avoidanceCheck.enemyStealth,
      )) {
        const hoverId = foundry.utils.randomID();
        (context["hoverIds"] ??= {})[hoverId] = tokenId;
        const summary = await renderSummary(avoider.targetList, context);
        templateData.enemyAvoiders.push({
          tokenId,
          hoverId,
          name: avoider.name,
          label: `${MODULE_ID}.avoidanceCheck.checkLabel`,
          skillResult: avoider.skillResult,
          targetList: await renderTargetList(
            avoider.targetList,
            summary,
            context,
          ),
        });
      }
    }
  }

  const friendlyIds = avoidanceCheck.friendlyIds;
  if (friendlyIds.length > 0) {
    templateData.friendlyIds = friendlyIds;
    if (avoidanceCheck.noticableFriendlies.length > 0) {
      templateData.noticableFriendlies = avoidanceCheck.noticableFriendlies.map(
        (n) => {
          const hoverId = foundry.utils.randomID();
          (context["hoverIds"] ??= {})[hoverId] = n.id;
          return { hoverId, name: n.name };
        },
      );
    }

    if (Object.keys(avoidanceCheck.friendlyStealth).length > 0) {
      templateData.friendlyAvoiders = [];
      for (let [tokenId, avoider] of Object.entries(
        avoidanceCheck.friendlyStealth,
      )) {
        const hoverId = foundry.utils.randomID();
        (context["hoverIds"] ??= {})[hoverId] = tokenId;
        const data = {
          tokenId,
          hoverId,
          name: avoider.name,
          label: `${MODULE_ID}.avoidanceCheck.checkLabel`,
        };
        if (avoider.skillResult !== null) {
          const summary = await renderSummary(avoider.targetList, context);
          data.result = avoider.skillResult;
          data.targetList = await renderTargetList(
            avoider.targetList,
            summary,
            context,
          );
        } else {
          const clickId = foundry.utils.randomID();
          (context["clickIds"] ??= {})[clickId] = async (
            message,
            event,
            flags,
          ) => {
            return rollClick(message, event, flags.avoidanceCheck, tokenId);
          };
          data.clickId = clickId;
        }
        templateData.friendlyAvoiders.push(data);
      }
    }
  }

  let content = await renderTemplateAndEnrich(
    `modules/${MODULE_ID}/templates/avoidance-check.hbs`,
    templateData,
  );

  const unrolled = Object.values(avoidanceCheck.friendlyStealth).some(
    (s) => s.skillResult === null,
  );
  if (!unrolled) {
    content += await renderEncounterSection(avoidanceCheck, context);
  }
  return content;
}

export async function avoidanceCheck(tokens) {
  const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
  const avoidanceCheckData = await prepareAvoidanceCheckData(tokens);
  const secret = !avoidanceCheckData.friendlyIds.length;
  avoidanceCheckData.secret = secret;
  return ChatMessage.create({
    rollmode: "gmroll",
    ...(secret ? { whisper: gmIds } : {}),
    flags: {
      [MODULE_ID]: {
        card: "avoidance-check",
        avoidanceCheck: avoidanceCheckData,
      },
    },
  });
}

async function createEncounter(message, _event, flags) {
  const avoidanceCheck = flags.avoidanceCheck;
  const combat = !game.combat
    ? await Combat.create({ scene: canvas.scene.id, active: true })
    : game.combat;
  const missing = avoidanceCheck.friendlyIds.filter((id) => !getToken(id));
  avoidanceCheck.missing = missing;
  if (missing.length > 0) {
    ui.notifications.warn(makeMissingActorsString());
    return message.update({ flags: { [MODULE_ID]: flags } });
  }
  const combatants = avoidanceCheck.enemyIds
    .map((id) => {
      const token = canvas.tokens.get(id);
      let entry = {
        tokenId: token?.id,
        hidden: token?.hidden,
      };
      if (
        id in avoidanceCheck.enemyStealth &&
        avoidanceCheck.enemyStealth[id]?.skillResult !== null
      ) {
        entry.initiative = avoidanceCheck.enemyStealth[id]?.skillResult;
        entry.flags = { [game.system.id]: { initiativeStatistic: "stealth" } };
      }
      return entry;
    })
    .concat(
      Object.keys(avoidanceCheck.friendlyStealth).map((id) => {
        const token = getToken(id);
        let entry = {
          tokenId: token?.id,
          hidden: token?.hidden,
        };
        if (avoidanceCheck.friendlyStealth[id]?.skillResult !== null) {
          const stealthEntry = avoidanceCheck.friendlyStealth[id];
          entry.initiative = stealthEntry?.skillResult;
          entry.flags = {
            [game.system.id]: { initiativeStatistic: "stealth" },
          };
        }
        return entry;
      }),
    )
    .filter(
      (c) =>
        !combat.combatants.find((existing) => existing.tokenId === c.tokenId),
    );
  await combat.createEmbeddedDocuments("Combatant", combatants);
  await combat.update({
    flags: { [MODULE_ID]: { avoidanceCheckMessageId: message.id } },
  });
  avoidanceCheck.addedToCombat = true;
  message.update({ flags: { [MODULE_ID]: flags } });
  await ui.combat.render(true);
}

async function rollClick(message, event, avoidanceCheck, tokenId) {
  if (avoidanceCheck.friendlyStealth[tokenId]?.skillResult !== null) return;
  const actor = canvas.tokens.get(tokenId)?.actor ?? game.actors.get(tokenId);
  if (!actor) return;
  if (!game.user.isGM && !actor.isOwner) return;
  let roll = null;
  let rollMessageId = null;
  if (avoidanceCheck.secret) {
    roll = await rollStealth(actor, {
      skipDialog: true,
      player: false,
    });
  } else {
    const skipDialog = event.shiftKey === game.user.settings.showCheckDialogs;
    globalThis.Hooks.once("createChatMessage", (msg) => {
      if (msg.rolls?.length && msg.speakerActor?.id === actor.id)
        rollMessageId = msg.id;
    });
    roll = await rollStealth(actor, {
      skipDialog,
      player: true,
    });
  }
  const { rawRollDosDelta } = breakdownRoll(roll);
  return sendStealthRollToGM({
    messageId: message.id,
    tokenId,
    skillResult: roll.total,
    rawRollDosDelta,
    rollMessageId,
  });
}

export async function onStealthReply({
  messageId,
  tokenId,
  skillResult,
  rawRollDosDelta,
  rollMessageId,
}) {
  debuglog("onStealthReply", {
    messageId,
    tokenId,
    skillResult,
    rawRollDosDelta,
    rollMessageId,
  });
  const message = game.messages.get(messageId);
  if (!message) return;
  const flags = message.flags[MODULE_ID];
  if (!flags) return;
  const avoidanceCheck = flags.avoidanceCheck;
  if (!avoidanceCheck) return;
  let avoider =
    canvas.tokens.get(tokenId) || game.actors.get(tokenId)?.prototypeToken;
  if (!avoider) return;

  const targets = avoidanceCheck.enemyIds.map((id) => canvas.tokens.get(id));
  const checks = resolveStealthRoll({
    avoider,
    rawRollDosDelta,
    skillResult,
    targets,
  }).sort((a, b) => b.dc - a.dc || a.name.localeCompare(b.name));
  const targetList = prepareTargetList(checks);

  const avoiderData = avoidanceCheck.friendlyStealth[tokenId];
  avoiderData.skillResult = skillResult;
  avoiderData.rawRollDosDelta = rawRollDosDelta;
  avoiderData.targetList = targetList;
  avoiderData.rollMessageId = rollMessageId;
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  await message.update(update);
}

export async function renderAvoidanceCheckCard(_message, html, _data, flags) {
  const context = { interactive: false, collapsed: true };
  const content = await renderAvoidanceCheck(flags.avoidanceCheck, context);
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
