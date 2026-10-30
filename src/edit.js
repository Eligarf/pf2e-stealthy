import {
  debuglog,
  localizeString,
  getToken,
  renderTemplateAndEnrich,
} from "./utils.js";
import {
  MODULE_ID,
  STEALTH_LABELS,
  OBSERVED,
  LOCALIZATION_KEYS,
  DOS_KEYS,
} from "./const.js";
import { renderSummary } from "./render-status.js";
import {
  adaptStealthyToObservers,
  getStealthinessTo,
  getStealthBaseline,
  getStealthyEffect,
} from "./effects.js";
import { findCompanionsOnCanvas, findPossibleTargets } from "./combat.js";
import { refreshEverybody } from "./socket.js";

export async function editStealth(actingToken) {
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
  const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);

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
          showApplyButton: true,
        },
      },
    },
    whisper: gmIds,
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
  const stealthy = getStealthyEffect(origin);
  const baselineStealth = getStealthBaseline(stealthy);
  await adaptStealthyToObservers({
    actor: origin?.actor,
    baselineStealth,
    detectors: targetList,
  });
  refreshEverybody();

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

export async function renderEditCard(_message, html, _data, flags) {
  if (!game.user.isGM) return null;
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

  const interactive = context.interactive ?? false;
  const templateData = {
    moduleId: MODULE_ID,
    hoverId,
    interactive,
    subject: localizeString(`${MODULE_ID}.edit.subject`, {
      name: edit.originName,
    }),
    summary: await renderSummary(targetList, context),
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
        vs: localizeString(`${MODULE_ID}.initiative.vs`, {
          name: target.name,
        }),
        dos: DOS_KEYS[target.stealth],
        label: LOCALIZATION_KEYS[target.stealthLabel],
      };

      if (clickId) result.clickId = clickId;
      if (target.tooltips?.length > 0) {
        result.tooltips = target.tooltips.map((t) =>
          localizeString(
            t.format,
            t.interpolations?.length > 0
              ? Object.fromEntries(
                  Object.entries(t.interpolations).map(([k, v]) => [
                    k,
                    game.i18n.localize(v),
                  ]),
                )
              : {},
          ),
        );
      }

      return result;
    }),
  };

  let content = await foundry.applications.handlebars.renderTemplate(
    `modules/${MODULE_ID}/templates/edit.hbs`,
    templateData,
  );

  if (context.interactive) {
    const clickId = foundry.utils.randomID();
    (context["clickIds"] ??= {})[clickId] = applyEditEffects;
    const templateData = {
      action: "edit",
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
