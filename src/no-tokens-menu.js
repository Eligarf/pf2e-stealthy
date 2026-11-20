import { debuglog } from "./utils.js";
import { clearAllStealth } from "./stealth.js";
import { MODULE_ID } from "./const.js";
import { refreshEverybody } from "./socket.js";
import { declumpInitiative } from "./initiative.js";

export function fillNoTokensMenu() {
  let choices = [
    {
      key: "remove-all-stealth",
      label: game.i18n.localize(`${MODULE_ID}.menu.clearAllStealth.label`),
      hint: `${MODULE_ID}.menu.clearAllStealth.hint`,
      onClick: async () => {
        return clearAllStealth();
      },
    },
    {
      key: "refresh",
      label: game.i18n.localize(`${MODULE_ID}.menu.refresh.label`),
      hint: `${MODULE_ID}.menu.refresh.hint`,
      onClick: () => {
        return refreshEverybody();
      },
    },
  ];

  const combat = game.combats.active;
  const turns = combat?.turns ?? [];
  choices.push({
    key: "declump",
    label: game.i18n.localize(
      `${MODULE_ID}.menu.declump.${!turns.length ? "disabledLabel" : "label"}`,
    ),
    hint: `${MODULE_ID}.menu.declump.hint`,
    disabled: !turns.length,
    onClick: declumpInitiative,
  });

  choices.sort((a, b) => a.label.localeCompare(b.label));
  return { title: "`${MODULE_ID}.menu.noTokensSelected`", choices };
}
