import { debuglog, localizeString, getToken } from "./utils.js";
import {
  MODULE_ID,
  STEALTH_LABELS,
  OBSERVED,
  LOCALIZATION_KEYS,
  DOS_KEYS,
} from "./const.js";
import { renderTargetList, renderSummary } from "./render-status.js";
import { cachedSettings } from "./settings.js";
import { adaptStealthEffectToObservers, getStealthinessTo } from "./effects.js";
import { findCompanionsOnCanvas, findPossibleTargets } from "./combat.js";

export async function editStealth(actingToken) {
  debuglog("editStealth", actingToken);
  const combat = game?.combat;
  const { minionTokens, eidolonTokens } = findCompanionsOnCanvas();
  const { us, them } = findPossibleTargets({
    encounter: combat,
    origin: actingToken,
    minionTokens,
    eidolonTokens,
  });
  const origin = {
    tokenDoc: actingToken?.document ?? actingToken,
    allies: us,
  };
  const targetList = them
    .map((target) => {
      const stealth = getStealthinessTo(origin, target.id);
      return {
        name: target.name,
        tokenId: target.id,
        stealth,
        was: stealth,
        stealthLabel: STEALTH_LABELS[stealth],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return ChatMessage.create({
    rollmode: "gmroll",
    flags: {
      [MODULE_ID]: {
        card: "edit",
        edit: {
          originId: actingToken.id,
          originName: actingToken.name,
          targetList,
          allies: origin.allies,
          showApplyButton: cachedSettings.useEffects,
        },
      },
    },
  });
}

async function applyEditEffects(message, _event, flags) {
  if (!game.user.isGM) return;
  const edit = flags.edit;
  const targetList = Object.fromEntries(
    edit.targetList
      .map((t) => [
        t.tokenId,
        {
          stealth: t.stealth,
          signature: getToken(t.tokenId)?.actor?.signature,
        },
      ])
      .concat(
        edit.allies.map((id) => [
          id,
          { stealth: OBSERVED, signature: getToken(id)?.actor?.signature },
        ]),
      ),
  );

  const origin = getToken(edit.originId);
  await adaptStealthEffectToObservers({
    actor: origin?.actor,
    baselineStealth: edit.targetList.reduce(
      (b, t) => Math.max(b, t.stealth),
      OBSERVED,
    ),
    detectors: targetList,
  });

  edit.showApplyButton = false;
  return message.update({ flags: { [MODULE_ID]: flags } });
}

async function onEditStatusClick(message, _event, flags, targetId) {
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
  return message.update(update);
}

export function renderEditCard(_message, html, _data, flags) {
  debuglog("renderEditCard", { _message, html, _data, flags });
  const edit = flags.edit;
  const targetList = edit.targetList;
  if (!targetList?.length) return {};
  const hoverId = foundry.utils.randomID();
  const context = {
    interactive: edit.showApplyButton,
    collapsed: false,
    onStatusClick: onEditStatusClick,
    change: targetList.some((t) => t.stealth !== t.was),
    hoverIds: { [hoverId]: edit.originId },
  };

  let content = `
    <div class="${MODULE_ID}-edit">
      <div class="${MODULE_ID}-subject" data-hover-id="${hoverId}">
        <div class="${MODULE_ID}-name">${localizeString(`${MODULE_ID}.edit.subject`, { name: edit.originName })}</div>
      </div>
    </div>
    <details ${context.collapsed ? "" : "open"} data-visibility="gm" class="${MODULE_ID}-target-list">
      <summary>${renderSummary(targetList, context)}</summary>`;

  const interactive = context.interactive ?? false;
  for (const target of targetList) {
    const hoverId = foundry.utils.randomID();
    context.hoverIds[hoverId] = target.tokenId;
    const vs = localizeString(`${MODULE_ID}.initiative.vs`, {
      name: target.name,
    });
    let resultTag;
    if (interactive) {
      let clickId = foundry.utils.randomID();
      (context["clickIds"] ??= {})[clickId] = async (message, event, flags) => {
        return context.onStatusClick(message, event, flags, target.tokenId);
      };
      resultTag = `
      <div class="${MODULE_ID}-result" data-click-id="${clickId}" data-interactive="true">`;
    } else {
      resultTag = `
      <div class="${MODULE_ID}-result" data-interactive="false">`;
    }
    content += `
      <div class="${MODULE_ID}-target" data-hover-id="${hoverId}">
        <div class="${MODULE_ID}-name">${vs}</div>
        ${resultTag}
          <span class="degree-of-success ${DOS_KEYS[target.stealth]}">
            ${game.i18n.localize(LOCALIZATION_KEYS[target.stealthLabel])}
          </span>
        </div>
      </div>`;
  }
  content += `
    </details>`;
  if (context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applyEditEffects;
    content += `
      <div class="${MODULE_ID}-edit">
        <button class="${MODULE_ID}-button" data-click-id="${clickId}" data-visibility="gm" ${context.change ? "" : "disabled"}>
          ${localizeString(`${MODULE_ID}.effects.${context.change ? "apply" : "noChange"}`)}
        </button>
      </div>`;
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
