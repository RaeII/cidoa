import { lazy, Suspense, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { AlertDialog, Tabs } from "radix-ui";
import type { BuildingProfile } from "@/api/contributionApi";
import type { CustomizationCatalog } from "@/api/customizationApi";
import type { BuildingCustomization, TextureSettings } from "@/scene/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BuildingProfileForm } from "./donate/BuildingProfileForm";
import { cn } from "@/lib/utils";

const BuildingCustomizer = lazy(() => import("@/components/customization/BuildingCustomizer").then((module) => ({ default: module.BuildingCustomizer })));
const scrollClass = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 outline-none sm:px-8 lg:px-10";
const footerClass = "shrink-0 space-y-2 border-t bg-background px-5 py-2 sm:px-8 lg:px-10";

export function BuildingManageDialog({
  donationId,
  catalog,
  customization,
  textureSettings,
  onCustomizationChange,
  onSaved,
  onClose,
}: {
  donationId: number;
  catalog: CustomizationCatalog | null;
  customization: BuildingCustomization;
  textureSettings: TextureSettings;
  onCustomizationChange: (donationId: number, patch: Partial<BuildingCustomization>) => void;
  onSaved: (donationId: number, profile: BuildingProfile) => void;
  onClose: () => void;
}) {
  const profileFormId = useId();
  const [buildingTab, setBuildingTab] = useState("information");
  const [profileEdit, setProfileEdit] = useState({ dirty: false, busy: false, ready: false, error: null as string | null });
  const [appearanceBusy, setAppearanceBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const editBusy = profileEdit.busy || appearanceBusy;

  function leaveProfile() {
    if (editBusy) return;
    if (profileEdit.dirty) setConfirmExit(true);
    else onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && leaveProfile()}>
      <DialogContent
        className="flex h-[min(50rem,calc(100dvh-1rem))] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 text-foreground sm:h-[min(50rem,calc(100dvh-3rem))] sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-3xl sm:p-0 lg:max-w-6xl"
        aria-describedby={undefined}
        showCloseButton={!editBusy}
        onEscapeKeyDown={(event) => { if (editBusy) event.preventDefault(); }}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 px-5 pb-3 pt-3 pr-12 text-left sm:px-8 sm:pt-4 sm:pr-12 lg:px-10 lg:pr-14">
          <DialogTitle className="text-xl">Administrar edifício</DialogTitle>
        </DialogHeader>
        <Tabs.Root value={buildingTab} onValueChange={setBuildingTab} className="flex min-h-0 flex-1 flex-col">
          <Tabs.List aria-label="Editar edifício" className="mx-5 grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:mx-8 lg:mx-10">
            <Tabs.Trigger value="information" disabled={editBusy} className="min-h-11 rounded-lg px-4 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:min-h-10">Informações</Tabs.Trigger>
            <Tabs.Trigger value="appearance" disabled={editBusy} className="min-h-11 rounded-lg px-4 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:min-h-10">Aparência</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="information" forceMount className={cn(scrollClass, "data-[state=inactive]:hidden")}>
            <BuildingProfileForm
              id={profileFormId}
              donationId={donationId}
              showActions={false}
              disabled={appearanceBusy}
              submitLabel="Salvar"
              onDone={(profile) => {
                onSaved(donationId, profile);
                onClose();
              }}
              onSkip={leaveProfile}
              onEditStateChange={setProfileEdit}
            />
          </Tabs.Content>
          <Tabs.Content value="appearance" className={cn(scrollClass, "[container-type:size]")}>
            <Suspense fallback={<p role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-5 animate-spin" />Carregando personalização…</p>}>
              <BuildingCustomizer
                catalog={catalog}
                customization={customization}
                textureSettings={textureSettings}
                onChange={(patch) => onCustomizationChange(donationId, patch)}
                onBusyChange={setAppearanceBusy}
              />
            </Suspense>
          </Tabs.Content>
          <div className={footerClass}>
            {profileEdit.error && (profileEdit.ready || buildingTab === "appearance") && <p role="alert" className="text-sm text-destructive">{profileEdit.error}{!profileEdit.ready && " Tente novamente na aba Informações."}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="ghost" className="h-11 rounded-xl sm:h-10" disabled={editBusy} onClick={leaveProfile}>Ver na cidade</Button>
              <Button type="submit" form={profileFormId} className="h-11 rounded-xl sm:h-10 sm:min-w-44" disabled={!profileEdit.ready || editBusy}>
                {profileEdit.busy && <Loader2 aria-hidden="true" className="animate-spin" />}
                {profileEdit.busy ? "Aguarde…" : "Salvar"}
              </Button>
            </div>
          </div>
        </Tabs.Root>
        <AlertDialog.Root open={confirmExit} onOpenChange={setConfirmExit}>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/60" />
            <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border bg-background p-6 text-foreground shadow-xl">
              <AlertDialog.Title className="text-lg font-semibold">Sair sem salvar?</AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-muted-foreground">As alterações no nome, na descrição e na imagem serão descartadas.</AlertDialog.Description>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <AlertDialog.Cancel asChild><Button variant="outline" className="h-11 rounded-xl">Continuar editando</Button></AlertDialog.Cancel>
                <AlertDialog.Action asChild><Button className="h-11 rounded-xl" onClick={onClose}>Sair sem salvar</Button></AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </DialogContent>
    </Dialog>
  );
}
