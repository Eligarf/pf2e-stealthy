import { MODULE_ID, LOCALIZATION_KEYS, DOS_CARD_KEYS } from "./const.js";
import { debuglog, localizeString, getToken } from "./utils.js";
import { LineTicker } from "./line-ticker.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export const explorationCheckDialogId = `${MODULE_ID}-exploration-check-dialog`;

function makeMissingActorsString() {
  const clownCar = localizeString("PF2E.Actor.Party.ClownCar.Deposit");
  const createEncounter = localizeString(
    `${MODULE_ID}.explorationCheckDialog.createEncounter`,
  );
  return localizeString(`${MODULE_ID}.explorationCheckDialog.missingActors`, {
    clownCar,
    createEncounter,
  });
}

export class ExplorationCheckDialog extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  constructor(message, callback, options = {}) {
    super(options);
    this.messageId = message.id;
    this.callback = callback;
    this.hoverKey = null;
  }

  static DEFAULT_OPTIONS = {
    id: explorationCheckDialogId,
    tag: "div",
    window: {
      title: `${MODULE_ID}.explorationCheckDialog.title`,
      icon: "fa-solid fa-user-secret",
      resizable: true,
      modal: true,
    },
    position: {
      width: 550,
      height: "auto",
    },
    actions: {
      confirm: ExplorationCheckDialog._onConfirm,
      cancel: ExplorationCheckDialog._onCancel,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/exploration-check-dialog.hbs`,
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/dialog-footer.hbs`,
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.moduleId = MODULE_ID;
    context.cancelLabel = `${MODULE_ID}.explorationCheckDialog.cancel`;
    context.confirmLabel = `${MODULE_ID}.explorationCheckDialog.confirm`;
    const message = game.messages.get(this.messageId);
    if (!message) {
      debuglog("Couldn't find message", this.messageId);
      await this.close();
      return;
    }
    const explorationCheck = message.flags[MODULE_ID]?.explorationCheck;
    if (!explorationCheck) {
      debuglog("Couldn't find explorationCheck", message);
      await this.close();
      return;
    }
    debuglog("_prepareContext", explorationCheck);
    context.confirmDisabled = Object.values(
      explorationCheck.friendlyStealth,
    ).some((v) => v.skillResult === null);

    function walkAvoiders(object) {
      return Object.entries(object).map(([id, avoider]) => {
        const token = getToken(id);
        const alliance = token?.actor?.alliance ?? "none";
        const observers = Object.fromEntries(
          (avoider.targetList ?? []).map((t) => {
            const entry = {
              name: t.name,
              dos: DOS_CARD_KEYS[t.degreeOfSuccess],
              label: LOCALIZATION_KEYS[t.stealthLabel],
              dc: localizeString(`${MODULE_ID}.dc`, { dc: t.dc }),
            };
            return [t.tokenId, entry];
          }),
        );

        return [
          id,
          {
            name: avoider.name,
            skillResult: avoider.skillResult,
            alliance,
            label: `${MODULE_ID}.explorationCheckDialog.stealthResult`,
            observers,
          },
        ];
      });
    }

    context.avoiders = {};
    if (explorationCheck.noticableEnemies.length > 0) {
      context.avoiders.noticableEnemies = {
        noticable: true,
        alliance: "opposition",
        name: game.i18n.localize(
          `${MODULE_ID}.explorationCheckDialog.noticableEnemies`,
        ),
        noticables: explorationCheck.noticableEnemies.map((n) => ({
          name: n.name,
        })),
      };
    }
    if (explorationCheck.noticableFriendlies.length > 0) {
      context.avoiders.noticableFriendlies = {
        noticable: true,
        alliance: "party",
        name: game.i18n.localize(
          `${MODULE_ID}.explorationCheckDialog.noticableFriendlies`,
        ),
        noticables: explorationCheck.noticableFriendlies.map((n) => ({
          name: n.name,
        })),
      };
    }
    context.avoiders = {
      ...context.avoiders,
      ...Object.fromEntries(walkAvoiders(explorationCheck.enemyStealth)),
      ...Object.fromEntries(walkAvoiders(explorationCheck.friendlyStealth)),
    };
    return context;
  }

  _clearLineTicker() {
    if (this.activeLineTicker) {
      this.activeLineTicker.destroy();
      this.activeLineTicker = null;
    }

    if (this.hoverKey) {
      this.hoverKey = null;
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const content = this.element.querySelector(
      `.${MODULE_ID}-exploration-check-dialog`,
    );
    const footer = this.element.querySelector(`.${MODULE_ID}-dialog-footer`);
    if (content && footer) {
      const parent = content.parentElement;
      if (parent) {
        parent.style.display = "flex";
        parent.style.flexDirection = "column";
        parent.style.height = "100%";
      }
      content.style.flex = "1";
      content.style.overflowY = "auto";
      content.style.minHeight = "0";
      footer.style.flexShrink = "0";
    }

    this._clearLineTicker();

    const targets = this.element.querySelectorAll(`.${MODULE_ID}-target`);
    targets.forEach((target) => {
      const dataSet = target.dataset;
      const avoiderId = dataSet.avoider;
      const observerId = dataSet.observer;
      target.addEventListener("pointerenter", () => {
        this._onTargetHoverIn(avoiderId, observerId);
      });
      target.addEventListener("pointerleave", () => {
        this._onTargetHoverOut(avoiderId, observerId);
      });
    });
  }

  _onTargetHoverIn(avoiderId, observerId) {
    const hoverKey = `${MODULE_ID}-${avoiderId}-${observerId}`;
    if (this.hoverKey === hoverKey) return;
    if (avoiderId === undefined || observerId === undefined) return;

    this._clearLineTicker();
    this.hoverKey = hoverKey;

    const avoider = getToken(avoiderId);
    const observer = getToken(observerId);

    this.activeLineTicker = new LineTicker(avoider, observer);
  }

  _onTargetHoverOut(avoiderId, observerId) {
    const hoverKey = `${MODULE_ID}-${avoiderId}-${observerId}`;
    if (this.hoverKey !== hoverKey) return;
    this._clearLineTicker();
  }

  async _updatePendingMessage(status) {
    const message = game.messages.get(this.messageId);
    if (message) {
      const oldStatus =
        message.flags[MODULE_ID]?.explorationCheck?.status ?? "none";
      if (oldStatus === "pending") {
        await message.update({
          flags: { [MODULE_ID]: { explorationCheck: { status } } },
        });
        return message;
      }
    }
    return null;
  }

  static async _onConfirm(_event, _target) {
    let message = game.messages.get(this.messageId);
    if (!message) return;
    const explorationCheck = message.flags[MODULE_ID]?.explorationCheck;
    if (!explorationCheck) return;

    const missing = explorationCheck.friendlyIds.filter((id) => !getToken(id));
    if (missing.length > 0) {
      ui.notifications.warn(makeMissingActorsString());
      return;
    }

    message = await this._updatePendingMessage("complete");
    await this.callback(message);
    await this.close();
  }

  static async _onCancel(_event, _target) {
    await this._updatePendingMessage("cancelled");
    await this.callback(null);
    await this.close();
  }
}
