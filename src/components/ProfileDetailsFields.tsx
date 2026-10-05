import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { getCities } from "@/api/location/location.routes";
import type { City } from "@/api/location/location.types";
import type { DiscoverySource, ProfileDetails } from "@/api/user/user.types";
import { formatCity, indexCities, pickTypedCity, searchCities, type CityIndex } from "@/lib/citySearch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Rótulos de "Como conheceu o Cidoa?" — lugar único; a ordem é a dos chips. */
const DISCOVERY_LABELS: Record<DiscoverySource, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  google: "Google",
  friend: "Amigo ou familiar",
  ong: "Uma ONG",
  other: "Outro",
};

// Tokens do tema: claro no diálogo do onboarding, escuro dentro do GameMenu (`.dark`).
const labelClass = "mb-2 block text-sm text-foreground/75";
const popupClass =
  "absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg";
const chipClass =
  "h-10 rounded-full border border-input px-4 text-sm font-medium transition-colors outline-none data-[state=unchecked]:hover:bg-foreground/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground";

/**
 * Busca única "Campinas, SP": estado + cidade numa interação, sem cascata UF → cidade.
 * Combobox ARIA (lista com aria-activedescendant); o foco nunca sai do input.
 */
export function CityCombobox({
  id,
  value,
  onChange,
  className,
}: {
  id: string;
  value: City | null;
  onChange: (city: City | null) => void;
  className?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState<CityIndex | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // null = sem edição: o input mostra a cidade escolhida.
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => (index && query ? searchCities(index, query) : []), [index, query]);
  const expanded = open && results.length > 0;
  const text = query ?? (value ? formatCity(value) : "");

  useEffect(() => {
    let alive = true;
    getCities().then(
      (cities) => alive && setIndex(indexCities(cities)),
      () => alive && setLoadError(true),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  // Esc com a lista aberta fecha só a lista. A captura na window roda antes do
  // Esc do Dialog Radix (captura no document), que respeita `defaultPrevented` —
  // sem isso, Esc fecharia o modal junto (no onboarding, Esc = pular).
  useEffect(() => {
    if (!expanded) return;
    const closeList = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.target !== inputRef.current) return;
      event.preventDefault();
      setOpen(false);
    };
    window.addEventListener("keydown", closeList, true);
    return () => window.removeEventListener("keydown", closeList, true);
  }, [expanded]);

  // Na aba Perfil o painel rola e cortaria a lista: rola só o necessário para ela caber.
  useEffect(() => {
    if (expanded) listRef.current?.scrollIntoView({ block: "nearest" });
  }, [expanded, results.length]);

  function pick(city: City | null) {
    onChange(city);
    setQuery(null);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!results.length) return;
      event.preventDefault();
      if (!expanded) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + results.length) % results.length);
    } else if (event.key === "Enter" && expanded) {
      event.preventDefault();
      pick(results[active]);
    }
  }

  return (
    <>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Busque sua cidade"
          className={cn("pr-11", className)}
          value={text}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onBlur={() => {
            // Texto apagado = sem cidade; texto que aponta para uma cidade só = escolhe;
            // resto volta à cidade atual.
            if (query !== null) {
              const typed = query.trim() ? pickTypedCity(results, query) : null;
              if (typed || !query.trim()) onChange(typed);
            }
            setQuery(null);
            setOpen(false);
          }}
          onKeyDown={handleKeyDown}
        />
        {text && (
          <button
            type="button"
            aria-label="Limpar cidade"
            className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            // Mantém o foco no input: sem blur no meio do clique.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              pick(null);
              inputRef.current?.focus();
            }}
          >
            <X className="size-4" />
          </button>
        )}
        <ul ref={listRef} id={listId} role="listbox" aria-label="Cidades" hidden={!expanded} className={cn(popupClass, "py-1")}>
          {results.map((city, i) => (
            <li
              key={city.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="cursor-pointer px-3 py-2.5 text-sm aria-selected:bg-muted"
              onMouseDown={(event) => event.preventDefault()}
              // mousemove, não mouseenter: rolar a lista sob o mouse parado não troca a opção ativa.
              onMouseMove={() => setActive(i)}
              onClick={() => pick(city)}
            >
              {city.name}
              <span className="text-muted-foreground">, {city.uf}</span>
            </li>
          ))}
        </ul>
        {open && !!query?.trim() && !expanded && !loadError && (
          <p role="status" className={cn(popupClass, "px-3 py-2.5 text-sm text-muted-foreground")}>
            {index ? "Nenhuma cidade encontrada." : "Carregando cidades…"}
          </p>
        )}
      </div>
      {loadError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Não foi possível carregar as cidades.{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-4"
            onClick={() => {
              setLoadError(false);
              setAttempt((n) => n + 1);
            }}
          >
            Tentar de novo
          </button>
        </p>
      )}
    </>
  );
}

/** Cidade + "Como conheceu o Cidoa?": mesmos campos no onboarding e na aba Perfil. */
export function ProfileDetailsFields({
  value,
  onChange,
  fieldClassName,
}: {
  value: ProfileDetails;
  onChange: (value: ProfileDetails) => void;
  /** Estilo extra dos inputs de texto (ex.: vidro escuro da aba Perfil). */
  fieldClassName?: string;
}) {
  const cityId = useId();
  const sourceLabelId = useId();

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor={cityId} className={labelClass}>
          Cidade
        </label>
        <CityCombobox
          id={cityId}
          value={value.city}
          onChange={(city) => onChange({ ...value, city })}
          className={fieldClassName}
        />
      </div>
      <div>
        <p id={sourceLabelId} className={labelClass}>
          Como conheceu o Cidoa?
        </p>
        <RadioGroup.Root
          aria-labelledby={sourceLabelId}
          value={value.discovery_source ?? ""}
          onValueChange={(source) => onChange({ ...value, discovery_source: source as DiscoverySource })}
          className="flex flex-wrap gap-2"
        >
          {Object.entries(DISCOVERY_LABELS).map(([source, label]) => (
            <RadioGroup.Item key={source} value={source} className={chipClass}>
              {label}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
        {value.discovery_source === "other" && (
          <Input
            aria-label="Onde conheceu o Cidoa"
            placeholder="Onde?"
            maxLength={100}
            className={cn("mt-3", fieldClassName)}
            value={value.discovery_source_other ?? ""}
            onChange={(event) => onChange({ ...value, discovery_source_other: event.target.value })}
          />
        )}
      </div>
    </div>
  );
}
