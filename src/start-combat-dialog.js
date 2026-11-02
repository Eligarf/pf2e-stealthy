import { MODULE_ID, LOCALIZATION_KEYS, STEALTH_LABELS } from "./const.js";
import { debuglog, localizeString, getToken } from "./utils.js";
import { sneakDosStates } from "./sneak.js";

const DOS_KEYS = [
  `${MODULE_ID}-card-critical-failure`,
  `${MODULE_ID}-card-failure`,
  `${MODULE_ID}-card-success`,
  `${MODULE_ID}-card-critical-success`,
];

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class StartCombatDialog extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  constructor(data, options = {}) {
    super(options);
    this.dialogData = data;
    this.result = null;
    this.hoverKey = null;
  }

  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-start-combat-dialog`,
    tag: "div",
    window: {
      title: `${MODULE_ID}.startCombat.title`,
      icon: "fa-solid fa-user-secret",
      resizable: true,
      modal: true,
    },
    position: {
      width: 550,
      height: "auto",
    },
    actions: {
      cycleStatus: StartCombatDialog._onCycleStatus,
      confirm: StartCombatDialog._onConfirm,
      cancel: StartCombatDialog._onCancel,
    },
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/start-combat-dialog.hbs`,
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/start-combat-footer.hbs`,
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.moduleId = MODULE_ID;
    context.cancelLabel = `${MODULE_ID}.startCombat.cancel`;
    context.confirmLabel = `${MODULE_ID}.startCombat.confirm`;
    context.observations = Object.fromEntries(
      Object.entries(this.dialogData.observations).map(([id, o]) => [
        id,
        {
          name: o.avoider.combatant.name,
          skillResult: o.avoider.skillResult,
          observers: Object.fromEntries(
            Object.entries(o.observers).map(([k, v]) => {
              const entry = {
                name: v.name,
                dos: DOS_KEYS[v.degreeOfSuccess],
                label: LOCALIZATION_KEYS[v.stealthLabel],
                dc: v.dc,
              };
              if ((v.tooltips || []).length > 0) {
                entry.tooltips = v.tooltips.map((t) =>
                  localizeString(
                    t.format,
                    Object.keys(t.interpolations || {}).length > 0
                      ? Object.fromEntries(
                          Object.entries(t.interpolations).map(([k, v]) => [
                            k,
                            game.i18n.localize(v),
                          ]),
                        )
                      : {},
                  ),
                );
              }
              return [k, entry];
            }),
          ),
        },
      ]),
    );
    if (this.dialogData.ineligiblePcs.length > 0) {
      context.observations.ineligible = {
        ineligible: true,
        name: game.i18n.localize(`${MODULE_ID}.startCombat.ineligible`),
        because: game.i18n.localize(
          `${MODULE_ID}.startCombat.ineligibleBecause`,
        ),
        pcs: this.dialogData.ineligiblePcs.map((c) => ({ name: c.name })),
      };
    }
    context.stealthLabel = `${MODULE_ID}.startCombat.stealthLabel`;
    return context;
  }

  async _clearSensingLine() {
    if (this.lineTicker) {
      canvas.app.ticker.remove(this.lineTicker);
      this.lineTicker = null;
    }

    if (this.activeSensingLine) {
      canvas.stage.removeChild(this.activeSensingLine);
      this.activeSensingLine.destroy();
      this.activeSensingLine = null;
    }

    if (this.hoverKey) {
      this.hoverKey = null;
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const content = this.element.querySelector(
      `.${MODULE_ID}-start-combat-dialog`,
    );
    const footer = this.element.querySelector(`.${MODULE_ID}-sheet-footer`);
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

    this._clearSensingLine();

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

  async _onTargetHoverIn(avoiderId, observerId) {
    const hoverKey = `${MODULE_ID}-${avoiderId}-${observerId}`;
    if (this.hoverKey === hoverKey) return;
    if (avoiderId === undefined || observerId === undefined) return;

    await this._clearSensingLine();
    this.hoverKey = hoverKey;

    const observation = this.dialogData.observations[avoiderId];
    const avoider = getToken(observation.avoider.tokenDoc.id);
    const observer = getToken(observerId);

    const graphics = new PIXI.Graphics();
    canvas.stage.addChild(graphics);
    this.activeSensingLine = graphics;

    let pulseOffset = 0;
    const speed = 1.5;
    const spacing = 40;

    this.lineTicker = () => {
      if (!avoider || !observer) return;

      graphics.clear();

      const p1 = avoider.center;
      const p2 = observer.center;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.hypot(dx, dy);
      if (distance === 0) return;

      const angle = Math.atan2(dy, dx);

      graphics.lineStyle({
        width: 2,
        color: 0x3a86ff,
        alpha: 0.3,
        alignment: 0.5,
      });
      graphics.moveTo(p1.x, p1.y);
      graphics.lineTo(p2.x, p2.y);

      pulseOffset = (pulseOffset + speed) % spacing;

      graphics.lineStyle({
        width: 4,
        color: 0x8ab4f8,
        alpha: 0.9,
        alignment: 0.5,
        cap: PIXI.LINE_CAP.ROUND,
      });

      for (
        let currentDist = pulseOffset;
        currentDist < distance;
        currentDist += spacing
      ) {
        const segLength = 12;
        const startDist = currentDist;
        const endDist = Math.min(currentDist + segLength, distance);

        if (startDist >= distance) break;

        const startX = p1.x + Math.cos(angle) * startDist;
        const startY = p1.y + Math.sin(angle) * startDist;
        const endX = p1.x + Math.cos(angle) * endDist;
        const endY = p1.y + Math.sin(angle) * endDist;

        graphics.moveTo(startX, startY);
        graphics.lineTo(endX, endY);
      }
    };

    canvas.app.ticker.add(this.lineTicker);
  }

  async _onTargetHoverOut(avoiderId, observerId) {
    const hoverKey = `${MODULE_ID}-${avoiderId}-${observerId}`;
    if (this.hoverKey !== hoverKey) return;
    await this._clearSensingLine();
  }

  static async _onCycleStatus(_event, target) {
    const dataSet = target.dataset;
    const avoiderId = dataSet.avoider;
    const observerId = dataSet.observer;
    const observation =
      this.dialogData.observations[avoiderId].observers[observerId];
    observation.stealth = (observation.stealth + 1) % 3;
    observation.stealthLabel = STEALTH_LABELS[observation.stealth];
    observation.degreeOfSuccess = sneakDosStates[observation.stealth];
    this.render();
  }

  static async _onConfirm(_event, _target) {
    this.result = "confirm";
    await this.close();
  }

  static async _onCancel(_event, _target) {
    this.result = "cancel";
    await this.close();
  }

  static async wait(combatants) {
    return new Promise((resolve) => {
      const dialog = new this(combatants);
      let settled = false;

      const settle = (outcome) => {
        if (settled) return;
        settled = true;
        resolve(outcome);
      };

      const originalClose = dialog.close.bind(dialog);
      dialog.close = async (options = {}) => {
        const outcome = dialog.result === "confirm";
        try {
          return await originalClose(options);
        } finally {
          settle(outcome);
        }
      };

      dialog.render(true);
    });
  }
}
