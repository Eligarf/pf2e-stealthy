import { MODULE_ID, SLUGS, HIDDEN, UNDETECTED, OBSERVED } from "./const.js";
import { debuglog, warnlog } from "./utils.js";
import { cachedSettings } from "./settings.js";

let hooks = {};
let observingTokenIds = new Set();
let revealedToTokenIds = new Set();
let tokenIdsWithEyeballs = new Set();
let eyeballTexture = null;

hooks.canvasReady = globalThis.Hooks.on("canvasReady", async () => {
  debuglog(`Canvas is ready`);
});

let filterMap = new WeakMap();

globalThis.Hooks.once("ready", async () => {
  debuglog(`appstate is ready`);
  if (cachedSettings.visionHack) setupVisibilityHooks();
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
  revealedToTokenIds.clear();
  for (const token of canvas.tokens.placeables) {
    if (tokenIdsWithEyeballs.has(token.id)) {
      showEyeball({ token, isVisible: false });
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

function findDetectors(token) {
  const detections = findDetections(token);
  if (!detections) return;
  const detectors = Object.entries(detections.detectors)
    .filter(([_, o]) => o.stealth < detections.baselineStealth)
    .map(([id, _]) => id);
  return new Set(detectors);
}

function controlTokenHook(token, controlled) {
  debuglog(`'${token.name}' controlled: ${controlled}`, { token, controlled });
  if (!controlled) {
    observingTokenIds.delete(token.id);
  } else {
    observingTokenIds.add(token.id);
    const tokenDoc = token.document || token;
    if (filterMap.has(tokenDoc)) {
      debuglog(`==> '${token.name}' might need to restore filter`);
      // filterMap.delete(token.document || token);
    }
  }
  if (!game.user.isGM) return;
  canvas.perception.initialize();

  if (controlled) {
    const detectors = findDetectors(token);
    if (detectors) revealedToTokenIds = revealedToTokenIds.union(detectors);
  } else {
    revealedToTokenIds.clear();
    for (const id of observingTokenIds) {
      const token = canvas.tokens.get(id);
      const detectors = findDetectors(token);
      if (detectors) revealedToTokenIds = revealedToTokenIds.union(detectors);
    }
  }
}

function refreshTokenHook(token, options) {
  if (!options.refreshVisibility) return;

  if (game.user.isGM && cachedSettings.showEyeballs) {
    const isRevealed = revealedToTokenIds.has(token.id);
    showEyeball({ token, isVisible: isRevealed });
  }

  if (game.pf2e.settings.gmVision) return;
  if (observingTokenIds.has(token.id) || token.document.hidden) return;

  const actor = token?.actor;
  if (!actor) return;
  const stealth = actor?.items.find((i) => i.slug === SLUGS.stealthy);
  if (!stealth) return;
  const baseline = stealth.system?.badge?.value;
  const detectors = stealth.flags[MODULE_ID]?.detectors || {};
  const spottedAt = Object.entries(detectors).reduce(
    (acc, [id, d]) =>
      observingTokenIds.has(id) && d.stealth < acc ? d.stealth : acc,
    baseline,
  );

  if (spottedAt === OBSERVED && baseline === UNDETECTED) {
    token.visible = true;
    token.mesh.visible = true;
    return;
  }
  if (spottedAt === baseline) {
    if (baseline !== UNDETECTED || !game.user.isGM) {
      const tokenDoc = token.document || token;
      const filter = filterMap.get(tokenDoc);
      if (!filter) return;
      filterMap.delete(tokenDoc);
      // debuglog(`'${token.name}' wants to dump filter`, {
      //   filter,
      //   tokenFilter: token.detectionFilter,
      // });
      if (!token.detectionFilter) token.detectionFilter = filter;
      return;
    }

    token.visible = true;
    token.mesh.visible = true;

    const filter = foundry.canvas.rendering.filters.OutlineOverlayFilter.create(
      {
        wave: true,
        outlineColor: [0.5, 1.0, 1.0, 1.0],
      },
    );
    token.detectionFilter = filter;
  }

  if (spottedAt === HIDDEN) {
    // debuglog(`==> '${token.name}' wants undetected -> hidden`);
    token.visible = true;
    token.mesh.visible = true;

    const filter = foundry.canvas.rendering.filters.OutlineOverlayFilter.create(
      {
        wave: true,
      },
    );
    filter.thickness = 1;
    token.detectionFilter = filter;
  } else if (baseline === HIDDEN) {
    filterMap.set(token.document || token, token.detectionFilter);
    token.detectionFilter = null;
  }
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
