import { LoaderCircle, Plane, X, Zap } from "lucide-react";
import type { SpiritFlightState } from "../../scene/types";

export function SpiritControls({ state, onStart, onStop }: {
  state: SpiritFlightState;
  onStart: () => void;
  onStop: () => void;
}) {
  const active = state.phase !== "idle" && state.phase !== "error";
  const gamepadLabel = {
    connected: "Xbox conectado · A inicia e alterna turbo · B sair",
    disconnected: "Xbox: conecte e pressione um botão; depois A para iniciar",
    unsupported: "Controle sem mapeamento compatível · use WASD",
    unavailable: "Controle indisponível neste navegador · use WASD",
  }[state.gamepad];
  const buttonClass = "flex items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-4 py-3 text-sm font-medium text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300";

  if (!active) {
    return (
      <div className="absolute bottom-4 right-20 z-30 flex max-w-[calc(100vw-6rem)] flex-col items-end gap-2">
        <p className="max-w-72 rounded-lg bg-black/70 px-3 py-2 text-right text-xs text-white/80">{gamepadLabel}</p>
        {state.rings > 0 || state.hits > 0 || state.buildingsDestroyed > 0 || state.targetsDestroyed > 0 ? (
          <p className="rounded-lg bg-black/70 px-3 py-2 text-sm text-sky-200">Último voo: {state.score} pontos · {state.rings} anéis · {state.targetsDestroyed} alvos · {state.buildingsDestroyed} prédios</p>
        ) : null}
        {state.phase === "error" && (
          <p role="alert" className="rounded-lg bg-black/80 px-3 py-2 text-sm text-red-200">
            Não foi possível carregar o Spirit. Tente novamente.
          </p>
        )}
        <button type="button" className={buttonClass} onClick={(event) => {
          event.currentTarget.blur();
          onStart();
        }}>
          <Plane size={18} aria-hidden="true" /> Controlar Spirit
        </button>
      </div>
    );
  }

  const label = {
    loading: "Carregando Spirit…",
    entering: "Spirit se aproximando…",
    flying: state.boosted ? "Turbo ativado" : "Voo de cruzeiro",
    returning: "Retornando à cidade…",
    idle: "", error: "",
  }[state.phase];

  return (
    <section aria-label="Controle do B-2 Spirit" className="pointer-events-none absolute inset-0 z-40">
      {state.feedback === "hit" && <div aria-hidden="true" className="absolute inset-0 border-[10px] border-orange-500/50 bg-orange-500/10" />}
      <div className="absolute left-4 top-4 max-w-[calc(100%-8rem)] rounded-xl border border-white/15 bg-black/70 px-4 py-3 text-white backdrop-blur-md">
        <div className="text-[10px] font-semibold tracking-[0.24em] text-sky-200">B-2 SPIRIT</div>
        <div role="status" className="mt-1 flex items-center gap-2 text-sm">
          {state.phase === "loading" ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Zap size={16} className={state.boosted ? "text-sky-300" : "text-white/50"} aria-hidden="true" />}
          {label}
        </div>
        <div className="mt-3 text-2xl font-semibold tabular-nums text-sky-200">{state.score} <span className="text-xs font-normal">pontos</span></div>
        <div className="mt-1 text-xs text-white/70">{state.rings} anéis · {state.hits} colisões</div>
        <div className="mt-1 text-xs text-white/70">{state.targetsDestroyed} alvos · {state.buildingsDestroyed} prédios destruídos</div>
        <div role="status" className="mt-2 min-h-5 text-sm font-medium text-white">
          {state.feedback === "ring" ? "+100 · Anel completo!" : state.feedback === "hit" ? "Colisão! −50 pontos" : state.feedback === "miss" ? "Anel perdido" : state.feedback === "target" ? "Alvo abatido!" : state.feedback === "destroyed" ? "Edifício destruído!" : "Atravesse os anéis azuis"}
        </div>
      </div>
      <button type="button" onClick={onStop} disabled={state.phase === "returning"}
        className={`pointer-events-auto absolute right-4 top-4 ${buttonClass} disabled:opacity-50`}
        aria-label="Fechar animação do Spirit (Esc)">
        <X size={18} aria-hidden="true" /> Fechar <kbd className="hidden text-xs text-white/50 sm:inline">Esc</kbd>
      </button>
      <div className="absolute bottom-5 left-1/2 w-[min(34rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-white/15 bg-black/70 px-5 py-4 text-center text-white backdrop-blur-md">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/80">
          {state.gamepad === "connected" ? <>
            <span><strong>Analógico esquerdo ↑ / ↓</strong> Descer / subir</span>
            <span><strong>← / →</strong> Virar</span>
            <span><strong>Analógico direito</strong> Câmera</span>
            <span><strong>RT</strong> Atirar</span>
            <span><strong>LT</strong> Bomba</span>
            <span><strong>LB / RB</strong> Esquivar</span>
            <span><strong>A</strong> Alternar turbo</span>
            <span><strong>B</strong> Sair</span>
          </> : <>
            <span><kbd className="font-semibold text-white">W / S</kbd> Subir / descer</span>
            <span><kbd className="font-semibold text-white">A / D</kbd> Virar</span>
            <span><kbd className="font-semibold text-white">F</kbd> Atirar</span>
            <span><kbd className="font-semibold text-white">G</kbd> Bomba</span>
            <span><kbd className="font-semibold text-white">Q / E</kbd> Esquivar</span>
            <span><kbd className="font-semibold text-white">Espaço</kbd> Alternar turbo</span>
            <span><kbd className="font-semibold text-white">Esc</kbd> Sair</span>
          </>}
        </div>
        <p className="mt-2 text-xs text-white/50">{state.phase === "entering" || state.phase === "loading" ? "Aguarde o jato assumir a posição de voo." : "Voo automático · manche invertido no analógico esquerdo, câmera no direito"}</p>
        <p className="mt-2 text-xs text-sky-100">Anel azul +100 · desvie das barreiras laranjas (−50)</p>
        <p className="mt-1 text-xs text-pink-200">Mira amarela acompanha o nariz · abata alvos rosas e bombardeie os prédios</p>
        <p className="mt-2 text-[11px] text-white/70">{gamepadLabel}{state.gamepad === "connected" ? " · Teclado também disponível" : ""}</p>
        <p className="pointer-events-auto mt-3 text-[10px] text-white/40">
          Modelo: <a className="underline hover:text-white" href="https://sketchfab.com/3d-models/northrop-grumman-b-2-spirit-free-9cd6b00813c04401a5427ae71b7a0cdc" target="_blank" rel="noreferrer">bohmerang</a>
          {" · "}<a className="underline hover:text-white" href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>
        </p>
      </div>
    </section>
  );
}
