import { MODULE_ID } from "./const.js";
import { SETTINGS, setupSettings, setupKeybindings } from "./settings.js";
import { cachedSettings } from "./settings.js";
import { log } from "./utils.js";

import "./combat.js";
import "./action.js";
import "./render-card.js";

globalThis.Hooks.once("init", () => {
  setupKeybindings();
});

function migrate(moduleVersion, oldVersion) {
  if (oldVersion !== moduleVersion) {
    // ui.notifications.info(
    //   `Updated ${MODULE_ID} data from ${oldVersion} to ${moduleVersion}`,
    // );
  }
  return moduleVersion;
}

globalThis.Hooks.once("ready", () => {
  // Handle perceptive or perception module getting yoinked
  if (
    cachedSettings.panZoomToCombat &&
    typeof window?.socketlib === "undefined"
  ) {
    ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.notifications.noSocketLib`),
    );
  }
  if (game.modules.get("pf2e-avoid-notice")?.active ?? false) {
    ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.notifications.avoidNotice`),
    );
  }
});

globalThis.Hooks.once("setup", () => {
  const module = game.modules.get(MODULE_ID);
  const moduleVersion = module.version;

  setupSettings();

  game.settings.register(MODULE_ID, SETTINGS.schema, {
    name: game.i18n.localize(`${MODULE_ID}.${SETTINGS.schema}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${SETTINGS.schema}.hint`),
    scope: "world",
    config: true,
    type: String,
    default: `${moduleVersion}`,
    onChange: (value) => {
      const newValue = migrate(moduleVersion, value);
      if (value != newValue) {
        game.settings.set(MODULE_ID, SETTINGS.schema, newValue);
      }
    },
  });

  const schemaVersion = game.settings.get(MODULE_ID, SETTINGS.schema);
  if (schemaVersion !== moduleVersion) {
    globalThis.Hooks.once("ready", () => {
      game.settings.set(
        MODULE_ID,
        SETTINGS.schema,
        migrate(moduleVersion, schemaVersion),
      );
    });
  }

  log(`Setup ${moduleVersion}`);
});
