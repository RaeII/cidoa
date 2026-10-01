import { Building2, Check, Lock, LogOut, MapPin, Moon, Palette, Share2, Sun, UserRound, Users } from "lucide-react";
import { Dialog as DialogPrimitive, Tabs } from "radix-ui";
import type { CatalogFeature, CatalogOption, CustomizationCatalog } from "@/api/customizationApi";
import type { ReferralSummary } from "@/api/referral/referral.types";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL, formatUnlockRequirement } from "@/lib/unlock";
import { CustomizationImage } from "@/components/customization/CustomizationImage";
import { ProfilePanel } from "@/components/ProfilePanel";
import { ReferralPerson } from "@/components/referral/ReferralPerson";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

/** Doação própria já resolvida p/ exibição. `inScene` = passa no filtro/teto atual da cena. */
export type MyDonation = {
  id: number;
  value: number;
  ongName?: string;
  place?: string;
  inScene: boolean;
};

type GameMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  night: boolean;
  onNightChange: (night: boolean) => void;
  donations: readonly MyDonation[];
  catalog: CustomizationCatalog | null;
  /** Foca o edifício na cena e abre o card de info (mesmo caminho do clique). */
  onOpenDonation: (donationId: number) => void;
  referralSummary: ReferralSummary | null;
  referralError: string | null;
  onShareReferral: () => void;
};

// Vocabulário visual da cena (vidro escuro, cantos suaves, dourado da marca) na estrutura do menu de pausa do GTA V.
const glass = "border border-white/10 bg-black/60 shadow-2xl backdrop-blur-xl";
const tabClass =
  "group flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium whitespace-nowrap text-white/60 transition-colors outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#c9a86a]/70 data-[state=active]:bg-white data-[state=active]:text-[#05111d] data-[state=active]:shadow-md [&_svg]:size-4 [&_svg]:shrink-0";
// Inativa no celular mostra só o ícone; o nome volta no sm+.
const tabLabel = "hidden group-data-[state=active]:inline sm:inline";
const panelClass = "min-h-0 flex-1 overflow-y-auto px-4 py-5 outline-none sm:px-8 sm:py-7";
const pillButton =
  "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[#c9a86a]/70 focus-visible:outline-none";
const goldButton =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#c9a86a]/40 bg-[#c9a86a]/10 px-3.5 text-sm font-medium text-[#e4c98b] transition-colors hover:bg-[#c9a86a]/20 focus-visible:ring-2 focus-visible:ring-[#c9a86a]/70 focus-visible:outline-none [&_svg]:size-4";

type UnlockItem = {
  key: string;
  label: string;
  categoryKey: string;
  optionKey?: string;
  value?: string | null;
  unlock: CatalogOption["unlock"];
  isUnlocked?: boolean;
};

/** Catálogo → grupos da aba. "default"/"none" não são recompensa (mesmo corte do passe no admin). */
function catalogGroups(catalog: CustomizationCatalog): { title: string; items: UnlockItem[] }[] {
  const options = (categoryKey: string, list: CatalogOption[]) =>
    list
      .filter((option) => option.key !== "default" && option.key !== "none")
      .map((option) => ({ ...option, key: `${categoryKey}:${option.id}`, categoryKey, optionKey: option.key }));
  const feature = (categoryKey: string, label: string, item: CatalogFeature | null) =>
    item ? [{ ...item, key: categoryKey, label, categoryKey }] : [];
  return [
    { title: "Formatos", items: options("shape", catalog.shapes) },
    { title: "Topos", items: options("rooftop", catalog.rooftops) },
    { title: "LED de arestas", items: options("edge_light", catalog.edgeLights) },
    { title: "Cores", items: options("color", catalog.colors) },
    { title: "Texturas", items: options("texture", catalog.textures) },
    {
      title: "Recursos",
      items: [
        ...feature("sign", "Letreiro", catalog.features.sign),
        ...feature("hologram", "Holograma", catalog.features.hologram),
      ],
    },
  ].filter((group) => group.items.length > 0);
}

/** Menu do usuário logado, inspirado no menu de pausa do GTA V. */
export function GameMenu({
  open,
  onOpenChange,
  night,
  onNightChange,
  donations,
  catalog,
  onOpenDonation,
  referralSummary,
  referralError,
  onShareReferral,
}: GameMenuProps) {
  const { user, logout } = useAuth();
  if (!user) return null;

  const displayName = user.name?.trim() || user.username;
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const nightLabel = night ? "Modo dia" : "Modo noite";
  const totalDonated = donations.reduce((sum, donation) => sum + donation.value, 0);
  const groups = catalog ? catalogGroups(catalog) : [];
  const unlockedCount = groups.reduce((n, g) => n + g.items.filter((item) => item.isUnlocked).length, 0);
  const itemCount = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Tinta + blur que entram em fade: a cena "muda de cor" ao abrir, como a pausa do GTA. */}
        <DialogOverlay className="bg-[#04283d]/55 backdrop-blur-md backdrop-saturate-50 duration-500" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="dark fixed top-1/2 left-1/2 z-50 flex h-[min(42rem,calc(100svh-2rem))] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 text-white outline-none duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <header className="flex items-center justify-between gap-4">
            <DialogTitle className="text-3xl font-black tracking-tight uppercase italic drop-shadow-lg sm:text-4xl">
              Cidoa
            </DialogTitle>
            <div className={`flex min-w-0 items-center gap-3 rounded-full py-1.5 pr-1.5 pl-1.5 sm:pl-4 ${glass}`}>
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="truncate text-xs text-white/60">@{user.username}</p>
              </div>
              <Avatar className="size-10 ring-2 ring-[#c9a86a]/60">
                {user.profile_image && <AvatarImage src={user.profile_image} alt="" className="object-cover" />}
                <AvatarFallback className="bg-white/10 text-sm font-semibold text-white">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-[#c9a86a]/70 focus-visible:outline-none [&_svg]:size-[18px]"
                onClick={() => onNightChange(!night)}
                title={nightLabel}
                aria-label={nightLabel}
              >
                {night ? <Sun /> : <Moon />}
              </button>
            </div>
          </header>

          <Tabs.Root defaultValue="profile" className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl ${glass}`}>
            <Tabs.List aria-label="Seções do menu" className="m-2 flex gap-1 rounded-2xl bg-white/5 p-1">
              <Tabs.Trigger value="profile" className={tabClass} title="Perfil">
                <UserRound /><span className={tabLabel}>Perfil</span>
              </Tabs.Trigger>
              <Tabs.Trigger value="donations" className={tabClass} title="Doações">
                <Building2 /><span className={tabLabel}>Doações</span>
              </Tabs.Trigger>
              <Tabs.Trigger value="customizations" className={tabClass} title="Personalizações">
                <Palette /><span className={tabLabel}>Personalizações</span>
              </Tabs.Trigger>
              {!user.is_admin && (
                <Tabs.Trigger value="referral" className={tabClass} title="Indicações">
                  <Users /><span className={tabLabel}>Indicações</span>
                </Tabs.Trigger>
              )}
            </Tabs.List>

            <Tabs.Content value="profile" className={`${panelClass} flex flex-col`}>
              <ProfilePanel />
            </Tabs.Content>

            <Tabs.Content value="donations" className={panelClass}>
              <div className="mx-auto max-w-2xl">
                <p className="mb-5 text-white/60">
                  <span className="block text-3xl font-semibold tracking-tight text-white">{formatBRL(totalDonated)}</span>
                  doados em {donations.length} {donations.length === 1 ? "edifício" : "edifícios"}
                </p>
                {donations.length === 0 ? (
                  <p className="rounded-2xl bg-white/5 px-4 py-8 text-center text-sm text-white/60">
                    Nenhuma doação ainda.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {donations.map((donation) => (
                      <li key={donation.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 pr-4 transition-colors hover:bg-white/[0.08]">
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#c9a86a]/10 text-[#c9a86a]">
                          <Building2 className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{formatBRL(donation.value)}</p>
                          <p className="line-clamp-2 text-sm text-white/60 sm:truncate">
                            {[donation.ongName, donation.place].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {donation.inScene ? (
                          <button
                            type="button"
                            className={goldButton}
                            onClick={() => {
                              onOpenChange(false);
                              onOpenDonation(donation.id);
                            }}
                          >
                            <MapPin />
                            <span className="hidden sm:inline">Ver na cidade</span>
                            <span className="sr-only sm:hidden">Ver na cidade</span>
                          </button>
                        ) : (
                          <span className="shrink-0 text-xs text-white/50">Fora do filtro</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Tabs.Content>

            <Tabs.Content value="customizations" className={panelClass}>
              {!catalog ? (
                <p role="status" className="text-center text-sm text-white/60">Carregando…</p>
              ) : (
                <div className="space-y-7">
                  <div className="flex items-center gap-4">
                    <p className="shrink-0 text-sm text-white/60">
                      <strong className="text-base text-white">{unlockedCount}</strong> de {itemCount} liberadas
                    </p>
                    <div
                      role="progressbar"
                      aria-label="Personalizações liberadas"
                      aria-valuemin={0}
                      aria-valuemax={itemCount}
                      aria-valuenow={unlockedCount}
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
                    >
                      <div
                        className="h-full rounded-full bg-[#c9a86a]"
                        style={{ width: `${itemCount ? (unlockedCount / itemCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  {groups.map((group) => (
                    <section key={group.title}>
                      <h3 className="mb-3 text-sm font-semibold text-white/90">{group.title}</h3>
                      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {group.items.map((item) => (
                          <li key={item.key} className="overflow-hidden rounded-2xl bg-white/5">
                            <div className={`h-24 bg-gradient-to-b from-white/[0.06] to-transparent p-3 ${item.isUnlocked ? "" : "opacity-40 grayscale"}`}>
                              <CustomizationImage categoryKey={item.categoryKey} optionKey={item.optionKey} value={item.value} />
                            </div>
                            <div className="px-3 pt-1 pb-3">
                              <p className="truncate text-sm font-medium" title={item.label}>{item.label}</p>
                              {item.isUnlocked ? (
                                <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-300">
                                  <Check className="size-3" />Liberado
                                </p>
                              ) : (
                                <p className="mt-1 flex items-start gap-1 text-xs text-white/60">
                                  <Lock className="mt-px size-3 shrink-0" />{formatUnlockRequirement(item.unlock)}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </Tabs.Content>

            {!user.is_admin && (
              <Tabs.Content value="referral" className={`${panelClass} flex flex-col`}>
                <div className="m-auto w-full max-w-md space-y-4 text-center">
                  {referralSummary && (
                    <>
                      <div className="rounded-3xl bg-white/5 px-6 py-7">
                        <p className="text-sm text-white/60">Seu código de indicação</p>
                        <p className="my-3 font-mono text-4xl font-semibold tracking-[0.2em] text-[#e4c98b]">
                          {referralSummary.code}
                        </p>
                        <Button type="button" className="rounded-full px-5" onClick={onShareReferral}>
                          <Share2 />
                          Compartilhar
                        </Button>
                      </div>
                      <p className="text-white/60">
                        <strong className="text-2xl font-semibold text-white">
                          {referralSummary.referral_count.toLocaleString("pt-BR")}
                        </strong>{" "}
                        {referralSummary.referral_count === 1 ? "pessoa indicada" : "pessoas indicadas"}
                      </p>
                    </>
                  )}
                  {referralSummary?.referrer && (
                    <ReferralPerson
                      label="Você foi indicado por"
                      person={referralSummary.referrer}
                      className="rounded-2xl border-0 bg-white/5 text-left"
                    />
                  )}
                  {referralError && <p role="alert" className="text-sm text-destructive">{referralError}</p>}
                  {!referralSummary && !referralError && (
                    <p role="status" className="text-sm text-white/60">Carregando…</p>
                  )}
                </div>
              </Tabs.Content>
            )}
          </Tabs.Root>

          <footer className="flex items-center justify-between gap-2">
            <button
              type="button"
              className={`${pillButton} ${glass} hover:text-red-300`}
              onClick={() => {
                onOpenChange(false);
                void logout();
              }}
            >
              <LogOut className="size-4" />
              Sair
            </button>
            <DialogClose className={`${pillButton} ${glass}`}>
              <kbd className="rounded-md border border-white/30 px-1.5 font-sans text-xs">Esc</kbd>
              Voltar
            </DialogClose>
          </footer>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
