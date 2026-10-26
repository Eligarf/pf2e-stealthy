import { adaptStealthyToObservers } from "./effects.js";
import { UNDETECTED, OBSERVED } from "./const.js";
import { debuglog, interpolateString, getToken } from "./utils.js";

export async function findInitiativeCard(combatant) {
  let messages = game.messages.contents.filter(
    (m) =>
      m.speaker.token === combatant.tokenId && m.flags?.core?.initiativeRoll,
  );
  if (!messages.length) {
    messages = game.messages.contents.filter(
      (m) =>
        m.speaker.token === combatant.tokenId &&
        m.flags?.[game.system.id]?.modifierName ===
          combatant.flags?.[game.system.id]?.initiativeStatistic &&
        m?.rolls?.[0]?.total === combatant.initiative,
    );
  }
  return messages.length ? game.messages.get(messages.pop()._id) : null;
}

export async function applyInitiativeConditions(encounter, observations) {
  const baselineStealth = UNDETECTED;
  for (const id in observations) {
    const { observers, allies } = observations[id];
    const combatant = encounter.combatants.get(id);
    const detectors = Object.fromEntries(
      observers
        .filter((o) => {
          const check = o.check ?? o;
          return check.stealth < baselineStealth;
        })
        .map((o) => {
          const check = o.check ?? o;
          return [
            check.targetId,
            {
              stealth: check.stealth,
              signature: getToken(check.targetId)?.actor?.signature,
            },
          ];
        })
        .concat(
          allies.map((allyId) => [
            allyId,
            {
              stealth: OBSERVED,
              signature: getToken(allyId)?.actor?.signature,
            },
          ]),
        ),
    );
    await adaptStealthyToObservers({
      actor: combatant.actor,
      baselineStealth,
      detectors,
    });
  }
}
