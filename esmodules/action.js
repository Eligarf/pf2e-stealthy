import { MODULE_ID } from "./const.js";
import { debuglog, breakdownRoll } from "./utils.js";
import { prepareSeekData } from "./seek.js";
import { prepareHideData } from "./hide.js";
import { prepareSneakData } from "./sneak.js";
// import { prepareCreateADiversionData } from "./create-a-diversion.js";
import { preparePointOutData } from "./point-out.js";
import { findCompanionsOnCanvas, findPossibleTargets } from "./combat.js";
import { resolveStealthChecks } from "./observation-logic.js";
import { prepareTargetList } from "./render-status.js";
import { findBaseCoverBonus } from "./cover.js";
import { getStealthyEffect } from "./effects.js";
import { clearActorStealth } from "./stealth.js";

let pointOutText;
let rkRegex;
globalThis.Hooks.once("ready", () => {
  pointOutText = `<strong>${game.i18n.localize("PF2E.Actions.PointOut.Title")}</strong>`;
  const localizedRK = game.i18n.localize("PF2E.Actions.RecallKnowledge.Title");
  const escapedRK = localizedRK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexText = `<strong>\\s*${escapedRK}\\s*</strong>`;
  rkRegex = new RegExp(regexText);
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
  const action = flags.action;
  const token = message.token;
  await clearActorStealth({ actor: token.actor });
  action.showEndButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

export async function renderActionCard(message, html, _data, flags) {
  const action = flags.action;
  debuglog("renderActionCard", { message, _data, flags, action });
  const context = {
    after: action.after,
    interactive: action.showEndButton,
  };
  const stealthy = getStealthyEffect(message.token);
  if (stealthy && context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applyEndStealth;

    const templateData = {
      action: "action",
      moduleId: MODULE_ID,
      clickId,
      label: `${MODULE_ID}.endStealth.${action.after ? "afterLabel" : "beforeLabel"}`,
      change: true,
    };
    const content = await foundry.applications.handlebars.renderTemplate(
      `modules/${MODULE_ID}/templates/button.hbs`,
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
  const combat = game?.combat;
  if (!combat) return;
  const flags = message.flags[game.system.id];
  if (!flags) return;
  debuglog("createChatMessage (action)", { message, _options, userId, flags });

  const actingToken = message.token;
  const context = flags.context;
  let action = null;
  let rollOptions;
  if (context) {
    rollOptions = context.options || [];
    if (rollOptions.includes("action:seek")) {
      action = true;
      await prepareSeekData(message, userId, actingToken);
    } else if (rollOptions.includes("action:hide")) {
      return prepareHideData(message, userId, actingToken);
    } else if (rollOptions.includes("action:sneak")) {
      return prepareSneakData(message, userId, actingToken);
      // } else if (options.includes("action:create-a-diversion")) {
      //   return prepareCreateADiversionData(message, userId, actingToken);
    } else if (rollOptions.includes("action:step")) return; // step preserves stealth
  }
  if (!action && pointOutText && message.flavor?.includes(pointOutText)) {
    action = true;
    await preparePointOutData(message, userId, actingToken);
  }
  const stealthy = getStealthyEffect(actingToken);
  if (!stealthy) return;
  if (!action && rollOptions) {
    action = rollOptions.some((o) => o.startsWith("action:"));
  }
  if (!action && rkRegex && rkRegex.test(message.flavor)) {
    action = true;
  }

  // If we get here, then we need add the 'End Stealth' button
  if (action) {
    const update = {
      flags: {
        [MODULE_ID]: {
          card: "action",
          action: {
            showEndButton: true,
            after: action ? rollOptions?.includes("action:strike") : false,
          },
        },
      },
    };
    return message.update(update);
  }
});
