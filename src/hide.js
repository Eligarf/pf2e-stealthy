import {
  debuglog,
  localizeString,
  getToken,
  renderTemplateAndEnrich,
} from "./utils.js";
import { MODULE_ID, STEALTH_LABELS, STEALTH, DOS } from "./const.js";
import { renderTargetList, renderSummary } from "./render-status.js";
import { prepareStealthChecks } from "./action.js";
import {
  adaptStealthyToObservers,
  getStealthyEffect,
  getStealthBaseline,
  getStealthinessTo,
} from "./effects.js";
import { refreshEverybody } from "./socket.js";

function resolveHide(origin, check) {
  const stealth = getStealthinessTo(origin, check.tokenDoc.id);
  check.was = stealth;
  if (check.degreeOfSuccess >= DOS.success) {
    if (stealth === STEALTH.undetected) {
      (check.tooltips ??= []).push({ format: `${MODULE_ID}.hide.retain` });
      check.stealth = STEALTH.undetected;
    } else check.stealth = STEALTH.hidden;
  } else check.stealth = STEALTH.observed;
  check.stealthLabel = STEALTH_LABELS[check.stealth];
}

export async function prepareHideData(message, userId, actingToken) {
  const { allies, summary, targetList } = prepareStealthChecks({
    message,
    userId,
    actingToken,
    resolver: resolveHide,
  });
  const update = {
    flags: {
      [MODULE_ID]: {
        card: "hide",
        origin: actingToken.id,
        hide: {
          summary,
          targetList,
          allies,
          showApplyButton: true,
        },
      },
    },
  };
  return message.update(update);
}

async function applyHideEffects(message, _event, flags) {
  if (!game.user.isGM) return;
  const stealthy = getStealthyEffect(message.token);
  const baselineStealth = stealthy
    ? Math.max(getStealthBaseline(stealthy), STEALTH.hidden)
    : STEALTH.hidden;
  const hide = flags.hide;
  const detectors = Object.fromEntries(
    hide.targetList
      .filter((t) => t.stealth < baselineStealth)
      .map((t) => [
        t.tokenId,
        {
          stealth: t.stealth,
          signature: getToken(t.tokenId)?.actor?.signature,
        },
      ])
      .concat(
        hide.allies.map((id) => [
          id,
          {
            stealth: STEALTH.observed,
            signature: getToken(id)?.actor?.signature,
          },
        ]),
      ),
  );
  await adaptStealthyToObservers({
    actor: message.token.actor,
    baselineStealth,
    detectors,
  });
  refreshEverybody();

  hide.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

const hideDosStates = [DOS.failure, DOS.success, DOS.success];

async function onHideStatusClick(message, _event, flags, targetId) {
  const targetList = flags[flags.card]?.targetList;
  if (!targetList) return;
  const target = targetList.find((t) => t.tokenId === targetId);
  if (!target) return;
  target.stealth =
    target.stealth === STEALTH.observed
      ? Math.max(STEALTH.hidden, target.was)
      : STEALTH.observed;
  target.stealthLabel = STEALTH_LABELS[target.stealth];
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  target.degreeOfSuccess = hideDosStates[target.stealth];
  return message.update(update);
}

export async function renderHideCard(message, html, _data, flags) {
  if (!game.user.isGM) return null;
  const hide = flags.hide;
  const targetList = hide.targetList;
  if (!targetList?.length) return {};
  const context = {
    interactive: hide.showApplyButton,
    avoiderId: message.token.id,
    collapsed: false,
    onStatusClick: onHideStatusClick,
    change: targetList.some((t) => t.stealth !== t.was),
  };
  const summary = await renderSummary(targetList, context);
  let content = await renderTargetList(targetList, summary, context);
  if (context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applyHideEffects;

    const templateData = {
      action: "hide",
      moduleId: MODULE_ID,
      clickId,
      label: `${MODULE_ID}.effects.${context.change ? "apply" : "noChange"}`,
      ...(context.change ? { change: true } : {}),
    };
    content += await renderTemplateAndEnrich(
      `modules/${MODULE_ID}/templates/button.hbs`,
      templateData,
    );
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
