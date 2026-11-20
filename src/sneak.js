import { debuglog, getToken, renderTemplateAndEnrich } from "./utils.js";
import {
  MODULE_ID,
  STEALTH_LABELS,
  STEALTH,
  DOS,
  SLUGS,
  LOCALIZATION_KEYS,
} from "./const.js";
import { renderTargetList, renderSummary } from "./render-status.js";
import { prepareStealthChecks } from "./action.js";
import { adaptStealthyToObservers, getStealthinessTo } from "./effects.js";
import { refreshEverybody } from "./socket.js";

export function resolveAvoidNotice(_origin, check) {
  check.stealth =
    check.degreeOfSuccess >= DOS.success
      ? STEALTH.undetected
      : check.degreeOfSuccess > DOS.criticalFailure
        ? STEALTH.hidden
        : STEALTH.observed;
  check.stealthLabel = STEALTH_LABELS[check.stealth];
}

function resolveSneak(origin, check) {
  let stealth = getStealthinessTo(origin, check.tokenDoc.id);
  const invisible = origin.tokenDoc.actor.items.some(
    (i) => i.system.slug === "invisible",
  );
  if (invisible && stealth === STEALTH.observed) {
    (check.tooltips ??= []).push({ format: LOCALIZATION_KEYS.invisible });
    const perception = check.tokenDoc.actor.perception;
    const seeInvisible = perception.senses.get("see-invisibility");
    if (seeInvisible) {
      check.tooltips.push({ format: seeInvisible.source });
    } else {
      stealth = STEALTH.hidden;
    }
  }
  check.was = stealth;
  if (stealth > STEALTH.observed) {
    let dos = check.degreeOfSuccess;
    if (
      check.degreeOfSuccess === DOS.failure &&
      origin.tokenDoc.actor.items.some(
        (i) => i.system.slug === SLUGS.sneakAdept,
      )
    ) {
      (check.tooltips ??= []).push({ format: `${MODULE_ID}.sneak.sneakAdept` });
      dos = DOS.success;
    }

    check.stealth =
      dos >= DOS.success
        ? STEALTH.undetected
        : dos > DOS.criticalFailure
          ? STEALTH.hidden
          : STEALTH.observed;
  } else {
    check.stealth = STEALTH.observed;
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
      .filter((t) => t.stealth < STEALTH.undetected)
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
          {
            stealth: STEALTH.observed,
            signature: getToken(id)?.actor?.signature,
          },
        ]),
      ),
  );
  await adaptStealthyToObservers({
    actor: message.token.actor,
    baselineStealth: STEALTH.undetected,
    detectors,
  });
  refreshEverybody();

  sneak.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

export const sneakDosStates = [DOS.criticalFailure, DOS.failure, DOS.success];

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

export async function renderSneakCard(message, html, _data, flags) {
  if (!game.user.isGM) return null;
  const sneak = flags.sneak;
  const targetList = sneak.targetList;
  if (!targetList?.length) return {};
  const context = {
    interactive: sneak.showApplyButton,
    avoiderId: message.token.id,
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
