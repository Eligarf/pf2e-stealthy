const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { MODULE_ID } from "./const.js";
import { fillNoTokensMenu } from "./no-tokens-menu.js";
import { fillTokensMenu } from "./tokens-menu.js";
import { fillConnectedTokensMenu } from "./connected-tokens-menu.js";
import { debuglog, localizeString } from "./utils.js";
import { refreshEverybody } from "./socket.js";

export class AvoidNoticePopupMenu extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  constructor(options = {}) {
    super(options);
    this.coordinates = { x: options.x ?? 0, y: options.y ?? 0 };
    this.options.window.title = options.title;
    this._resolve = null;
    this._onPointerDown = this._onPointerDown.bind(this);
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-popup-menu`,
    tag: "form",
    actions: {
      popupClick: AvoidNoticePopupMenu.popupClick,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/popup-menu.hbs`,
    },
  };

  async _prepareContext() {
    const context = await super._prepareContext();
    context.options = this.options;
    return context;
  }

  _onClose() {
    document.removeEventListener("pointerdown", this._onPointerDown, {
      capture: true,
    });
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const choices = this.element.querySelectorAll(".popup-menu [data-key]");
    choices.forEach((element) => {
      const key = element.dataset.key;
      const choice = this.options.choices.find((c) => c.key === key);
      if (choice.disabled) {
        element.classList.add("disabled");
        element.style.pointerEvents = "none";
        element.style.opacity = "0.5";
        element.removeAttribute("href");
        element.setAttribute("aria-disabled", "true");
        element.tabIndex = -1; // Removes it from keyboard tab-navigation order;
      }
    });

    requestAnimationFrame(() => {
      if (!this.element) return;
      this.element.style.position = "fixed";
      this.element.style.top = `${this.coordinates.y}px`;
      this.element.style.left = `${this.coordinates.x}px`;
      this.element.style.bottom = "auto";
      this.element.style.right = "auto";
      this.element.style.zIndex = "10000";
    });

    document.addEventListener("pointerdown", this._onPointerDown, {
      capture: true,
    });
  }

  _onPointerDown(event) {
    const path = event.composedPath?.() || event.path || [];
    if (!path.includes(this.element)) {
      this.close();
    }
  }

  static popupClick(event, target) {
    const key = target.getAttribute("data-key");
    if (this._resolve) {
      this._resolve({ key, secret: event.ctrlKey });
      this._resolve = null;
    }
    this.close();
  }

  static async show(
    title = "Choose an option",
    globalPosition,
    choices = null,
  ) {
    return new Promise((resolve) => {
      const app = new AvoidNoticePopupMenu({
        title,
        choices,
        x: globalPosition.x,
        y: globalPosition.y,
      });
      app._resolve = resolve;
      app.render(true);
    });
  }
}

function summarizeDispositions(tokens) {
  const dispositions = tokens.map((t) => t.document.disposition);
  const uniqueDispositions = new Set(dispositions);
  return uniqueDispositions;
}

export async function invokeMenu(event) {
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
  const selected = await AvoidNoticePopupMenu.show(
    config.title,
    position,
    config.choices,
  );

  if (!selected) return true;
  const choice = config.choices.find((c) => c.key === selected.key);
  debuglog(`${config.title} choice`, choice);
  if (!choice) return true;
  await choice.onClick();
  if (choice.refresh) refreshEverybody();

  return true;
}
