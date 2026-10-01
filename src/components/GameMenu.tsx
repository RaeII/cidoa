import { Check, Lock, LogOut, MapPin, Moon, Share2, Sun, Users } from "lucide-react";
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

// Barra de abas no estilo do menu de pausa do GTA V: aba ativa branca com faixa colorida no topo.
const tabClass =
  "h-11 min-w-32 shrink-0 border-t-4 border-transparent bg-black/70 px-4 text-sm font-semibold tracking-wide text-white/75 uppercase transition-colors outline-none hover:bg-black/50 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-inset data-[state=active]:border-[#c9a86a] data-[state=active]:bg-white data-[state=active]:text-black";
const panelClass = "min-h-0 flex-1 overflow-y-auto bg-background/90 p-5 outline-none sm:p-6";
const hintButton =
  "flex h-9 items-center gap-2 bg-black/70 px-3 text-sm font-medium text-white/80 transition-colors hover:bg-black/50 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none";

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
          className="dark fixed top-1/2 left-1/2 z-50 flex h-[min(44rem,calc(100svh-2rem))] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 text-foreground outline-none duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <header className="flex items-end justify-between gap-4">
            <DialogTitle className="text-4xl font-black tracking-tight text-white uppercase italic drop-shadow-lg sm:text-5xl">
              Cidoa
            </DialogTitle>
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 text-right">
                <p className="truncate font-semibold text-white uppercase drop-shadow">{displayName}</p>
                <p className="truncate text-xs text-white/70">@{user.username}</p>
              </div>
              <Avatar className="size-12 rounded-none border-2 border-white/80">
                {user.profile_image && <AvatarImage src={user.profile_image} alt="" className="object-cover" />}
                <AvatarFallback className="rounded-none bg-black/70 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className={`${hintButton} size-12 justify-center px-0`}
                onClick={() => onNightChange(!night)}
                title={nightLabel}
                aria-label={nightLabel}
              >
                {night ? <Sun /> : <Moon />}
              </button>
            </div>
          </header>

          <Tabs.Root defaultValue="profile" className="flex min-h-0 flex-1 flex-col gap-1">
            <Tabs.List aria-label="Seções do menu" className="flex gap-1 overflow-x-auto">
              <Tabs.Trigger value="profile" className={`${tabClass} flex-1`}>Perfil</Tabs.Trigger>
              <Tabs.Trigger value="donations" className={`${tabClass} flex-1`}>Doações</Tabs.Trigger>
              <Tabs.Trigger value="customizations" className={`${tabClass} flex-1`}>Personalizações</Tabs.Trigger>
              {!user.is_admin && (
                <Tabs.Trigger value="referral" className={`${tabClass} flex-1`}>Indicações</Tabs.Trigger>
              )}
            </Tabs.List>

            <Tabs.Content value="profile" className={panelClass}>
              <ProfilePanel />
            </Tabs.Content>

            <Tabs.Content value="donations" className={panelClass}>
              <div className="mb-4 flex gap-8 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Total doado</p>
                  <p className="text-2xl font-semibold">{formatBRL(totalDonated)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Edifícios</p>
                  <p className="text-2xl font-semibold">{donations.length}</p>
                </div>
              </div>
              {donations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma doação ainda.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {donations.map((donation) => (
                    <li key={donation.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{formatBRL(donation.value)}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {[donation.ongName, donation.place].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {donation.inScene ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onOpenChange(false);
                            onOpenDonation(donation.id);
                          }}
                        >
                          <MapPin />
                          Ver na cidade
                        </Button>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">Fora do filtro</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Tabs.Content>

            <Tabs.Content value="customizations" className={panelClass}>
              {!catalog ? (
                <p role="status" className="text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{unlockedCount}</strong> de {itemCount} liberadas
                  </p>
                  {groups.map((group) => (
                    <section key={group.title}>
                      <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {group.title}
                      </h3>
                      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                        {group.items.map((item) => (
                          <li
                            key={item.key}
                            className={`border border-white/10 bg-white/5 ${item.isUnlocked ? "" : "opacity-60"}`}
                          >
                            <div className="h-24 p-2">
                              <CustomizationImage categoryKey={item.categoryKey} optionKey={item.optionKey} value={item.value} />
                            </div>
                            <div className="border-t border-white/10 px-2 py-1.5">
                              <p className="truncate text-sm font-medium">{item.label}</p>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                {item.isUnlocked ? <Check className="size-3 text-emerald-400" /> : <Lock className="size-3" />}
                                {item.isUnlocked ? "Liberado" : formatUnlockRequirement(item.unlock)}
                              </p>
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
              <Tabs.Content value="referral" className={panelClass}>
                <div className="max-w-lg space-y-4">
                  {referralSummary && (
                    <div className="flex items-center justify-between gap-3 border border-white/10 bg-white/5 p-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Código de indicação</p>
                        <p className="truncate font-mono text-lg font-semibold">{referralSummary.code}</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={onShareReferral}>
                        <Share2 />
                        Compartilhar
                      </Button>
                    </div>
                  )}
                  {referralSummary && (
                    <div className="flex items-center gap-3 border border-white/10 bg-white/5 p-3">
                      <Users className="size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Indicações realizadas</p>
                        <p className="text-sm font-semibold">
                          {referralSummary.referral_count.toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  )}
                  {referralSummary?.referrer && (
                    <ReferralPerson
                      label="Você foi indicado por"
                      person={referralSummary.referrer}
                      className="rounded-none border-white/10 bg-white/5"
                    />
                  )}
                  {referralError && <p role="alert" className="text-sm text-destructive">{referralError}</p>}
                  {!referralSummary && !referralError && (
                    <p role="status" className="text-sm text-muted-foreground">Carregando…</p>
                  )}
                </div>
              </Tabs.Content>
            )}
          </Tabs.Root>

          <footer className="flex items-center justify-between gap-2">
            <button
              type="button"
              className={hintButton}
              onClick={() => {
                onOpenChange(false);
                void logout();
              }}
            >
              <LogOut className="size-4" />
              Sair
            </button>
            <DialogClose className={hintButton}>
              <kbd className="border border-white/40 px-1.5 font-sans text-xs">Esc</kbd>
              Voltar
            </DialogClose>
          </footer>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
