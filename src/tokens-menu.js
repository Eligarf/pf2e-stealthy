import { prepareAmbush, clearAmbush, clearActorStealth } from "./stealth.js";
import { MODULE_ID, SLUGS } from "./const.js";
import { undoRevealsOf } from "./effects.js";
import { avoidanceCheck } from "./avoidance-check.js";
import { debuglog, iterateTokensAndParties, localizeString } from "./utils.js";
import { editStealth } from "./edit.js";

export function fillTokensMenu({ selection }) {
  const title = localizeString(`${MODULE_ID}.menu.tokensSelected`, {
    type: selection.type,
  });

  let choices = [];
  const combat = game?.combat;

  const avoiders = selection.tokens.filter((token) =>
    token.actor?.items?.some((i) => i.slug === SLUGS.stealthy),
  );

  if (!selection.dispositions.has(1)) {
    if (
      selection.tokens.some((t) => {
        const actor = t?.actor;
        if (!actor) return false;
        const stat = actor?.system?.initiative?.statistic;
        return stat !== "stealth";
      })
    ) {
      choices.push({
        key: "prepare-ambush",
        label: game.i18n.localize(`${MODULE_ID}.menu.prepareAmbush.label`),
        hint: localizeString(`${MODULE_ID}.menu.prepareAmbush.hint`, {
          type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
        }),
        group: 1,
        onClick: async () => {
          return prepareAmbush(selection.tokens);
        },
      });
    }
    if (
      selection.tokens.some((t) => {
        const actor = t?.actor;
        if (!actor) return false;
        const stat = actor?.system?.initiative?.statistic;
        return stat === "stealth";
      })
    ) {
      choices.push({
        key: "clear-ambush",
        label: game.i18n.localize(`${MODULE_ID}.menu.clearAmbush.label`),
        hint: localizeString(`${MODULE_ID}.menu.clearAmbush.hint`, {
          type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
        }),
        group: 1,
        onClick: async () => {
          return clearAmbush(selection.tokens);
        },
      });
    }
  }

  if (avoiders.length > 0) {
    let section = [];
    if (avoiders.length === 1 && combat.started) {
      section.push({
        key: "edit-stealth",
        label: game.i18n.localize(`${MODULE_ID}.menu.editStealth.label`),
        hint:
          selection.type === "controlled"
            ? game.i18n.localize(`${MODULE_ID}.menu.editControlledStealth.hint`)
            : game.i18n.localize(`${MODULE_ID}.menu.editTargetedStealth.hint`),
        group: 3,
        onClick: async () => {
          return editStealth(selection.tokens[0]);
        },
      });
    }
    section.push({
      key: "remove-stealth",
      label: game.i18n.localize(`${MODULE_ID}.menu.removeStealth.label`),
      hint:
        selection.type === "controlled"
          ? game.i18n.localize(`${MODULE_ID}.menu.removeControlledStealth.hint`)
          : game.i18n.localize(`${MODULE_ID}.menu.removeTargetedStealth.hint`),
      group: 3,
      onClick: async () => {
        return iterateTokensAndParties(selection.tokens, async (combatant) => {
          return clearActorStealth({ actor: combatant?.actor ?? combatant });
        });
      },
    });

    const observed = avoiders.some((token) => {
      const stealth = token.actor?.items?.find(
        (i) => i.slug === SLUGS.stealthy,
      );
      const flags = stealth?.flags?.[MODULE_ID];
      if (!flags) return false;
      return (
        flags.hidden?.except?.length > 0 || flags.undetected?.except?.length > 0
      );
    });

    if (observed) {
      section.push({
        key: "undo-reveals",
        label: game.i18n.localize(`${MODULE_ID}.menu.undoReveals.label`),
        hint: localizeString(`${MODULE_ID}.menu.undoReveals.hint`, {
          type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
        }),
        group: 3,
        refresh: true,
        onClick: async () => {
          await undoRevealsOf({ avoiders: selection.tokens });
        },
      });
    }

    if (section.length > 0) {
      if (choices.length > 0) {
        choices.push({
          isDivider: true,
          group: 2,
        });
      }
      choices.push(...section);
    }
  }

  if (!combat || !combat.started) {
    if (choices.length > 0) {
      choices.push({
        isDivider: true,
        group: 4,
      });
    }
    choices.push({
      key: "avoidance-check",
      label: game.i18n.localize(`${MODULE_ID}.menu.avoidanceCheck.label`),
      hint: localizeString(`${MODULE_ID}.menu.avoidanceCheck.hint`, {
        type: game.i18n.localize(`${MODULE_ID}.menu.type.${selection.type}`),
      }),
      group: 5,
      onClick: async () => {
        return avoidanceCheck(selection.tokens);
      },
    });
  }

  choices.sort((a, b) => a.group - b.group || a.label.localeCompare(b.label));
  return { title, choices };
}
