import { formatShortcut, type KeyboardShortcut } from "../hooks/useKeyboardShortcuts";

export type KeyboardShortcutsHelpProps = {
  shortcuts: KeyboardShortcut[];
  onClose: () => void;
};

export function KeyboardShortcutsHelp({ shortcuts, onClose }: KeyboardShortcutsHelpProps) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 p-5 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide">Atalhos de teclado</h2>
          <button
            onClick={onClose}
            className="text-white/50 transition-colors hover:text-white"
            title="Fechar"
            aria-label="Fechar atalhos"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <ul className="space-y-2">
          {shortcuts.map((shortcut) => (
            <li
              key={shortcut.description}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="text-white/70">{shortcut.description}</span>
              <kbd className="shrink-0 rounded-md border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-xs text-white">
                {formatShortcut(shortcut)}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
