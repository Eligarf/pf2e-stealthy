import { MODULE_ID } from "./const.js";
import { debuglog, getToken } from "./utils.js";
import { renderAvoidanceCheckCard } from "./avoidance-check.js";
import { renderInitiativeCard } from "./render-status.js";
import { renderSneakCard } from "./sneak.js";
import { renderHideCard } from "./hide.js";
// import { renderCreateADiversionCard } from "./create-a-diversion.js";
import { renderSeekCard } from "./seek.js";
import { renderPointOutCard } from "./point-out.js";
import { renderEditCard } from "./edit.js";
import { renderActionCard } from "./action.js";
import { LineTicker } from "./line-ticker.js";

let activeLineTicker = null;
let activeHoverKey = null;

function clearLineTicker() {
  if (activeLineTicker) {
    activeLineTicker.destroy();
    activeLineTicker = null;
  }
  if (activeHoverKey) activeHoverKey = null;
}

function onTargetHoverIn(originId, targetId) {
  const hoverKey = `${MODULE_ID}-${originId}-${targetId}`;
  if (activeHoverKey === hoverKey) return;
  if (originId === undefined || targetId === undefined) return;
  const origin = getToken(originId);
  const target = getToken(targetId);
  if (!origin || !target) return;

  clearLineTicker();
  activeHoverKey = hoverKey;
  activeLineTicker = new LineTicker(origin, target);
}

function onTargetHoverOut(originId, targetId) {
  const hoverKey = `${MODULE_ID}-${originId}-${targetId}`;
  if (activeHoverKey !== hoverKey) return;
  clearLineTicker();
}

async function clickHandler(message, event, flags, clickIds) {
  // debuglog("clickHandler", { message, event, flags, clickIds });
  const element = event.target.closest(`[data-click-id]`);
  if (element) {
    event.preventDefault();
    const clickId = element.dataset.clickId;
    if (clickId in clickIds) {
      await clickIds[clickId](message, event, flags);
    }
    return;
  }
}

globalThis.Hooks.on("renderChatMessageHTML", async (message, html, data) => {
  const flags = message.flags[MODULE_ID];
  if (!flags) return;
  // debuglog("renderChatMessageHTML (render-card)", {
  //   message,
  //   html,
  //   data,
  //   flags,
  // });

  let interactionContext = null;

  async function doAttachments() {
    if (!interactionContext) return;
    if (interactionContext.clickIds) {
      html.addEventListener(
        "click",
        async (event) =>
          await clickHandler(
            message,
            event,
            flags,
            interactionContext.clickIds,
          ),
      );
    }

    const targets = html.querySelectorAll(`.${MODULE_ID}-target`);
    targets.forEach((target) => {
      const dataSet = target.dataset;
      const originId = dataSet.origin;
      const targetId = dataSet.target;
      target.addEventListener("pointerenter", () => {
        onTargetHoverIn(originId, targetId);
      });
      target.addEventListener("pointerleave", () => {
        onTargetHoverOut(originId, targetId);
      });
    });
  }

  async function guts() {
    switch (flags.card) {
      case "initiative":
        interactionContext = await renderInitiativeCard(
          message,
          html,
          data,
          flags,
        );
        break;
      case "avoidance-check":
        interactionContext = await renderAvoidanceCheckCard(
          message,
          html,
          data,
          flags,
        );
        break;
      case "hide":
        interactionContext = await renderHideCard(message, html, data, flags);
        break;
      case "sneak":
        interactionContext = await renderSneakCard(message, html, data, flags);
        break;
      case "seek":
        interactionContext = await renderSeekCard(message, html, data, flags);
        break;
      case "pointOut":
        interactionContext = await renderPointOutCard(
          message,
          html,
          data,
          flags,
        );
        break;
      case "edit":
        interactionContext = await renderEditCard(message, html, data, flags);
        break;
      // case "create-a-diversion":
      //   interactionContext = renderCreateADiversionCard(
      //     message,
      //     html,
      //     data,
      //     flags,
      //   );
      //   break;
    }
    doAttachments();

    if (flags.endStealth) {
      interactionContext = await renderActionCard(
        message,
        html,
        data,
        flags,
        interactionContext,
      );
      doAttachments();
    }
  }

  if (canvas.ready) {
    return guts();
  } else {
    Hooks.once("canvasReady", async () => {
      return guts();
    });
  }
});
