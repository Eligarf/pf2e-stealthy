import { isAvoider } from "./effects.js";
import { MODULE_ID } from "./const.js";
import { findBaseCoverBonus } from "./cover.js";
import { sendStealthRollToGM } from "./socket.js";
import { resolveStealthChecks } from "./observation-logic.js";
import { resolveAvoidNotice } from "./sneak.js";
import {
  prepareTargetList,
  renderSummary,
  renderTargetList,
} from "./render-status.js";
import {
  getToken,
  breakdownRoll,
  debuglog,
  iterateTokensAndParties,
  renderTemplateAndEnrich,
} from "./utils.js";
import {
  ExplorationCheckDialog,
  explorationCheckDialogId,
} from "./exploration-check-dialog.js";

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

async function prepareExplorationCheck(tokens) {
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

  const explorationCheck = {
    status: "pending",
    addedToCombat: false,
    noticableEnemies: noticableEnemies,
    enemyIds: enemyTokens.map((t) => t.id),
    enemyStealth: enemyStealth ?? {},
    noticableFriendlies: noticableFriendlies,
    friendlyIds: friendlies.map((c) => c.id || c.actor.id),
    friendlyStealth: friendlyStealth ?? {},
    missing: friendlies.filter((c) => !getToken(c.id)).map((c) => c.actor.id),
  };
  return explorationCheck;
}

async function createEncounter(message) {
  if (!message) return;
  const explorationCheck = message.flags[MODULE_ID].explorationCheck;
  if (!explorationCheck) return;
  const status = explorationCheck?.status ?? "none";
  if (status !== "complete") return;
  debuglog("createEncounter", explorationCheck);

  const combat = !game.combat
    ? await Combat.create({ scene: canvas.scene.id, active: true })
    : game.combat;

  async function addCombatants(ids, stealths) {
    const tokenIdsToSourceIds = {};
    const tokenDocs = ids
      .map((id) => {
        const token = canvas.tokens.get(id);
        if (token) {
          tokenIdsToSourceIds[token.id] = id;
          return token.id;
        }
        const actor = game.actors.get(id);
        const placed = canvas.tokens.placeables.find(
          (t) => t.actor?.id === actor?.id && t.document?.actorLink,
        );
        const placedId = placed?.id;
        tokenIdsToSourceIds[placedId] = id;
        return placedId;
      })
      .filter(
        (id) => !combat.combatants.some((existing) => existing.tokenId === id),
      )
      .map((id) => {
        const token = canvas.tokens.get(id);
        return token?.document ?? token;
      });
    const combatants =
      await TokenDocument.implementation.createCombatants(tokenDocs);
    const updates = combatants
      .filter(
        (c) =>
          (stealths[tokenIdsToSourceIds[c.tokenId]]?.skillResult ?? null) !==
          null,
      )
      .map((c) => ({
        _id: c.id,
        initiative: stealths[tokenIdsToSourceIds[c.tokenId]].skillResult,
        flags: {
          [game.system.id]: { initiativeStatistic: "stealth" },
        },
      }));
    if (updates.length) {
      await combat.updateEmbeddedDocuments("Combatant", updates);
    }
  }

  debuglog("createEncounter", { explorationCheck });
  await addCombatants(explorationCheck.enemyIds, explorationCheck.enemyStealth);
  await addCombatants(
    explorationCheck.friendlyIds,
    explorationCheck.friendlyStealth,
  );

  await combat.update({
    flags: { [MODULE_ID]: { explorationCheck: explorationCheck } },
  });
  await ui.combat.render(true);
}

async function renderExplorationCheck(explorationCheck, context) {
  debuglog("renderExplorationCheck", { explorationCheck, context });
  const templateData = {
    ...(game.user.isGM ? { isGM: true } : {}),
    moduleId: MODULE_ID,
    title: `${MODULE_ID}.explorationCheck.title`,
    observedFriendlies: `${MODULE_ID}.explorationCheck.observedFriendlies`,
  };

  if (explorationCheck.status === "pending") {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = async (message, _event, _flags) => {
      const existing = foundry.applications.instances.get(
        explorationCheckDialogId,
      );
      if (existing) {
        existing.bringToFront();
      } else {
        new ExplorationCheckDialog(message, createEncounter).render({
          force: true,
        });
      }
    };
    templateData.clickId = clickId;
    templateData.reopen = `${MODULE_ID}.explorationCheck.reopen`;
  }

  const friendlyIds = explorationCheck.friendlyIds;
  if (friendlyIds.length > 0) {
    templateData.friendlyIds = friendlyIds;
    if (explorationCheck.noticableFriendlies.length > 0) {
      templateData.noticableFriendlies =
        explorationCheck.noticableFriendlies.map((n) => {
          const hoverId = foundry.utils.randomID();
          (context["hoverIds"] ??= {})[hoverId] = n.id;
          return { hoverId, name: n.name };
        });
    }

    if (Object.keys(explorationCheck.friendlyStealth).length > 0) {
      templateData.friendlyAvoiders = [];
      for (let [tokenId, avoider] of Object.entries(
        explorationCheck.friendlyStealth,
      )) {
        context.avoiderId = tokenId;
        const data = {
          tokenId,
          name: avoider.name,
          label: `${MODULE_ID}.explorationCheck.checkLabel`,
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
            return rollClick(message, event, flags.explorationCheck, tokenId);
          };
          data.clickId = clickId;
        }
        templateData.friendlyAvoiders.push(data);
      }
    }
  }

  return renderTemplateAndEnrich(
    `modules/${MODULE_ID}/templates/exploration-check.hbs`,
    templateData,
  );
}

export async function resolveExplorationStealth(tokens) {
  // Look for existing messages and turn off their clicks
  //
  const pendingChecks = game.messages.filter(
    (m) => m.flags[MODULE_ID].explorationCheck?.status === "pending",
  );
  pendingChecks.forEach(async (m) => {
    const update = {
      flags: {
        [MODULE_ID]: {
          explorationCheck: {
            status: "cancelled",
            friendlyStealth: _replace({}),
          },
        },
      },
    };
    await m.update(update);
  });
  const explorationCheck = await prepareExplorationCheck(tokens);

  const existing = foundry.applications.instances.get(explorationCheckDialogId);
  if (existing) {
    existing.bringToFront();
  } else {
    const message = await ChatMessage.create({
      rollmode: "gmroll",
      ...(!Object.keys(explorationCheck.friendlyStealth).length
        ? { whisper: game.users.filter((u) => u.isGM).map((u) => u.id) }
        : {}),
      flags: {
        [MODULE_ID]: {
          card: "exploration-check",
          explorationCheck,
        },
      },
    });

    new ExplorationCheckDialog(message, createEncounter).render({
      force: true,
    });
  }
}

async function rollClick(message, event, explorationCheck, tokenId) {
  if (explorationCheck.friendlyStealth[tokenId]?.skillResult !== null) return;
  const actor = canvas.tokens.get(tokenId)?.actor ?? game.actors.get(tokenId);
  if (!actor) return;
  if (!game.user.isGM && !actor.isOwner) return;
  let roll = null;
  let rollMessageId = null;
  if (explorationCheck.secret) {
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
  const explorationCheck = flags.explorationCheck;
  if (!explorationCheck) return;
  let avoider =
    canvas.tokens.get(tokenId) || game.actors.get(tokenId)?.prototypeToken;
  if (!avoider) return;

  const targets = explorationCheck.enemyIds.map((id) => canvas.tokens.get(id));
  const checks = resolveStealthRoll({
    avoider,
    rawRollDosDelta,
    skillResult,
    targets,
  }).sort((a, b) => b.dc - a.dc || a.name.localeCompare(b.name));
  const targetList = prepareTargetList(checks);

  const avoiderData = explorationCheck.friendlyStealth[tokenId];
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
  const existing = foundry.applications.instances.get(explorationCheckDialogId);
  if (existing) {
    existing.render();
  }
}

export async function renderAvoidanceCheckCard(_message, html, _data, flags) {
  const context = { interactive: false, collapsed: true };
  const content = await renderExplorationCheck(flags.explorationCheck, context);
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
