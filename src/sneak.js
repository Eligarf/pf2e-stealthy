import {
  debuglog,
  localizeString,
  getToken,
  renderTemplateAndEnrich,
} from "./utils.js";
import {
  MODULE_ID,
  STEALTH_LABELS,
  UNDETECTED,
  OBSERVED,
  HIDDEN,
  SUCCESS,
  FAILURE,
  CRITICAL_FAILURE,
  SLUGS,
} from "./const.js";
import { renderTargetList, renderSummary } from "./render-status.js";
import { prepareStealthChecks } from "./action.js";
import { adaptStealthyToObservers, getStealthinessTo } from "./effects.js";

export function resolveAvoidNotice(_origin, check) {
  check.stealth =
    check.degreeOfSuccess >= SUCCESS
      ? UNDETECTED
      : check.degreeOfSuccess > CRITICAL_FAILURE
        ? HIDDEN
        : OBSERVED;
  check.stealthLabel = STEALTH_LABELS[check.stealth];
}

function resolveSneak(origin, check) {
  const stealth = getStealthinessTo(origin, check.tokenDoc.id);
  check.was = stealth;
  if (stealth > OBSERVED) {
    let dos = check.degreeOfSuccess;
    if (
      check.degreeOfSuccess === FAILURE &&
      origin.tokenDoc.actor.items.some(
        (i) => i.system.slug === SLUGS.sneakAdept,
      )
    ) {
      (check.tooltips ??= []).push({ format: `${MODULE_ID}.sneak.sneakAdept` });
      dos = SUCCESS;
    }

    check.stealth =
      dos >= SUCCESS ? UNDETECTED : dos > CRITICAL_FAILURE ? HIDDEN : OBSERVED;
  } else {
    check.stealth = OBSERVED;
    (check.tooltips ??= []).push({ format: `${MODULE_ID}.sneak.observed` });
  }
  check.stealthLabel = STEALTH_LABELS[check.stealth];
}

export async function prepareSneakData(message, userId, actingToken) {
  const { allies, summary, targetList } = prepareStealthChecks({
    message,
    userId,
    actingToken,
    resolver: resolveSneak,
  });
  const update = {
    flags: {
      [MODULE_ID]: {
        card: "sneak",
        origin: actingToken.id,
        sneak: {
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

async function applySneakEffects(message, _event, flags) {
  if (!game.user.isGM) return;
  const sneak = flags.sneak;
  const detectors = Object.fromEntries(
    sneak.targetList
      .filter((t) => t.stealth < UNDETECTED)
      .map((t) => [
        t.tokenId,
        {
          stealth: t.stealth,
          signature: getToken(t.tokenId)?.actor?.signature,
        },
      ])
      .concat(
        sneak.allies.map((id) => [
          id,
          { stealth: OBSERVED, signature: getToken(id)?.actor?.signature },
        ]),
      ),
  );
  await adaptStealthyToObservers({
    actor: message.token.actor,
    baselineStealth: UNDETECTED,
    detectors,
  });

  sneak.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

const sneakDosStates = [CRITICAL_FAILURE, FAILURE, SUCCESS];

async function onSneakStatusClick(message, _event, flags, targetId) {
  const targetList = flags[flags.card]?.targetList;
  if (!targetList) return;
  const target = targetList.find((t) => t.tokenId === targetId);
  if (!target) return;
  target.stealth = (target.stealth + 1) % 3;
  target.stealthLabel = STEALTH_LABELS[target.stealth];
  const update = {
    flags: {
      [MODULE_ID]: flags,
    },
  };
  target.degreeOfSuccess = sneakDosStates[target.stealth];
  return message.update(update);
}

export async function renderSneakCard(_message, html, _data, flags) {
  if (!game.user.isGM) return null;
  const sneak = flags.sneak;
  const targetList = sneak.targetList;
  if (!targetList?.length) return {};
  const context = {
    interactive: sneak.showApplyButton,
    collapsed: false,
    onStatusClick: onSneakStatusClick,
    change: targetList.some((t) => t.stealth !== t.was),
  };
  const summary = await renderSummary(targetList, context);
  let content = await renderTargetList(targetList, summary, context);
  if (context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applySneakEffects;
    const templateData = {
      action: "sneak",
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
