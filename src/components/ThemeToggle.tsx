import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

type SwitchProps = {
  checked: boolean
  onToggle: () => void
  label: string
  className?: string
  knobClassName?: string
}

// Switch custom: trilho arredondado + knob que desliza entre sol e lua.
function SunMoonSwitch({ checked, onToggle, label, className, knobClassName }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center justify-between rounded-full border bg-secondary px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      {/* Ícones fixos: o do lado inativo fica visível e opaco; o do lado ativo é coberto pelo knob. */}
      <Sun className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
      <Moon className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
      <span
        className={cn(
          'absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground shadow-sm transition-transform duration-200',
          checked ? 'translate-x-6' : 'translate-x-0',
          knobClassName,
        )}
      >
        {checked ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  )
}

// Tema do admin: fonte da verdade e persistência ficam no useTheme; aqui só a UI.
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <SunMoonSwitch
      checked={isDark}
      onToggle={toggle}
      label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
    />
  )
}

// Modo noite da cena (`EnvironmentSettings.night`), no vidro escuro dos overlays.
export function NightToggle({ night, onNightChange }: { night: boolean; onNightChange: (night: boolean) => void }) {
  return (
    <SunMoonSwitch
      checked={night}
      onToggle={() => onNightChange(!night)}
      label={night ? 'Modo dia' : 'Modo noite'}
      className="border-white/10 bg-black/60 shadow-lg backdrop-blur-md focus-visible:ring-[#c9a86a]/70 focus-visible:ring-offset-0 [&>svg]:text-white"
      knobClassName="bg-white text-[#05111d]"
    />
  )
}
