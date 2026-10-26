import {
  MODULE_ID,
  LOCALIZATION_KEYS,
  OBSERVED,
  HIDDEN,
  UNDETECTED,
  DOS_KEYS,
} from "./const.js";
import { findInitiativeCard } from "./initiative.js";
import { debuglog, interpolateString, localizeString } from "./utils.js";
import { cachedSettings } from "./settings.js";
import { summarizeTargetList } from "./observation-logic.js";

export function prepareTargetList(sortedChecks) {
  return sortedChecks.map((o) => {
    const check = o.check ?? o;
    const tokenId = check.targetId || check.tokenDoc.id;
    const entry = {
      ...Object.fromEntries(
        Object.entries(check).filter(([k, _]) => k !== "tokenDoc"),
      ),
      targetId: tokenId,
    };
    return entry;
  });
}

export async function renderSummary(targetList, _context) {
  const summary = summarizeTargetList(targetList);
  const templateData = {
    moduleId: MODULE_ID,
    ...(summary[OBSERVED]
      ? {
          observedLabel: localizeString(
            `${MODULE_ID}.avoidanceCheck.observed`,
            {
              count: summary[OBSERVED],
            },
          ),
        }
      : {}),
    ...(summary[HIDDEN]
      ? {
          observedLabel: localizeString(`${MODULE_ID}.avoidanceCheck.hidden`, {
            count: summary[HIDDEN],
          }),
        }
      : {}),
    ...(summary[UNDETECTED]
      ? {
          observedLabel: localizeString(
            `${MODULE_ID}.avoidanceCheck.undetected`,
            {
              count: summary[UNDETECTED],
            },
          ),
        }
      : {}),
  };
  return foundry.applications.handlebars.renderTemplate(
    `modules/${MODULE_ID}/templates/summary.hbs`,
    templateData,
  );
}

export async function renderTargetList(targetList, summary, context) {
  const interactive = context.interactive ?? false;
  const templateData = {
    moduleId: MODULE_ID,
    ...(context.collapsed ? { collapsed: true } : {}),
    interactive: interactive ? "true" : "false",
    summary,
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
        dos: DOS_KEYS[target.degreeOfSuccess],
        label: LOCALIZATION_KEYS[target.stealthLabel],
        dc: target.dc,
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

  // debuglog("templateData", templateData);
  return foundry.applications.handlebars.renderTemplate(
    `modules/${MODULE_ID}/templates/target-list.hbs`,
    templateData,
  );
}

export async function updateInitiativeCards(encounter, observations) {
  for (const id in observations) {
    const { observers, allies } = observations[id];

    const sortedChecks = Object.values(observers).sort(
      (a, b) => b.dc - a.dc || a.name.localeCompare(b.name),
    );

    const targetList = prepareTargetList(sortedChecks);

    const combatant = encounter.combatants.get(id);
    const initiativeMessage = await findInitiativeCard(combatant);
    if (!initiativeMessage) {
      debuglog("No initiative message found for", { combatant });
      continue;
    }
    const update = {
      flags: {
        [MODULE_ID]: {
          card: "initiative",
          initiative: {
            name: combatant.name,
            activity: "PF2E.TravelSpeed.ExplorationActivities.AvoidNotice",
            targetList: targetList,
            allies,
          },
        },
      },
    };
    await initiativeMessage.update(update);
  }
}

export async function renderInitiativeCard(_message, html, _data, flags) {
  const initiative = flags.initiative;
  const context = {
    interactive: false,
    collapsed: cachedSettings.collapseTargetList,
  };
  let content;
  if (initiative.error) {
    content = `<div class="${MODULE_ID}-init-error">${localizeString(
      initiative.error,
      {
        actor: initiative.name,
        action: game.i18n.localize(
          "PF2E.TravelSpeed.ExplorationActivities.AvoidNotice",
        ),
      },
    )}</div>`;
  } else {
    const activity = interpolateString(
      game.i18n.localize(`${MODULE_ID}.activity`),
      {
        activity: game.i18n.localize(initiative.activity),
        actor: initiative.name,
      },
    );
    content = `<div class="${MODULE_ID}-init-activity">${activity}</div>`;
    const summary = await renderSummary(initiative.targetList, context);
    content += await renderTargetList(initiative.targetList, summary, context);
  }
  html.insertAdjacentHTML("beforeend", content);
  return context;
}
