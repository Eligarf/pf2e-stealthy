import {
  MODULE_ID,
  SLUGS,
  HIDDEN,
  UNDETECTED,
  OBSERVED,
  STEALTH_LABELS,
} from "./const.js";
import { debuglog, warnlog, getToken } from "./utils.js";
import { cachedSettings } from "./settings.js";

let hooks = {};
let observingTokenIds = {};
let blindedObservers = 0;
let alertableTokenIds = {};
let alertedTokenIds = {};
let activeSenses = {};

function mergeAlertables(a, b) {
  const spread = [...a, ...b];
  const redux = spread.reduce((acc, [key, value]) => {
    if (!(key in acc) || value < acc[key]) acc[key] = value;
    return acc;
  }, {});
  return redux;
}

hooks.canvasReady = globalThis.Hooks.on("canvasReady", async () => {
  debuglog(`Canvas is ready`);
});

let filterMap = new WeakMap();

const OBSERVED_ALERT_LABEL = `${MODULE_ID}-observed`;
const HIDDEN_ALERT_LABEL = `${MODULE_ID}-hidden`;
let alertTextures = [];
const SVG_DATA = [
  "M320 64C334.7 64 348.2 72.1 355.2 85L571.2 485C577.9 497.4 577.6 512.4 570.4 524.5C563.2 536.6 550.1 544 536 544L104 544C89.9 544 76.8 536.6 69.6 524.5C62.4 512.4 62.1 497.4 68.8 485L284.8 85C291.8 72.1 305.3 64 320 64zM320 416C302.3 416 288 430.3 288 448C288 465.7 302.3 480 320 480C337.7 480 352 465.7 352 448C352 430.3 337.7 416 320 416zM320 224C301.8 224 287.3 239.5 288.6 257.7L296 361.7C296.9 374.2 307.4 384 319.9 384C332.5 384 342.9 374.3 343.8 361.7L351.2 257.7C352.5 239.5 338.1 224 319.8 224z",
  "M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM320 240C302.3 240 288 254.3 288 272C288 285.3 277.3 296 264 296C250.7 296 240 285.3 240 272C240 227.8 275.8 192 320 192C364.2 192 400 227.8 400 272C400 319.2 364 339.2 344 346.5L344 350.3C344 363.6 333.3 374.3 320 374.3C306.7 374.3 296 363.6 296 350.3L296 342.2C296 321.7 310.8 307 326.1 302C332.5 299.9 339.3 296.5 344.3 291.7C348.6 287.5 352 281.7 352 272.1C352 254.4 337.7 240.1 320 240.1zM288 432C288 414.3 302.3 400 320 400C337.7 400 352 414.3 352 432C352 449.7 337.7 464 320 464C302.3 464 288 449.7 288 432z",
];

globalThis.Hooks.once("ready", async () => {
  debuglog(`appstate is ready`);
  if (cachedSettings.visionHack) setupVisibilityHooks();
  for (const token of canvas.tokens.controlled) {
    controlTokenHook(token, true);
  }

  const color = "#dfdf00";
  for (let i in SVG_DATA) {
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="256" height="256">
        <path fill="${color}" d="${SVG_DATA[i]}"/>
      </svg>`.trim();
    const encodedIconTexture = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
    alertTextures.push(PIXI.Texture.from(encodedIconTexture));
  }
});

export function refreshVisibilityCache() {
  debuglog(`refreshVisibilityCache`);
  alertableTokenIds = {};
  for (const token of canvas.tokens.placeables) {
    if (token.id in alertedTokenIds) {
      showAlert({ token, stealth: UNDETECTED });
    }
  }
}

function findDetections(token) {
  const actor = token?.actor;
  const stealth = actor?.items.find((i) => i.slug === SLUGS.stealthy);
  if (!stealth) return null;
  const flags = stealth.flags[MODULE_ID];
  if (!flags) return null;
  return {
    baselineStealth: stealth.system.badge.value,
    detectors: flags.detectors || {},
  };
}

function mergeSenses(senses) {
  senses.forEach((s) => {
    if (s in activeSenses) return;
    activeSenses[s] = {};
  });
}

function resetSenses() {
  activeSenses = {};
  for (const id in observingTokenIds) {
    const token = canvas.tokens.get(id);
    const actor = token.actor;
    const perception = actor.perception;
    const senses = perception.senses.contents.map((s) => s.type);
    mergeSenses(senses);
  }
}

function showAlert({ token, stealth }) {
  // UNDETECTED means no alert
  if (stealth === UNDETECTED) {
    const alert = token.mesh.children.find(
      (c) => c.name === OBSERVED_ALERT_LABEL || c.name === HIDDEN_ALERT_LABEL,
    );
    if (alert) {
      delete alertedTokenIds[token.id];
      token.removeChild(alert);
      alert.destroy({ children: true, texture: false });
    }
    return;
  }

  // Are we already there?
  const spriteName = `${MODULE_ID}-${STEALTH_LABELS[stealth]}`;
  let alert = token.mesh.children.find((c) => c.name === spriteName);
  if (alert) return;

  // Is the other one there?
  const otherName = `${MODULE_ID}-${STEALTH_LABELS[OBSERVED + HIDDEN - stealth]}`;
  let oldAlert = token.mesh.children.find((c) => c.name === otherName);
  if (oldAlert) {
    token.removeChild(oldAlert);
    oldAlert.destroy({ children: true, texture: false });
  }

  alert = new PIXI.Sprite(alertTextures[stealth]);
  alert.name = spriteName;
  alert.anchor.set(0.5, 0.5);
  alert.x = 0;
  alert.y = 0;
  alert.alpha = 0.5;
  token.mesh.addChild(alert);
  alertedTokenIds[token.id] = stealth;
}

function findDetectors(token) {
  const detections = findDetections(token);
  if (!detections) return null;
  return Object.entries(detections.detectors)
    .filter(([_, o]) => o.stealth < detections.baselineStealth)
    .map(([id, d]) => [id, d.stealth]);
}

function controlTokenHook(token, controlled) {
  // debuglog(`'${token.name}' controlled: ${controlled}`, { token, controlled });

  // Look for blinded condition because we always care
  const actor = token.actor;
  const isBlinded = actor.items.some((i) => i.system.slug === "blinded");

  // if we are releasing control, stop caring about the observing token
  if (!controlled) {
    delete observingTokenIds[token.id];

    // We don't know which observer has which sense, so rebuild them
    if (isBlinded) blindedObservers = blindedObservers - 1;
    resetSenses();
    // debuglog("Reset senses:", foundry.utils.duplicate(activeSenses));
  }

  // Otherwise, we have a new observer so now we have to pay attention to it
  // to its senses
  else {
    observingTokenIds[token.id] = true;

    // Maybe we have to clean a mutation up?
    const tokenDoc = token.document || token;
    if (filterMap.has(tokenDoc)) {
      // debuglog(`==> '${token.name}' might need to restore filter`);
      // filterMap.delete(token.document || token);
    }

    if (isBlinded) blindedObservers = blindedObservers + 1;
    const perception = actor.perception;
    const senses = perception.senses.contents.map((s) => s.type);
    mergeSenses(senses);
    // debuglog("Updated senses:", foundry.utils.duplicate(activeSenses));
  }

  // Handle updating the alertable set which only the GM sees
  if (!game.user.isGM) return;
  canvas.perception.initialize();
  if (controlled) {
    const detectors = findDetectors(token);
    if (detectors)
      alertableTokenIds = mergeAlertables(
        Object.entries(alertableTokenIds),
        detectors,
      );
  } else {
    alertableTokenIds = {};
    for (const id in observingTokenIds) {
      const token = canvas.tokens.get(id);
      const detectors = findDetectors(token);
      if (detectors)
        alertableTokenIds = mergeAlertables(
          Object.entries(alertableTokenIds),
          detectors,
        );
    }
  }
}

function refreshTokenHook(token, options) {
  if (!options.refreshVisibility) return;

  // First handle alerts - we show them to enabled GM regardless of
  // other vision states
  if (game.user.isGM && cachedSettings.alerts) {
    const isRevealed = token.id in alertableTokenIds;

    // UNDETECTED means nobody is alerted
    if (!isRevealed) {
      showAlert({ token, stealth: UNDETECTED });
    }

    // Otherwise we show the appropriate alert, but make sure that we
    // don't alert on allies if we don't hide from them
    else {
      if (!cachedSettings.hideFromAllies) {
        const us = token.actor?.system?.details?.alliance;
        const notUs = Object.keys(observingTokenIds).some((id) => {
          const token = canvas.tokens.get(id);
          const them = token.actor?.system?.details?.alliance;
          return them !== us;
        });
        if (!notUs) return;
      }
      const stealth = alertableTokenIds[token.id];
      showAlert({ token, stealth });
    }
  }

  // If GM is in gm vision, we leave things alone. Same goes for controlled
  // tokens, or tokens that are ghosted
  if (game.pf2e.settings.gmVision) return;
  if (token.id in observingTokenIds || token.document.hidden) return;

  // We only adjust visibility of stealthy actors, so bail if we aren't that
  const actor = token?.actor;
  if (!actor) return;
  const stealth = actor?.items.find((i) => i.slug === SLUGS.stealthy);
  if (!stealth) return;

  // Find what the stealthy token thinks it is at vs what the most observant
  // controlled token sees it at
  const baseline = stealth.system?.badge?.value;
  const detectors = stealth.flags[MODULE_ID]?.detectors || {};
  const spottedAt = Object.entries(detectors).reduce(
    (acc, [id, d]) =>
      id in observingTokenIds && d.stealth < acc ? d.stealth : acc,
    baseline,
  );

  // Assuming that the system stomps us everytime, we need to figure out
  // exactly what state we want the token to end up in based on stealth
  // and conditions
  const wantFilter = spottedAt === HIDDEN;
  let wantVisible = !(spottedAt === UNDETECTED && baseline === UNDETECTED);
  const wantGmFilter = !wantVisible && game.user.isGM;
  wantVisible ||= wantGmFilter;
  const gotVisible = token.visible && token.mesh.visible;
  const gotFilter = !!token.detectionFilter;

  // Stomp the token visibility to what we want. If we don't want to see it, we are done
  if (!wantVisible !== !gotVisible) {
    token.visible = wantVisible;
    token.mesh.visible = wantVisible;
    if (!wantVisible) return;
  }

  // Now we need to deal with any changes in filter state since we can see the token. First
  // we'll look at the cases where we don't want a filter; if we don't have a filter, then
  // we are done
  if (!wantFilter && !wantGmFilter) {
    if (!gotFilter) return;

    // We found a filter, we may/may not need to kill it depending
    // debuglog(
    //   `==> '${token.name}' ${STEALTH_LABELS[spottedAt]}/${STEALTH_LABELS[baseline]}, delete filter`,
    //   token.detectionFilter,
    // );
    token.detectionFilter = null;
    return;
  }

  // Now we look at adding a filter. If we already have a filter, we have to evaluate it
  // if (gotFilter) {
  // debuglog(
  //   `==> '${token.name}' ${STEALTH_LABELS[spottedAt]}/${STEALTH_LABELS[baseline]}, replace filter (gm=${wantGmFilter ? 1 : 0})`,
  //   token.detectionFilter,
  // );
  // return if no filter made
  // return;
  // }

  // Make the filter based on being the GM or not
  let filter;
  if (wantGmFilter) {
    filter = foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
      wave: true,
      outlineColor: [0.5, 1.0, 1.0, 1.0],
    });
  } else {
    filter = foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
      wave: true,
    });
    filter.thickness = 1;
  }
  token.detectionFilter = filter;
}

function deleteTokenHook(tokenDoc, _options, _userId) {
  filterMap.delete(tokenDoc);
}

export function setupVisibilityHooks() {
  if (!hooks?.controlToken)
    hooks.controlToken = globalThis.Hooks.on("controlToken", controlTokenHook);
  if (!hooks?.refreshToken)
    hooks.refreshToken = globalThis.Hooks.on("refreshToken", refreshTokenHook);
  if (!hooks?.deleteToken)
    hooks.deleteToken = globalThis.Hooks.on("deleteToken", deleteTokenHook);
}

export function releaseVisibilityHooks() {
  globalThis.Hooks.off("deleteToken", deleteTokenHook);
  globalThis.Hooks.off("refreshToken", refreshTokenHook);
  globalThis.Hooks.off("controlToken", controlTokenHook);
  hooks = {};
}
