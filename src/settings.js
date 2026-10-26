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
    config: false,
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
