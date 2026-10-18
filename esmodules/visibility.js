import { MODULE_ID, SLUGS, UNDETECTED } from "./const.js";
import { debuglog, warnlog } from "./utils.js";
import { createVisibilityCache } from "./cache.js";
import { cachedSettings } from "./settings.js";

let hooks = {};
let observingTokenIds = new Set();
let revealedToTokenIds = new Set();
let gmVisionCopy = undefined;
let tokenIdsWithEyeballs = new Set();
const cache = createVisibilityCache();
let eyeballTexture = null;

hooks.canvasReady = globalThis.Hooks.on("canvasReady", async () => {
  debuglog(`Canvas is ready`);
});

globalThis.Hooks.once("ready", async () => {
  debuglog(`appstate is ready`);
  if (cachedSettings.visionHack) setupVisibilityHooks();
  gmVisionCopy = game.pf2e.settings.gmVision;
  for (const token of canvas.tokens.controlled) {
    controlTokenHook(token, true);
  }

  // SVG data from fa-eye turned into texture here
  const color = "#dfdf00";
  const data =
    "M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.4 78.1-95.4 92.9-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.8-35.7-46.1-87.7-92.9-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.4c13.5 46.5 56.5 80.7 106.8 80.7c61.9 0 112-50.1 112-112c0-50.3-34.2-93.3-80.7-106.8c-6.6-1.9-13.5-2.9-20.4-3.2c-5.8-.2-9.2 6.2-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z";

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="256" height="256">
      <path fill="${color}" d="${data}"/>
    </svg>`.trim();
  const encodedIconTexture = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  eyeballTexture = PIXI.Texture.from(encodedIconTexture);
});

export function refreshVisibilityCache() {
  debuglog(`refreshVisibilityCache`);
  cache.clear(handleMutations);
  revealedToTokenIds.clear();
  for (const token of canvas.tokens.placeables) {
    if (tokenIdsWithEyeballs.has(token.id)) {
      showEyeball({ token, isVisible: false });
    }
  }
}

function findObservations(token) {
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

function applyMutation(token, mutation) {
  // debuglog(
  //   `token.visible=${token.visible} mesh.visible=${token?.mesh?.visible} detectionFilter=${token.detectionFilter ? "exists" : "null"}`,
  // );
  token.visible = true;
  if (!token.mesh) {
    warnlog(`Token '${token.name}' has no mesh. This may cause visual issues.`);
  } else {
    token.mesh.visible = true;
  }
  if (!token.detectionFilter) {
    token.detectionFilter = mutation.filter;
  } else if (token.detectionFilter !== mutation.filter) {
    warnlog(
      `Token '${token.name}' already has a detection filter. This may cause visual issues.`,
      {
        tokenFilter: token.detectionFilter,
        undetectedFilter: mutation.filter,
      },
    );
  }
}

function handleMutations(token, record, mutations) {
  // debuglog("handleMutations", { token, record, mutations });
  // First remove things
  for (let i = 0; i < mutations?.removes?.length; i++) {
    const type = mutations.removes[i];
    switch (type) {
      case "hidden":
        token.detectionFilter = record.mutations.hidden.filter;
        delete record.mutations.hidden;
        break;
      case "undetected":
      case "gmVision":
        token.visible = false;
        if (!token.mesh) {
          warnlog(
            `Token '${token.name}' has no mesh. This may cause visual issues.`,
          );
        } else {
          token.mesh.visible = false;
        }
        if (
          token.detectionFilter &&
          token.detectionFilter !== record.mutations[type].filter
        ) {
          warnlog(
            `Token '${token.name}' has a different detection filter than expected. This may cause visual issues.`,
            {
              tokenFilter: token.detectionFilter,
              mutationFilter: record.mutations[type].filter,
            },
          );
        } else token.detectionFilter = null;
        record.mutations[type].filter = null;
        delete record.mutations[type];
        break;
    }
  }

  // Then add things
  for (let i = 0; i < mutations?.adds?.length; i++) {
    const type = mutations.adds[i];
    switch (type) {
      // Hidden things are just visible with no filter
      case "hidden":
        record.mutations.hidden = { filter: token.detectionFilter };
        token.detectionFilter = null;
        break;

      // Undetected things look like hidden things
      case "undetected": {
        const filter =
          foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
            wave: true,
          });

        // Thickness is set afterwards because weird 2-d array stuff in uniforms
        filter.thickness = 1;
        record.mutations.undetected = { filter };
        applyMutation(token, record.mutations.undetected);
        break;
      }

      // gmVision should use a differently colored hidden
      case "gmVision": {
        const filter =
          foundry.canvas.rendering.filters.OutlineOverlayFilter.create({
            wave: true,
            outlineColor: [0.5, 1.0, 1.0, 1.0],
          });
        record.mutations.gmVision = { filter };
        applyMutation(token, record.mutations.gmVision);
        break;
      }
    }
  }
}

function recordObservation(token, visibility, override) {
  const record = cache.getOrCreate(token);
  const snapshot = cache.duplicate(record.snapshot);
  if (!(visibility in snapshot)) snapshot[visibility] = { except: new Set() };
  const state = snapshot[visibility];
  if (override) {
    const observers = new Set(override.except);
    const detectors = observers.intersection(observingTokenIds);
    state.except = state.except.union(detectors);
  }
  state.never = !override;
  const mutations = cache.update(record, snapshot);
  if (!mutations) return;
  handleMutations(token, record, mutations);
}

function showEyeball({ token, isVisible }) {
  const spriteName = "observing-eyeball";
  let eyeSprite = token.mesh.children.find((c) => c.name === spriteName);
  if (isVisible) {
    if (eyeSprite) return;
    eyeSprite = new PIXI.Sprite(eyeballTexture);
    eyeSprite.name = spriteName;
    eyeSprite.anchor.set(0.5, 0.5);
    eyeSprite.x = 0;
    eyeSprite.y = 0;
    token.mesh.addChild(eyeSprite);
    tokenIdsWithEyeballs.add(token.id);
    return;
  }
  if (eyeSprite) {
    tokenIdsWithEyeballs.delete(token.id);
    token.removeChild(eyeSprite);
    eyeSprite.destroy({ children: true, texture: false });
  }
}

function findObservers(token) {
  const observations = findObservations(token);
  if (!observations) return;
  const detectors = Object.entries(observations.detectors)
    .filter(([_, o]) => o.stealth < observations.baselineStealth)
    .map(([id, _]) => id);
  return new Set(detectors);
}

function controlTokenHook(token, controlled) {
  debuglog(`'${token.name}' controlled: ${controlled}`, { token, controlled });
  if (!controlled) {
    observingTokenIds.delete(token.id);
    cache.removeObserver(token, handleMutations);
  } else {
    observingTokenIds.add(token.id);
    if (cache.has(token)) {
      cache.removeAvoider(token, handleMutations);
    }
  }
  if (!game.user.isGM) return;

  if (controlled) {
    const observers = findObservers(token);
    if (observers) revealedToTokenIds = revealedToTokenIds.union(observers);
  } else {
    revealedToTokenIds.clear();
    for (const id of observingTokenIds) {
      const token = canvas.tokens.get(id);
      const observers = findObservers(token);
      if (observers) revealedToTokenIds = revealedToTokenIds.union(observers);
    }
  }
}

function refreshTokenHook(token, _options) {
  // debuglog(
  //   `'${token.name}' refreshed (hidden=${token.document.hidden} visible=${token.visible} filter=${token.detectionFilter ? "exists" : "null"})`,
  //   {
  //     token,
  //     observingTokenIds,
  //   },
  // );
  if (game.user.isGM && cachedSettings.showEyeballs) {
    const isRevealed = revealedToTokenIds.has(token.id);
    showEyeball({ token, isVisible: isRevealed });
  }

  if (game.pf2e.settings.gmVision) {
    if (gmVisionCopy) return;
    gmVisionCopy = true;
    cache.clear(handleMutations);
    return;
  }
  gmVisionCopy = false;

  if (observingTokenIds.has(token.id) || token.document.hidden) {
    if (cache.has(token)) cache.removeAvoider(token, handleMutations);
    return;
  }

  const actor = token?.actor;
  if (!actor) return;
  const stealth = actor?.items.find((i) => i.slug === SLUGS.stealthy);
  if (!stealth) return;
  const states = stealth.flags[MODULE_ID];
  let spotted = false;
  for (const [visibility, state] of Object.entries(states)) {
    if (state.except?.some((id) => observingTokenIds.has(id))) {
      spotted = true;
      recordObservation(token, visibility, state);
    }
  }
  // if (
  //   game.user.isGM &&
  //   !spotted &&
  //   stealth.system?.badge?.value === UNDETECTED
  // ) {
  //   recordObservation(token, "gmVision", null);
  // }

  // our mutations get zotted out every time, so we need to restore them here
  const record = cache.get(token);
  if (!record) return;
  const undetected = record?.mutations?.undetected;
  if (undetected) return applyMutation(token, undetected);
  const hidden = record?.mutations?.hidden;
  if (hidden) {
    token.detectionFilter = null;
    return;
  }
  const gmVision = record?.mutations?.gmVision;
  if (gmVision) return applyMutation(token, gmVision);
}

// function createItemHook(item, options, userId) {
//   if (item?.system?.slug !== SLUGS.stealthy) return;
//   const actor = options.parent;
//   debuglog(`'${actor?.name}' stealth effect created`, {
//     item,
//     options,
//     userId,
//   });
// }

// function deleteItemHook(item, options, userId) {
//   if (item?.system?.slug !== SLUGS.stealthy) return;
//   debuglog(`stealth effect deleted`, {
//     item,
//     options,
//     userId,
//   });
// }

// function createTokenHook(tokenDoc, data, options, userId) {
//   debuglog(`'${tokenDoc.name}' created`, { tokenDoc, data, options, userId });
// }

// function updateTokenHook(tokenDoc, data, options, userId) {
//   debuglog(`'${tokenDoc.name}' updated`, { tokenDoc, data, options, userId });
// }

function deleteTokenHook(tokenDoc, _options, _userId) {
  // debuglog(`'${tokenDoc.name}' deleted`, { tokenDoc, _options, _userId });
  const stealth = tokenDoc?.actor?.items.find((i) => i.slug === SLUGS.stealthy);
  if (!stealth) return;
  cache.removeAvoider(tokenDoc, handleMutations);
}

export function setupVisibilityHooks() {
  if (!hooks?.controlToken)
    hooks.controlToken = globalThis.Hooks.on("controlToken", controlTokenHook);
  if (!hooks?.refreshToken)
    hooks.refreshToken = globalThis.Hooks.on("refreshToken", refreshTokenHook);
  if (!hooks?.deleteToken)
    hooks.deleteToken = globalThis.Hooks.on("deleteToken", deleteTokenHook);
  // if (!hooks?.createItem)
  //   hooks.createItem = globalThis.Hooks.on("createItem", createItemHook);
  // if (!hooks?.deleteItem)
  //   hooks.deleteItem = globalThis.Hooks.on("deleteItem", deleteItemHook);
  // if (!hooks?.updateToken)
  //   hooks.updateToken = globalThis.Hooks.on("updateToken", updateTokenHook);
  // if (!hooks?.createToken)
  //   hooks.createToken = globalThis.Hooks.on("createToken", createTokenHook);
}

export function releaseVisibilityHooks() {
  globalThis.Hooks.off("deleteToken", deleteTokenHook);
  globalThis.Hooks.off("refreshToken", refreshTokenHook);
  globalThis.Hooks.off("controlToken", controlTokenHook);
  // globalThis.Hooks.off("createToken", createTokenHook);
  // globalThis.Hooks.off("updateToken", updateTokenHook);
  // globalThis.Hooks.off("deleteItem", deleteItemHook);
  // globalThis.Hooks.off("createItem", createItemHook);
  hooks = {};
}
