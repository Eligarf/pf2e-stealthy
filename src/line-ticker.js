import { debuglog } from "./utils.js";

const defaults = {
  offset: 0,
  speed: 1.5,
  spacing: 40,
  segLength: 12,
  lineStyle: {
    width: 2,
    color: 0x3a86ff,
    alpha: 0.3,
    alignment: 0.5,
  },
  segmentStyle: {
    width: 4,
    color: 0x8ab4f8,
    alpha: 0.9,
    alignment: 0.5,
    cap: PIXI.LINE_CAP.ROUND,
  },
};

export class LineTicker {
  constructor(avoider, observer, options = {}) {
    this.avoider = avoider;
    this.observer = observer;
    this.options = {
      ...defaults,
      ...options,
      lineStyle: {
        ...defaults.lineStyle,
        ...(options?.lineStyle || {}),
      },
      segmentStyle: {
        ...defaults.segmentStyle,
        ...(options?.segmentStyle || {}),
      },
    };

    const graphics = new PIXI.Graphics();
    canvas.stage.addChild(graphics);
    this.graphics = graphics;
    this.lineTicker = () => {
      this.tick();
    };
    canvas.app.ticker.add(this.lineTicker);
  }

  destroy() {
    if (this.lineTicker) {
      canvas.app.ticker.remove(this.lineTicker);
      this.lineTicker = null;
    }
    if (this.graphics) {
      canvas.stage.removeChild(this.graphics);
      this.graphics.destroy();
      this.graphics = null;
    }
  }

  tick() {
    if (!this.avoider || !this.observer) return;

    this.graphics.clear();

    const p1 = this.avoider.center;
    const p2 = this.observer.center;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;

    const cos = dx / distance;
    const sin = dy / distance;

    const options = this.options;
    this.graphics.lineStyle(options.lineStyle);
    this.graphics.moveTo(p1.x, p1.y);
    this.graphics.lineTo(p2.x, p2.y);

    this.graphics.lineStyle(options.segmentStyle);

    options.offset = (options.offset + options.speed) % options.spacing;
    for (
      let currentDist = options.offset;
      currentDist < distance;
      currentDist += options.spacing
    ) {
      const startDist = currentDist;
      const endDist = Math.min(currentDist + options.segLength, distance);

      if (startDist >= distance) break;

      const startX = p1.x + cos * startDist;
      const startY = p1.y + sin * startDist;
      const endX = p1.x + cos * endDist;
      const endY = p1.y + sin * endDist;

      this.graphics.moveTo(startX, startY);
      this.graphics.lineTo(endX, endY);
    }
  }
}
