import {
  debuglog,
  localizeString,
  getToken,
  renderTemplateAndEnrich,
} from "./utils.js";
import {
  MODULE_ID,
  STEALTH_LABELS,
  LOCALIZATION_KEYS,
  UNDETECTED,
  HIDDEN,
} from "./const.js";
import { findCompanionsOnCanvas } from "./combat.js";
import {
  getStealthyEffect,
  getStealthBaseline,
  setStealthinessTo,
} from "./effects.js";

export async function preparePointOutData(message, userId, actingToken) {
  // Warn if != 1 targets
  const targets = Array.from(game.user.targets);
  if (targets.length !== 1) {
    return ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.notifications.target1`),
    );
  }

  // Put targeted token in card data
  const subject = canvas.tokens.get(targets[0].id);
  const pointOut = {
    subjectId: subject.tokenDoc?.id || subject.id,
    subjectName: subject.name,
  };
  const update = {
    flags: {
      [MODULE_ID]: {
        card: "pointOut",
        origin: actingToken.id,
        pointOut,
      },
    },
  };

  // only do more if in combat
  const combat = game.combats.active;
  const turns = combat?.turns ?? [];
  if (!turns) return message.update(update);

  // ... and if they are stealthy
  const stealthy = getStealthyEffect(subject);
  const stealthBaseline = getStealthBaseline(stealthy);
  if (stealthBaseline !== UNDETECTED) {
    pointOut.message = `${MODULE_ID}.pointOut.notStealthy`;
    return message.update(update);
  }

  // ... and if we are a detector
  const flags = stealthy?.flags?.[MODULE_ID];
  const detectors = flags?.undetected || {};
  if (!detectors?.except?.includes(actingToken.id)) {
    pointOut.message = `${MODULE_ID}.pointOut.undetected`;
    return message.update(update);
  }

  // ... and if we have allies to point them out to
  const { minionTokens, eidolonTokens } = findCompanionsOnCanvas();
  const alliance = actingToken.actor?.system?.details?.alliance;
  const newDetectors = combat.combatants.contents
    .map((c) => c.token)
    .concat(minionTokens)
    .concat(eidolonTokens)
    .filter(
      (t) =>
        t.id !== actingToken.id &&
        t.actor?.system?.details?.alliance === alliance &&
        !detectors?.except?.includes(t.id),
    );
  if (!newDetectors.length) {
    pointOut.message = `${MODULE_ID}.pointOut.noAllies`;
    return message.update(update);
  }

  pointOut.showApplyButton = true;
  pointOut.newDetectors = newDetectors.map((t) => ({
    tokenId: t.id,
    name: t.name,
    stealth: HIDDEN,
    stealthLabel: STEALTH_LABELS[HIDDEN],
  }));
  return message.update(update);
}

async function applyPointOutEffects(message, _event, flags) {
  if (!game.user.isGM) return;
  const pointOut = flags.pointOut;
  const subject = getToken(pointOut.subjectId);
  if (!subject) return;
  canvas.ping(
    { x: subject.center.x, y: subject.center.y },
    { color: message.user?.color || game.user.color || "#ffffff" },
  );
  const targetList = pointOut.newDetectors;
  targetList.forEach(async (t) => {
    const token = getToken(t.tokenId);
    if (!token) return;
    await setStealthinessTo(subject, token, t.stealth);
  });
  pointOut.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

const stealthToggle = HIDDEN + UNDETECTED;

async function onPointOutStatusClick(message, _event, flags, targetId) {
  const targetList = flags.pointOut?.newDetectors;
  if (!targetList) return;
  const target = targetList.find((t) => t.tokenId === targetId);
  if (!target) return;
  target.stealth = stealthToggle - target.stealth;
  target.stealthLabel = STEALTH_LABELS[target.stealth];
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  return message.update(update);
}

async function renderDetectors(targetList, context) {
  const interactive = context.interactive ?? false;
  const count = targetList.reduce(
    (acc, t) => (t.stealth === HIDDEN ? acc + 1 : acc),
    0,
  );
  const templateData = {
    moduleId: MODULE_ID,
    ...(context.collapsed ? { collapsed: true } : {}),
    interactive: interactive ? "true" : "false",
    summary: localizeString(`${MODULE_ID}.pointOut.hiddens`, { count }),
    targetList: targetList.map((target) => {
      const hoverId = foundry.utils.randomID();
      (context["hoverIds"] ??= {})[hoverId] = target.tokenId;
      let clickId;
      if (interactive) {
        clickId = foundry.utils.randomID();
        (context["clickIds"] ??= {})[clickId] = async (
          message,
          event,
          flags,
        ) => {
          return context.onStatusClick(message, event, flags, target.tokenId);
        };
      }

      const result = {
        hoverId,
        to: localizeString(`${MODULE_ID}.pointOut.to`, {
          name: target.name,
        }),
        label: LOCALIZATION_KEYS[target.stealthLabel],
      };

      if (clickId) result.clickId = clickId;
      return result;
    }),
  };

  return renderTemplateAndEnrich(
    `modules/${MODULE_ID}/templates/detectors.hbs`,
    templateData,
  );
}

export async function renderPointOutCard(message, html, data, flags) {
  const pointOut = flags.pointOut;
  if (!pointOut) return;
  const hoverId = foundry.utils.randomID();
  const context = {
    interactive: pointOut.showApplyButton,
    collapsed: false,
    onStatusClick: onPointOutStatusClick,
    hoverIds: { [hoverId]: pointOut.subjectId },
  };

  const templateData = {
    moduleId: MODULE_ID,
    hoverId,
    subject: localizeString(`${MODULE_ID}.pointOut.subject`, {
      name: pointOut.subjectName,
    }),
    message: pointOut.message || "",
  };
  let content = await renderTemplateAndEnrich(
    `modules/${MODULE_ID}/templates/point-out.hbs`,
    templateData,
  );

  if (game.user.isGM) {
    const targetList = pointOut.newDetectors;
    if (targetList?.length) {
      context.change = targetList.some((t) => t.stealth !== UNDETECTED);
      content += await renderDetectors(targetList, context);
      if (context.interactive) {
        const clickId = foundry.utils.randomID();
        (context["clickIds"] ??= {})[clickId] = applyPointOutEffects;
        const templateData = {
          action: "point-out",
          moduleId: MODULE_ID,
          clickId,
          label: `${MODULE_ID}.effects.${context.change ? "apply" : "noChange"}`,
          ...(context.change ? { change: true } : {}),
        };
        content += await foundry.applications.handlebars.renderTemplate(
          `modules/${MODULE_ID}/templates/button.hbs`,
          templateData,
        );
      }
    }
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
