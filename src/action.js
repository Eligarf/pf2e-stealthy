import { HIDDEN, MODULE_ID, UNDETECTED } from "./const.js";
import { debuglog, breakdownRoll, renderTemplateAndEnrich } from "./utils.js";
import { prepareSeekData } from "./seek.js";
import { prepareHideData } from "./hide.js";
import { prepareSneakData } from "./sneak.js";
// import { prepareCreateADiversionData } from "./create-a-diversion.js";
import { preparePointOutData } from "./point-out.js";
import { findCompanionsOnCanvas, findPossibleTargets } from "./combat.js";
import { resolveStealthChecks } from "./observation-logic.js";
import { prepareTargetList } from "./render-status.js";
import { findBaseCoverBonus } from "./cover.js";
import {
  getStealthyEffect,
  getStealthBaseline,
  reduceStealthBaseline,
} from "./effects.js";
import { clearActorStealth } from "./stealth.js";

let pointOutText;
let flavorRegex;
let contentRegex;
globalThis.Hooks.once("ready", () => {
  pointOutText = `<strong>${game.i18n.localize("PF2E.Actions.PointOut.Title")}</strong>`;
  flavorRegex = /<h4 class="action"/;
  contentRegex = /<div class="pf2e chat-card action-card"/;
});

export function prepareStealthChecks({ message, actingToken, resolver }) {
  const combat = game?.combat;
  const { minionTokens, eidolonTokens } = findCompanionsOnCanvas();
  const { us, them } = findPossibleTargets({
    encounter: combat,
    origin: actingToken,
    minionTokens,
    eidolonTokens,
  });
  const roll = message.rolls?.[0];
  const { rawRollDosDelta } = breakdownRoll(roll);
  const origin = {
    tokenDoc: actingToken?.document ?? actingToken,
    roll,
    skillResult: roll.total,
    rawRollDosDelta,
    baseCoverBonus: findBaseCoverBonus({
      actor: actingToken?.actor ?? actingToken,
    }),
    allies: us,
  };
  const checks = resolveStealthChecks({
    origin,
    targets: them,
    resolver,
  }).sort((a, b) => b.dc - a.dc || a.name.localeCompare(b.name));
  return { allies: us, targetList: prepareTargetList(checks) };
}

async function applyEndStealth(message, _event, flags) {
  if (!game.user.isGM) return;
  const endStealth = flags.endStealth;
  const token = message.token;
  await clearActorStealth({ actor: token.actor });
  endStealth.showEndButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

async function applyReduceStealth(message, _event, flags) {
  if (!game.user.isGM) return;
  const endStealth = flags.endStealth;
  const token = message.token;
  await reduceStealthBaseline(token, HIDDEN);
  endStealth.showEndButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

export async function renderActionCard(message, html, _data, flags) {
  if (!game.user.isGM) return;
  const endStealth = flags.endStealth;
  const context = {
    after: endStealth.after,
    interactive: endStealth.showEndButton,
  };
  const stealthy = getStealthyEffect(message.token);
  if (stealthy && context.interactive) {
    const primaryClickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[primaryClickId] = applyEndStealth;

    const templateData = {
      moduleId: MODULE_ID,
      primaryClickId: primaryClickId,
      primaryLabel: `${MODULE_ID}.endStealth.${endStealth.after ? "afterLabel" : "beforeLabel"}`,
      change: true,
    };
    if (getStealthBaseline(stealthy) === UNDETECTED) {
      const secondaryClickId = foundry.utils.randomID();
      context.clickIds[secondaryClickId] = applyReduceStealth;
      templateData.secondaryClickId = secondaryClickId;
      templateData.secondaryLabel = `${MODULE_ID}.endStealth.hiddenInstead`;
      templateData.secondaryTooltip = game.i18n.localize(
        `${MODULE_ID}.endStealth.hiddenTooltip`,
      );
    }
    const content = await renderTemplateAndEnrich(
      `modules/${MODULE_ID}/templates/split-button.hbs`,
      templateData,
    );
    const contentBlock = html.querySelector("div.message-content");
    contentBlock.insertAdjacentHTML(
      context.after ? "afterend" : "beforebegin",
      content,
    );
  }
  return context;
}

Hooks.on("createChatMessage", async (message, _options, userId) => {
  if (game.userId !== userId) return;
  const combat = game?.combat;
  if (!combat) return;
  const flags = message.flags[game.system.id];
  if (!flags) return;
  // debuglog("createChatMessage (action)", { message, _options, userId, flags });

  const actingToken = message.token;
  const context = flags.context;
  let action = 0;
  let rollOptions;
  if (context) {
    rollOptions = context.options || [];
    if (rollOptions.includes("action:seek")) {
      // Something nasty crawls in if I try and put both buttons on this right now
      // action = -1;
      // await prepareSeekData(message, userId, actingToken);
      return await prepareSeekData(message, userId, actingToken);

      // Hide/Sneak/Step are okay actions under stealth
    } else if (rollOptions.includes("action:hide")) {
      return prepareHideData(message, userId, actingToken);
    } else if (rollOptions.includes("action:sneak")) {
      return prepareSneakData(message, userId, actingToken);
    } else if (rollOptions.includes("action:step")) return;

    // } else if (options.includes("action:create-a-diversion")) {
    //   return prepareCreateADiversionData(message, userId, actingToken);
  }

  // Gotta try and find the point out action specifically
  if (!action && flags.origin?.rollOptions) {
    if (flags.origin.rollOptions.includes("origin:item:point-out")) {
      action = -1;
      await preparePointOutData(message, userId, actingToken);
    }
  }
  if (!action) {
    if (pointOutText && message.flavor?.includes(pointOutText)) {
      action = -1;
      await preparePointOutData(message, userId, actingToken);
    }
  }

  // If you aren't stealthy, no worries
  const stealthy = getStealthyEffect(actingToken);
  if (!stealthy) return;

  // Check roll options first, then flavor text, then content
  // Maybe else-if in the future...
  if (!action && rollOptions) {
    const actions = rollOptions.filter((o) => o.startsWith("action:"));
    if (actions.length > 0) {
      action = actions.some((o) => o.startsWith("action:strike")) ? 1 : -1;
    }
  }
  if (!action && flavorRegex && flavorRegex.test(message.flavor)) {
    action = -1;
  }
  if (!action && contentRegex && contentRegex.test(message.content)) {
    action = -1;
  }

  // A naughty action for stealth. add bye-bye button
  if (action) {
    const update = {
      flags: {
        [MODULE_ID]: {
          endStealth: {
            showEndButton: true,
            after: action > 0,
          },
        },
      },
    };
    return message.update(update);
  }
});
