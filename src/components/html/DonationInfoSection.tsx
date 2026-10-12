import { useMemo, useState } from "react";
import type { City, DonationRecord, Ong } from "@/api/donationApi";
import type { DonationFilter, DonationsLoadState } from "@/components/hooks/useDonations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  BlockLoader,
  ErrorMark,
  PixelArrow,
  PixelBuilding,
  PixelCat,
  PixelDog,
  PixelHeart,
} from "@/components/ui/pixel-icon";
import { formatBRL } from "@/lib/unlock";

type DonationInfoSectionProps = {
  donations: readonly DonationRecord[];
  cities: readonly City[];
  ongs: readonly Ong[];
  filter: DonationFilter;
  loadState: DonationsLoadState;
  onFilterChange: (filter: DonationFilter) => void;
  onOpenDonation: (id: number) => void;
  onRetry: () => void;
};

const PAGE_SIZE = 10;

export function DonationInfoSection({
  donations,
  cities,
  ongs,
  filter,
  loadState,
  onFilterChange,
  onOpenDonation,
  onRetry,
}: DonationInfoSectionProps) {
  const [pagination, setPagination] = useState({ donations, page: 1 });
  if (pagination.donations !== donations) {
    setPagination({ donations, page: 1 });
  }
  const summary = useMemo(() => {
    let totalCents = 0;
    const cityIds = new Set<number>();
    const ongCounts = new Map<number, number>();
    for (const donation of donations) {
      totalCents += Math.round(donation.value * 100);
      cityIds.add(donation.cityId);
      for (const ongId of new Set(donation.ongIds)) {
        ongCounts.set(ongId, (ongCounts.get(ongId) ?? 0) + 1);
      }
    }
    return {
      totalRaised: totalCents / 100,
      cityCount: cityIds.size,
      ongCounts,
      ordered: [...donations].sort((a, b) => b.value - a.value || a.id - b.id),
    };
  }, [donations]);
  const cityById = useMemo(() => new Map(cities.map((city) => [city.id, city])), [cities]);
  const ongById = useMemo(() => new Map(ongs.map((ong) => [ong.id, ong])), [ongs]);
  const totalPages = Math.max(1, Math.ceil(donations.length / PAGE_SIZE));
  const page = pagination.donations === donations ? Math.min(pagination.page, totalPages) : 1;
  const pageDonations = summary.ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilter = Object.values(filter).some((value) => value !== undefined);

  return (
    <section id="donation-info" aria-labelledby="donation-info-title" tabIndex={-1} className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24">
        <header className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div>
            <p className="mono-label flex items-center gap-2 text-primary"><PixelHeart />O projeto</p>
            <h2 id="donation-info-title" className="mt-5 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">
              Cada edifício apoia uma causa animal.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
              Suas contribuições fazem a cidade crescer e apoiam ONGs de proteção animal.
              Confira os valores e conheça os edifícios de cada causa.
            </p>
            <Button asChild variant="outline" className="mt-7">
              <a href="#city-scene"><PixelBuilding />Voltar para a cidade</a>
            </Button>
          </div>

          <div className="relative pt-12">
            <div aria-hidden="true" className="absolute top-0 right-7 flex items-end gap-4">
              <PixelCat /><PixelDog />
            </div>
            <div className="pixel bevel-verde-700 bg-primary px-6 pt-7 pb-8 text-primary-foreground sm:px-8">
              <p className="mono-label">{hasFilter ? "Total neste recorte" : "Total arrecadado"}</p>
              {loadState.status === "ready" ? (
                <>
                  <p className="mt-4 break-words text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">{formatBRL(summary.totalRaised)}</p>
                  <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-primary-foreground/30 pt-5">
                    {([
                      ["Edifícios", donations.length],
                      ["ONGs apoiadas", summary.ongCounts.size],
                      ["Cidades", summary.cityCount],
                    ] as const).map(([label, count]) => (
                      <div key={label}>
                        <dt className="font-mono text-[11px]">{label}</dt>
                        <dd className="mt-1 text-2xl font-semibold">{count.toLocaleString("pt-BR")}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : <p className="mt-4 text-sm">{loadState.status === "loading" ? "Carregando contribuições…" : "Valores indisponíveis"}</p>}
            </div>
          </div>
        </header>

        {loadState.status === "loading" ? (
          <div role="status" className="mt-16 flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <BlockLoader /><span>Carregando ONGs e contribuições…</span>
          </div>
        ) : loadState.status === "error" ? (
          <Card className="mt-16 px-6">
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive"><ErrorMark />Não foi possível carregar as contribuições.</p>
            <Button variant="outline" onClick={onRetry} className="self-start">Tentar novamente</Button>
          </Card>
        ) : (
          <>
            <div className="mt-16 flex flex-wrap items-end justify-between gap-4 border-t pt-10">
              <div>
                <p className="mono-label text-primary">ONGs apoiadas</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.01em]">As causas da nossa cidade</h3>
              </div>
              {hasFilter && <Button variant="ghost" onClick={() => onFilterChange({})}>Limpar filtros</Button>}
            </div>
            {hasFilter && <p className="mt-4 text-sm text-muted-foreground">Valores e edifícios seguem os filtros da cidade.</p>}

            {ongs.length === 0 ? (
              <p className="mt-8 text-muted-foreground">Nenhuma ONG disponível.</p>
            ) : (
              <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {ongs.map((ong) => {
                  const selected = filter.ongId === ong.id;
                  return (
                    <li key={ong.id} className="min-w-0">
                      <Card className={`h-full gap-5 px-5 ${selected ? "pixel-ink-verde bg-secondary" : ""}`}>
                        <div className="flex items-center justify-between gap-3 text-primary">
                          <PixelHeart className="size-5" />
                          {selected && <Badge variant="muted">Selecionada</Badge>}
                        </div>
                        <h4 className="break-words text-xl font-semibold tracking-[-0.01em]">{ong.name}</h4>
                        <p className="mt-auto text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground">{(summary.ongCounts.get(ong.id) ?? 0).toLocaleString("pt-BR")}</span>{" "}
                          {(summary.ongCounts.get(ong.id) ?? 0) === 1 ? "edifício apoiando" : "edifícios apoiando"}
                        </p>
                        <Button
                          variant="ghost"
                          aria-pressed={selected}
                          data-active={selected}
                          aria-label={`Ver contribuições para ${ong.name}`}
                          className="menu-cursor w-full justify-start pl-6"
                          onClick={() => onFilterChange({ ...filter, ongId: selected ? undefined : ong.id })}
                        >
                          {selected ? "Mostrar todas as ONGs" : "Ver contribuições"}
                        </Button>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-6 text-sm text-muted-foreground">Um edifício pode apoiar mais de uma ONG.</p>

            <div className="mt-16 border-t pt-10">
              <p className="mono-label text-primary">Contribuições</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.01em]">Os edifícios e suas causas</h3>
              <p className="mt-3 text-sm text-muted-foreground">O valor de cada edifício reúne suas contribuições.</p>
              {pageDonations.length === 0 ? (
                <p className="mt-8 pixel bevel-edge bg-card px-6 py-8 text-muted-foreground">
                  {hasFilter ? "Nenhum edifício encontrado com estes filtros." : "Nenhuma contribuição ainda."}
                </p>
              ) : (
                <ul className="mt-8 divide-y divide-border">
                  {pageDonations.map((donation) => {
                    const city = cityById.get(donation.cityId);
                    const beneficiaries = donation.ongIds.map((id) => ongById.get(id)?.name).filter(Boolean);
                    return (
                      <li key={donation.id} className="grid items-center gap-4 py-6 sm:grid-cols-[1fr_auto]">
                        <div className="min-w-0">
                          <p className="mono-label flex items-center gap-2 text-primary"><PixelBuilding />Edifício #{donation.id}</p>
                          <p className="mt-2 text-2xl font-semibold tracking-[-0.01em]">{formatBRL(donation.value)}</p>
                          {city && <p className="mt-1 text-sm text-muted-foreground">{city.name} · {city.uf}</p>}
                          <p className="mt-2 break-words text-sm">{beneficiaries.join(", ") || "ONG não informada"}</p>
                        </div>
                        <Button
                          variant="outline"
                          className="justify-self-start sm:justify-self-end"
                          aria-label={`Ver informações do edifício #${donation.id} na cidade`}
                          onClick={() => onOpenDonation(donation.id)}
                        >Ver na cidade<PixelArrow /></Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {totalPages > 1 && (
                <Pagination aria-label="Páginas de contribuições" className="mt-8">
                  <PaginationContent>
                    <PaginationItem><PaginationPrevious disabled={page === 1} onClick={() => setPagination({ donations, page: page - 1 })} /></PaginationItem>
                    <PaginationItem><span aria-live="polite" className="px-3 font-mono text-xs">{page} de {totalPages.toLocaleString("pt-BR")}</span></PaginationItem>
                    <PaginationItem><PaginationNext disabled={page === totalPages} onClick={() => setPagination({ donations, page: page + 1 })} /></PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
