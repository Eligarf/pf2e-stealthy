import { SLUGS } from "./const.js";
import { interpolateString, refreshPerception } from "./utils.js";

export async function clearActorStealth({ actor }) {
  const conditions =
    actor?.items
      .filter((i) => i.system.slug === SLUGS.stealthy)
      .map((i) => i.id) || [];
  if (conditions.length > 0) {
    await actor.deleteEmbeddedDocuments("Item", conditions);
  }
}

export async function clearAllStealth() {
  for (const token of canvas.scene.tokens) {
    await clearActorStealth({ actor: token?.actor, refresh: false });
  }

  refreshPerception();
}

export async function prepareAmbush(tokens) {
  let tokenUpdates = [];

  for (const token of tokens) {
    tokenUpdates.push({ _id: token.id, hidden: true });
    const actor = token?.actor;
    if (!actor) continue;
    await actor.update({ "system.initiative.statistic": "stealth" });
    if (actor.type === "hazard")
      await actor.toggleCondition("hidden", { active: true });
  }

  if (tokenUpdates.length > 0) {
    return canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
  }
}

export async function clearAmbush(tokens) {
  let tokenUpdates = [];

  for (const token of tokens) {
    tokenUpdates.push({ _id: token.id, hidden: false });
    const actor = token?.actor;
    if (!actor) continue;
    await actor.update({ "system.initiative.statistic": "perception" });
    if (actor.type === "hazard")
      await actor.toggleCondition("hidden", { active: false });
  }

  if (tokenUpdates.length > 0) {
    return canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates);
  }
}
