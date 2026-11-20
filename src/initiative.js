import { adaptStealthyToObservers } from "./effects.js";
import { STEALTH } from "./const.js";
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

export async function declumpInitiative() {
  const combat = game.combats.active;
  const turns = combat?.turns ?? [];
  if (!turns.length) return;
  const delta = 3;
  const total = turns.length;
  const topInit = turns[0].initiative ?? 20;
  const bottomInit = topInit - delta * (total - 1);

  let init = bottomInit < 1 ? topInit + 1 - bottomInit : topInit;
  for (let i = 0; i < total; ++i) {
    const combatant = turns[i];
    if (init !== combatant.initiative) {
      await combat.setInitiative(combatant.id, init);
    }
    init -= delta;
  }
}

export async function applyInitiativeConditions(encounter, observations) {
  const baselineStealth = STEALTH.undetected;
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
            check.tokenId,
            {
              stealth: check.stealth,
              signature: getToken(check.tokenId)?.actor?.signature,
            },
          ];
        })
        .concat(
          allies.map((allyId) => [
            allyId,
            {
              stealth: STEALTH.observed,
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
