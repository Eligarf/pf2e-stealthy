import { MODULE_ID } from "./const.js";
import { fillNoTokensMenu } from "./no-tokens-menu.js";
import { fillTokensMenu } from "./tokens-menu.js";
import { fillConnectedTokensMenu } from "./connected-tokens-menu.js";
import { debuglog, localizeString } from "./utils.js";

function getChoices() {
  if (!canvas?.ready) return true;

  const controlledTokens = canvas.tokens.controlled;
  let controlled = null;
  if (controlledTokens.length !== 0) {
    controlled = {
      type: "controlled",
      tokens: controlledTokens,
      dispositions: summarizeDispositions(controlledTokens),
    };
  }

  const targetedTokens = Array.from(game.user.targets).map(
    (t) => canvas.tokens.get(t.id) || t,
  );
  let targeted = null;
  if (targetedTokens.length !== 0) {
    targeted = {
      type: "targeted",
      tokens: targetedTokens,
      dispositions: summarizeDispositions(targetedTokens),
    };
  }

  // Three basic scenarios to pick between here. If no tokens are selected, then we
  // are doing some full-scene operation.
  let config;
  if (!controlled && !targeted) {
    config = fillNoTokensMenu();
  }

  // If we have both types, then we will be doing connected operations
  else if (controlled && targeted) {
    config = fillConnectedTokensMenu({
      controlled,
      targeted,
    });
  }

  // Otherwise, no need to distiguish between selected and targeted, we can just use whichever one is present.
  else {
    const selection = controlled || targeted;
    config = fillTokensMenu({ selection });
  }

  return config;
}

const MENU_ID = `${MODULE_ID}-context-menu`;
const MENU_ITEM = `${MODULE_ID}-menu-item`;

class StealthyContextMenu {
  static show(x, y, choices) {
    // Clean up any existing menu
    document.getElementById(MENU_ID)?.remove();

    const menu = document.createElement("div");
    menu.id = MENU_ID;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // 3. Build the list container
    let content = `<ul>`;

    choices.forEach((choice, index) => {
      if (choice.isDivider) {
        content += `<li class="context-divider"></li>`;
      } else {
        const disabledClass = choice.disabled ? "disabled" : "";
        const localizedLabel = game.i18n.localize(choice.label);
        const hintAttr = choice.hint
          ? `data-tooltip="${game.i18n.localize(choice.hint)}"`
          : "";

        content += `
          <li class="${MENU_ITEM} ${disabledClass}" data-index="${index}" ${hintAttr}>
              <i class="fa-solid fa-angle-right"></i>
              <span>${localizedLabel}</span>
          </li>`;
      }
    });
    content += `</ul>`;
    menu.innerHTML = content;

    menu.querySelectorAll(`.${MENU_ITEM}:not(.disabled)`).forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = item.getAttribute("data-index");
        menu.remove();
        choices[index].onClick();
      });
    });

    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("pointerdown", closeHandler, true);
        document.removeEventListener("keydown", keyHandler, true);
      }
    };
    const keyHandler = (e) => {
      if (e.key === "Escape") {
        menu.remove();
        document.removeEventListener("pointerdown", closeHandler, true);
        document.removeEventListener("keydown", keyHandler, true);
      }
    };

    document.addEventListener("pointerdown", closeHandler, true);
    document.addEventListener("keydown", keyHandler, true);

    document.body.appendChild(menu);
  }
}

function summarizeDispositions(tokens) {
  const dispositions = tokens.map((t) => t.document.disposition);
  const uniqueDispositions = new Set(dispositions);
  return uniqueDispositions;
}

export async function invokeMenu(_event) {
  const config = getChoices();
  if (!config) {
    ui.notifications.info(
      localizeString(`${MODULE_ID}.notifications.noToDos`, {
        controlled: `${controlledTokens.length}`,
        targeted: `${targetedTokens.length}`,
      }),
    );
    return true;
  }

  const mouseCanvasCoords = game.canvas.mousePosition;
  if (!mouseCanvasCoords) return true;
  const position = canvas.clientCoordinatesFromCanvas(mouseCanvasCoords);
  StealthyContextMenu.show(position.x, position.y, config.choices);

  return true;
}
