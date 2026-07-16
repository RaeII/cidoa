import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

// Switch custom: trilho arredondado + knob que desliza entre sol e lua.
// Fonte da verdade e persistência ficam no useTheme; aqui só a UI.
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      onClick={toggle}
      className="relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center justify-between rounded-full border bg-secondary px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Ícones fixos: o do lado inativo fica visível e opaco; o do lado ativo é coberto pelo knob. */}
      <Sun className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
      <Moon className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
      <span
        className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground shadow-sm transition-transform duration-200 ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  )
}
