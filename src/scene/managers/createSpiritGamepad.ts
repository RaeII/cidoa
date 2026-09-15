import type { SpiritFlightState } from "../types";

const deadZone = (value = 0) => Math.abs(value) < 0.16 ? 0 : Math.sign(value) * Math.min(1, (Math.abs(value) - 0.16) / 0.84);

/** Leitura com estado do mapeamento standard: Xbox USB/Bluetooth, sem dependências. */
export function createSpiritGamepad() {
  let previousButtons = 0;
  let previousDevice = "";
  let primed = false;

  return {
    read() {
      let gamepads: (Gamepad | null)[] = [];
      let status: SpiritFlightState["gamepad"] = "disconnected";
      try {
        if (typeof navigator !== "undefined" && navigator.getGamepads) {
          gamepads = Array.from(navigator.getGamepads());
        } else {
          status = "unavailable";
        }
      } catch {
        status = "unavailable";
      }
      const pad = gamepads.find((candidate) => candidate?.connected && candidate.mapping === "standard");
      if (pad) status = "connected";
      else if (gamepads.some((candidate) => candidate?.connected)) status = "unsupported";
      const target = document.activeElement;
      const editing = target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [role='dialog']"));
      const focused = !document.hidden && document.hasFocus?.() !== false && !editing;
      const device = pad ? `${pad.index}:${pad.id}` : "";
      const buttons = pad ? Number(pad.buttons[0]?.pressed) | (Number(pad.buttons[1]?.pressed) << 1) | (Number(pad.buttons[9]?.pressed) << 2)
        | (Number(pad.buttons[4]?.pressed) << 3) | (Number(pad.buttons[5]?.pressed) << 4)
        | (Number(pad.buttons[6]?.pressed || (pad.buttons[6]?.value ?? 0) > 0.25) << 5) : 0;
      // Reconexão/retorno à aba: sincroniza botões antes de aceitar outra pressão.
      const pressed = focused && primed && device === previousDevice ? buttons & ~previousButtons : 0;
      previousButtons = buttons;
      previousDevice = device;
      primed = focused && !!pad;
      return {
        status,
        turn: focused && pad ? -deadZone(pad.axes[0]) : 0,
        // Manche de jato: analógico à frente baixa o nariz, para trás sobe.
        climb: focused && pad ? deadZone(pad.axes[1]) : 0,
        lookX: focused && pad ? deadZone(pad.axes[2]) : 0,
        lookY: focused && pad ? deadZone(pad.axes[3]) : 0,
        boostPressed: (pressed & 1) !== 0,
        stopPressed: (pressed & 2) !== 0,
        dodgeLeftPressed: (pressed & 8) !== 0,
        dodgeRightPressed: (pressed & 16) !== 0,
        bombPressed: (pressed & 32) !== 0,
        fireHeld: focused && !!pad && (pad.buttons[7]?.pressed || (pad.buttons[7]?.value ?? 0) > 0.25),
        // A inicia parado; em voo o mesmo botão vira turbo (boostPressed).
        startPressed: (pressed & 5) !== 0,
      };
    },
  };
}
