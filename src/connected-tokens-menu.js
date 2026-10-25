import { MODULE_ID, SLUGS } from "./const.js";
import { clearActorStealth } from "./stealth.js";
import { revealAvoidersTo, undoRevealsOf } from "./effects.js";
import { debuglog, iterateTokensAndParties } from "./utils.js";

export function fillConnectedTokensMenu({ controlled, targeted }) {
  const controlledAvoidingTokens = controlled.tokens.filter((t) => {
    const actor = t?.actor;
    return actor?.items?.some((item) => item.system.slug === SLUGS.stealthy);
  });
  const targetedAvoidingTokens = targeted.tokens.filter((t) => {
    const actor = t?.actor;
    return actor?.items?.some((item) => item.system.slug === SLUGS.stealthy);
  });
  let controlledObservingTokens = [];

  let choices = [];

  if (controlledAvoidingTokens.length > 0) {
    controlledObservingTokens = controlledAvoidingTokens.filter((c) => {
      const avoider = c?.actor;
      const stealthy = avoider?.items?.find((i) => i.slug === SLUGS.stealthy);
      const flags = stealthy?.flags?.[MODULE_ID];
      const exceptions = (flags?.hidden?.except || []).concat(
        flags?.undetected?.except || [],
      );
      return targeted.tokens.some((t) => exceptions.includes(t.id));
    });
    if (controlledObservingTokens.length) {
      choices.push({
        key: "undo-controlled-reveals",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.undoControlledRevealsToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.undoControlledRevealsToTargeted.hint`,
        group: 2,
        refresh: true,
        onClick: async () => {
          return undoRevealsOf({
            avoiders: controlledAvoidingTokens,
            observers: targeted.tokens,
          });
        },
      });
    }

    choices.push(
      {
        key: "reveal-controlled",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.revealControlledToTargeted.label`,
        ),
        hint: `${MODULE_ID}.menu.revealControlledToTargeted.hint`,
        group: 2,
        refresh: true,
        onClick: async () => {
          return revealAvoidersTo({
            avoiders: controlledAvoidingTokens,
            observers: targeted.tokens,
          });
        },
      },
      {
        key: "remove-controlled-stealth",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.removeControlledStealth.label`,
        ),
        hint: `${MODULE_ID}.menu.removeControlledStealth.hint`,
        group: 2,
        refresh: true,
        onClick: async () => {
          return iterateTokensAndParties(
            controlled.tokens,
            async (combatant) => {
              return clearActorStealth({
                actor: combatant?.actor ?? combatant,
              });
            },
          );
        },
      },
    );
  }

  if (targetedAvoidingTokens.length > 0) {
    if (choices.length) {
      choices.push({
        isDivider: true,
        group: 3,
      });
    }

    choices.push(
      {
        key: "reveal-targeted",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.revealTargetedToControlled.label`,
        ),
        hint: `${MODULE_ID}.menu.revealTargetedToControlled.hint`,
        group: 4,
        refresh: true,
        onClick: async () => {
          return revealAvoidersTo({
            avoiders: targetedAvoidingTokens,
            observers: controlled.tokens,
          });
        },
      },
      {
        key: "remove-targeted-stealth",
        label: game.i18n.localize(
          `${MODULE_ID}.menu.removeTargetedStealth.label`,
        ),
        hint: `${MODULE_ID}.menu.removeTargetedStealth.hint`,
        group: 4,
        refresh: true,
        onClick: async () => {
          return iterateTokensAndParties(targeted.tokens, async (combatant) => {
            return clearActorStealth({ actor: combatant?.actor ?? combatant });
          });
        },
      },
    );
  }
  if (!choices.length) return null;

  choices.sort((a, b) => a.group - b.group || a.label.localeCompare(b.label));
  return { title: `${MODULE_ID}.menu.connectedTokens`, choices };
}
