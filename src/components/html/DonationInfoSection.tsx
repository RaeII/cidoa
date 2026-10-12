import { useMemo } from "react";
import type { DonationRecord, Ong } from "@/api/donationApi";
import type { DonationFilter, DonationsLoadState } from "@/components/hooks/useDonations";
import { Button } from "@/components/ui/button";
import { BlockLoader, ErrorMark, PixelArrow } from "@/components/ui/pixel-icon";
import { formatBRL } from "@/lib/unlock";

type DonationInfoSectionProps = {
  donations: readonly DonationRecord[];
  ongs: readonly Ong[];
  filter: DonationFilter;
  loadState: DonationsLoadState;
  onFilterChange: (filter: DonationFilter) => void;
  onViewOng: (id: number) => void;
  onRetry: () => void;
};

const ONG_LIMIT = 5;

export function DonationInfoSection({
  donations,
  ongs,
  filter,
  loadState,
  onFilterChange,
  onViewOng,
  onRetry,
}: DonationInfoSectionProps) {
  const summary = useMemo(() => {
    let totalCents = 0;
    const cityIds = new Set<number>();
    const ongStats = new Map<number, { count: number; cities: Set<number> }>();
    for (const donation of donations) {
      totalCents += Math.round(donation.value * 100);
      cityIds.add(donation.cityId);
      for (const ongId of new Set(donation.ongIds)) {
        const stats = ongStats.get(ongId) ?? { count: 0, cities: new Set<number>() };
        stats.count += 1;
        stats.cities.add(donation.cityId);
        ongStats.set(ongId, stats);
      }
    }
    return { totalRaised: totalCents / 100, cityCount: cityIds.size, ongStats };
  }, [donations]);
  const shownOngs = useMemo(() => [...ongs].sort((a, b) =>
    Number(b.id === filter.ongId) - Number(a.id === filter.ongId)
    || (summary.ongStats.get(b.id)?.count ?? 0) - (summary.ongStats.get(a.id)?.count ?? 0)
    || a.name.localeCompare(b.name, "pt-BR"),
  ).slice(0, ONG_LIMIT), [ongs, summary, filter.ongId]);
  const hasFilter = Object.values(filter).some((value) => value !== undefined);

  return (
    <section id="donation-info" aria-labelledby="donation-info-title" className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:px-10 sm:py-32">
        <header className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="mono-label text-primary">O projeto</p>
            <h2 id="donation-info-title" className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
              Cada contribuição ergue um edifício. Cada edifício sustenta uma causa animal.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              Cidoa transforma suas contribuições em edifícios e apoia ONGs de proteção animal:
              resgate, castração, tratamento veterinário e adoção responsável.
            </p>
          </div>
          <div className="pixel bevel-edge bg-card pb-1">
            <img
              src="/cat_dog.jpeg"
              alt="Um cachorro e um gato resgatados, lado a lado"
              width={1024}
              height={947}
              loading="lazy"
              className="w-full object-cover"
            />
          </div>
        </header>

        <div className="my-16 h-px w-full bg-border" />

        {loadState.status === "loading" ? (
          <div role="status" className="flex items-center gap-3 py-8 text-muted-foreground">
            <BlockLoader /><span>Carregando ONGs e contribuições…</span>
          </div>
        ) : loadState.status === "error" ? (
          <div className="space-y-4 py-8">
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <ErrorMark />Não foi possível carregar as contribuições.
            </p>
            <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>
          </div>
        ) : (
          <>
            <div className="grid gap-12 sm:grid-cols-[1.2fr_1fr] sm:items-end">
              <div>
                <p className="mono-label text-muted-foreground">{hasFilter ? "Total neste recorte" : "Total arrecadado"}</p>
                <p className="mt-3 break-words text-4xl font-semibold tracking-[-0.02em] text-primary sm:text-5xl">
                  {formatBRL(summary.totalRaised)}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-6">
                {([
                  ["Edifícios", donations.length],
                  ["ONGs apoiadas", summary.ongStats.size],
                  ["Cidades", summary.cityCount],
                ] as const).map(([label, count]) => (
                  <div key={label} className="flex flex-col-reverse">
                    <dt className="mono-label mt-1 text-muted-foreground">{label}</dt>
                    <dd className="text-2xl font-semibold">{count.toLocaleString("pt-BR")}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="my-16 h-px w-full bg-border" />

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mono-label text-primary">ONGs apoiadas</p>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.01em]">Para onde vai a sua contribuição</h3>
              </div>
              {hasFilter && <Button variant="ghost" onClick={() => onFilterChange({})}>Limpar filtros</Button>}
            </div>
            {hasFilter && <p className="mt-4 text-sm text-muted-foreground">Valores e edifícios seguem os filtros da cidade.</p>}

            {shownOngs.length === 0 ? (
              <p className="mt-8 text-muted-foreground">Nenhuma ONG disponível.</p>
            ) : (
              <ul className="mt-8 border-t border-border">
                {shownOngs.map((ong) => {
                  const stats = summary.ongStats.get(ong.id);
                  const count = stats?.count ?? 0;
                  const cityCount = stats?.cities.size ?? 0;
                  return (
                    <li key={ong.id} className="flex flex-col gap-3 border-b border-border py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                      <div className="min-w-0">
                        <h4 className="break-words text-lg font-semibold">{ong.name}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {cityCount.toLocaleString("pt-BR")} {cityCount === 1 ? "cidade representada" : "cidades representadas"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
                        <p className="text-lg font-semibold">
                          {count.toLocaleString("pt-BR")} {count === 1 ? "edifício" : "edifícios"}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="menu-cursor pl-6"
                          data-active={filter.ongId === ong.id}
                          aria-label={"Ver edifícios de " + ong.name + " na cidade"}
                          onClick={() => onViewOng(ong.id)}
                        >Ver na cidade<PixelArrow /></Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
              {ongs.length > ONG_LIMIT && <>{shownOngs.length} de {ongs.length.toLocaleString("pt-BR")} ONGs. </>}
              {donations.length === 0 ? "Nenhum edifício encontrado neste recorte." : "Um edifício pode apoiar mais de uma ONG."}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
