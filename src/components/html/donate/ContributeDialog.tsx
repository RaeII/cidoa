import { useId, useState, type FormEvent, type SVGProps } from "react";
import { RadioGroup } from "radix-ui";
import type { Ong } from "@/api/donationApi";
import type { MyDonation } from "@/components/GameMenu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, parseMoney } from "@/lib/unlock";

/** O que o fluxo de pagamento recebe. `donationId` null = edifício novo. */
export type Contribution = { donationId: number | null; ongId: number; value: number };

const PRESETS = [10, 25, 50, 100];

const labelClass = "mb-2 block text-sm text-foreground/75";
const chipClass =
  "h-10 rounded-full border border-input px-2 text-sm font-medium transition-colors outline-none data-[state=unchecked]:hover:bg-foreground/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground";
const selectClass = "w-full data-[size=default]:h-11";

// ponytail: cópia do lucide `building-complex-plus` (só existe no lucide-react ≥ 1.52); trocar pelo import ao atualizar.
function BuildingComplexPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 12h4" />
      <path d="M10 21v-3a2 2 0 013.05-1.702" />
      <path d="M10 8h4" />
      <path d="M16 19h6" />
      <path d="M18 7h2a2 2 0 012 2v4.355" />
      <path d="M19 16v6" />
      <path d="M6 10H4a2 2 0 00-2 2v7a2 2 0 002 2h8.535" />
      <path d="M6 21V5a2 2 0 012-2h8a2 2 0 012 2v7.126" />
    </svg>
  );
}

/**
 * Botão "Contribuir" + formulário: edifício novo ou aumentar um seu, ONG e valor.
 * Só UI: `onSubmit` é a costura do pagamento.
 */
export function ContributeDialog({
  ongs,
  buildings,
  onSubmit,
}: {
  ongs: readonly Ong[];
  /** Edifícios do usuário; sem nenhum, a escolha novo/aumentar some. */
  buildings: readonly MyDonation[];
  onSubmit: (contribution: Contribution) => void;
}) {
  const ongFieldId = useId();
  const amountId = useId();
  const [grow, setGrow] = useState(false);
  const [buildingId, setBuildingId] = useState("");
  const [ongId, setOngId] = useState("");
  const [amount, setAmount] = useState("");

  const value = parseMoney(amount);
  const growing = grow && buildings.length > 0;
  const ready = value !== null && ongId !== "" && (!growing || buildingId !== "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    onSubmit({ donationId: growing ? Number(buildingId) : null, ongId: Number(ongId), value });
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="absolute bottom-6 left-1/2 z-30 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-primary-foreground px-6 text-sm font-semibold text-primary shadow-lg outline-none transition-transform hover:scale-[1.03] focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-100"
        >
          <BuildingComplexPlus className="size-5" />
          Contribuir
        </button>
      </DialogTrigger>
      {/* text-foreground: o body da cena pinta texto branco, que sumiria no tema claro. */}
      <DialogContent className="text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contribuir</DialogTitle>
          <DialogDescription>Seu valor vai para uma ONG e ergue seu edifício na cidade.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {buildings.length > 0 && (
            <div>
              <RadioGroup.Root
                aria-label="Edifício"
                value={grow ? "grow" : "new"}
                onValueChange={(next) => setGrow(next === "grow")}
                className="grid grid-cols-2 gap-2"
              >
                <RadioGroup.Item value="new" className={chipClass}>
                  Novo edifício
                </RadioGroup.Item>
                <RadioGroup.Item value="grow" className={chipClass}>
                  Aumentar edifício
                </RadioGroup.Item>
              </RadioGroup.Root>
              {grow && (
                <Select value={buildingId} onValueChange={setBuildingId}>
                  <SelectTrigger aria-label="Qual edifício" className={`mt-3 ${selectClass}`}>
                    <SelectValue placeholder="Qual edifício?" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((building) => (
                      <SelectItem key={building.id} value={String(building.id)}>
                        {formatBRL(building.value)}
                        {building.ongName && ` · ${building.ongName}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div>
            <label htmlFor={ongFieldId} className={labelClass}>
              ONG
            </label>
            <Select value={ongId} onValueChange={setOngId}>
              <SelectTrigger id={ongFieldId} className={selectClass}>
                <SelectValue placeholder="Escolha a ONG" />
              </SelectTrigger>
              <SelectContent>
                {ongs.map((ong) => (
                  <SelectItem key={ong.id} value={String(ong.id)}>
                    {ong.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor={amountId} className={labelClass}>
              Valor
            </label>
            <RadioGroup.Root
              aria-label="Valores sugeridos"
              value={value !== null && PRESETS.includes(value) ? String(value) : ""}
              onValueChange={setAmount}
              className="mb-3 grid grid-cols-4 gap-2"
            >
              {PRESETS.map((preset) => (
                <RadioGroup.Item key={preset} value={String(preset)} className={chipClass}>
                  {formatBRL(preset)}
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted-foreground">
                R$
              </span>
              <Input
                id={amountId}
                inputMode="decimal"
                autoComplete="off"
                placeholder="Outro valor"
                className="pl-9"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={!ready}>
            {growing ? "Aumentar edifício" : "Erguer edifício"}
            {value !== null && ` · ${formatBRL(value)}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
