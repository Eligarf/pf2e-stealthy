import { MODULE_ID } from "./const.js";
import { invokeMenu } from "./menu.js";
import {
  setupVisibilityHooks,
  releaseVisibilityHooks,
  refreshVisibilityCache,
} from "./visibility.js";
import { debuglog, refreshPerception } from "./utils.js";

export const SETTINGS = {
  // General settings
  hideFromAllies: "hideFromAllies",
  requireActivity: "requireActivity",
  panZoomToCombat: "panZoomToCombat",
  alerts: "showEyeballs",
  collapseTargetList: "collapseTargetList",
  visionHack: "visionHack",
  keepDeadOut: "keepDeadOut",
  vetCombatStart: "vetCombatStart",
  showInitiative: "showInitiative",
  useToolbeltCover: "useToolbeltCover",

  // Advanced settings
  logLevel: "logLevel",
  schema: "schema",

  // keybindings
  menu: "menu",
};

export let cachedSettings = {
  hideFromAllies: false,
  requireActivity: true,
  panZoomToCombat: true,
  alerts: true,
  collapseTargetList: false,
  visionHack: true,
  keepDeadOut: true,
  vetCombatStart: false,
  showInitiative: true,
  useToolbeltCover: true,
  logLevel: "none",
};

export function setupSettings() {
  game.settings.register(MODULE_ID, SETTINGS.collapseTargetList, {
    name: game.i18n.localize(
      `${MODULE_ID}.${SETTINGS.collapseTargetList}.name`,
    ),
    hint: game.i18n.localize(
      `${MODULE_ID}.${SETTINGS.collapseTargetList}.hint`,
    ),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.collapseTargetList,
    onChange: (newValue) => {
      cachedSettings.collapseTargetList = newValue;
    },
  });
  cachedSettings.collapseTargetList = game.settings.get(
    MODULE_ID,
    SETTINGS.collapseTargetList,
  );

  game.settings.register(MODULE_ID, SETTINGS.showInitiative, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.showInitiative}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.showInitiative}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.showInitiative,
    onChange: (newValue) => {
      cachedSettings.showInitiative = newValue;
    },
  });
  cachedSettings.showInitiative = game.settings.get(
    MODULE_ID,
    SETTINGS.showInitiative,
  );

  game.settings.register(MODULE_ID, SETTINGS.panZoomToCombat, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.panZoomToCombat}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.panZoomToCombat}.hint`),
    scope: "client",
    config: true,
    type: Boolean,
    default: cachedSettings.panZoomToCombat,
    onChange: (newValue) => {
      cachedSettings.panZoomToCombat = newValue;
    },
  });
  cachedSettings.panZoomToCombat = game.settings.get(
    MODULE_ID,
    SETTINGS.panZoomToCombat,
  );

  game.settings.register(MODULE_ID, SETTINGS.keepDeadOut, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.keepDeadOut}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.keepDeadOut}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.keepDeadOut,
    onChange: (newValue) => {
      cachedSettings.keepDeadOut = newValue;
    },
  });
  cachedSettings.keepDeadOut = game.settings.get(
    MODULE_ID,
    SETTINGS.keepDeadOut,
  );

  game.settings.register(MODULE_ID, SETTINGS.vetCombatStart, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.vetCombatStart}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.vetCombatStart}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.vetCombatStart,
    onChange: (newValue) => {
      cachedSettings.vetCombatStart = newValue;
    },
  });
  cachedSettings.vetCombatStart = game.settings.get(
    MODULE_ID,
    SETTINGS.vetCombatStart,
  );

  game.settings.register(MODULE_ID, SETTINGS.hideFromAllies, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.hideFromAllies}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.hideFromAllies}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.hideFromAllies,
    onChange: (newValue) => {
      cachedSettings.hideFromAllies = newValue;
    },
  });
  cachedSettings.hideFromAllies = game.settings.get(
    MODULE_ID,
    SETTINGS.hideFromAllies,
  );

  game.settings.register(MODULE_ID, SETTINGS.requireActivity, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.requireActivity}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.requireActivity}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.requireActivity,
    onChange: (newValue) => {
      cachedSettings.requireActivity = newValue;
    },
  });
  cachedSettings.requireActivity = game.settings.get(
    MODULE_ID,
    SETTINGS.requireActivity,
  );

  function updateToolbeltApi() {
    if (cachedSettings.useToolbeltCover) {
      const toolbeltApi = game.toolbelt?.api;
      if (toolbeltApi) {
        const wallCoverApi = toolbeltApi.autoCover?.calculateWallCover;
        if (typeof wallCoverApi === "function")
          cachedSettings.wallCoverApi = wallCoverApi;
        const creatureCoverApi = toolbeltApi.autoCover?.testCreaturesCover;
        if (typeof creatureCoverApi === "function") {
          cachedSettings.creatureCoverApi = creatureCoverApi;
        }
      }
    } else {
      delete cachedSettings.wallCoverApi;
      delete cachedSettings.creatureCoverApi;
    }
    debuglog("updated cachedSettings", cachedSettings);
  }

  game.settings.register(MODULE_ID, SETTINGS.useToolbeltCover, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useToolbeltCover}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.useToolbeltCover}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.useToolbeltCover,
    onChange: (newValue) => {
      cachedSettings.useToolbeltCover = newValue;
      updateToolbeltApi();
    },
  });
  cachedSettings.useToolbeltCover = game.settings.get(
    MODULE_ID,
    SETTINGS.useToolbeltCover,
  );

  game.settings.register(MODULE_ID, SETTINGS.alerts, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.alerts}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.alerts}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.alerts,
    onChange: (newValue) => {
      cachedSettings.alerts = newValue;
      refreshVisibilityCache();
      refreshPerception();
    },
  });
  cachedSettings.alerts = game.settings.get(MODULE_ID, SETTINGS.alerts);

  game.settings.register(MODULE_ID, SETTINGS.visionHack, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.visionHack}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.visionHack}.hint`),
    scope: "world",
    config: true,
    type: Boolean,
    default: cachedSettings.visionHack,
    onChange: (newValue) => {
      cachedSettings.visionHack = newValue;
      if (newValue) {
        setupVisibilityHooks();
      } else {
        releaseVisibilityHooks();
      }
      refreshVisibilityCache();
      refreshPerception();
    },
  });
  cachedSettings.visionHack = game.settings.get(MODULE_ID, SETTINGS.visionHack);

  game.settings.register(MODULE_ID, SETTINGS.logLevel, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.logLevel}.name`),
    scope: "client",
    config: true,
    type: String,
    choices: {
      none: game.i18n.localize(`${MODULE_ID}.${SETTINGS.logLevel}.none`),
      debug: game.i18n.localize(`${MODULE_ID}.${SETTINGS.logLevel}.debug`),
      log: game.i18n.localize(`${MODULE_ID}.${SETTINGS.logLevel}.log`),
    },
    default: cachedSettings.logLevel,
    onChange: (newValue) => {
      cachedSettings.logLevel = newValue;
    },
  });
  cachedSettings.logLevel = game.settings.get(MODULE_ID, SETTINGS.logLevel);

  // Update after all settings are read
  updateToolbeltApi();
}

export function setupKeybindings() {
  game.keybindings.register(MODULE_ID, SETTINGS.menu, {
    name: `${MODULE_ID}.${SETTINGS.menu}.bindings.name`,
    hint: `${MODULE_ID}.${SETTINGS.menu}.bindings.hint`,
    editable: [{ key: "Equal", modifiers: [] }],
    onDown: async (event) => {
      if (game.user.isGM) return invokeMenu(event);
    },
  });
}

const SETTING_GROUPS = [
  { label: "initiative", before: SETTINGS.collapseTargetList },
  { label: "stealth", before: SETTINGS.hideFromAllies },
  { label: "vision", before: SETTINGS.alerts },
  { label: "debug", before: SETTINGS.logLevel },
];

globalThis.Hooks.on("renderSettingsConfig", (_app, html, _data) => {
  const container = html instanceof HTMLElement ? html : html[0];
  if (!container) return;

  // // In v14, html can be a raw HTMLElement or a jQuery object depending on context,
  // // but if it's passed as a native HTMLElement (or you extract it via html[0]),
  // // you can use standard querySelector/createElement.
  //
  // for (const section of SETTING_GROUPS) {
  //   // 1. Create the element using vanilla DOM
  //   const div = document.createElement("div");
  //   div.className = "form-group group-header";
  //   div.innerHTML = game.i18n.localize(`${MODULE_ID}.config.${section.label}`);
  //
  //   // 2. Find the target input/element and its parent form-group
  //   const targetInput = container.querySelector(`[name="${MODULE_ID}.${section.before}"]`);
  //   const formGroup = targetInput?.closest("div.form-group");
  //
  //   // 3. Insert the new header before the target form-group
  //   if (formGroup && formGroup.parentNode) {
  //     formGroup.parentNode.insertBefore(div, formGroup);
  //   }
  // }

  for (const section of SETTING_GROUPS) {
    $("<div>")
      .addClass("form-group group-header")
      .html(game.i18n.localize(`${MODULE_ID}.config.${section.label}`))
      .insertBefore(
        $(`[name="${MODULE_ID}.${section.before}"]`).parents(
          "div.form-group:first",
        ),
      );
  }
});
