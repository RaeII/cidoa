import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { Check, LockKeyhole, Loader2 } from "lucide-react";
import { Tabs } from "radix-ui";
import type { CatalogOption, CustomizationCatalog } from "@/api/customizationApi";
import { formatUnlockCta } from "@/lib/unlock";
import { cn } from "@/lib/utils";
import type { BuildingCustomization, BuildingShape, EdgeLightType, RooftopType, TextureSettings } from "@/scene/types";
import { CustomizationImage } from "./CustomizationImage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Preview = lazy(() => import("@/components/three/BuildingPreview").then((module) => ({ default: module.BuildingPreview })));
const CATEGORIES = [
  { key: "shape", label: "Formato", field: "shapes" },
  { key: "color", label: "Cor", field: "colors" },
  { key: "texture", label: "Fachada", field: "textures" },
  { key: "rooftop", label: "Topo", field: "rooftops" },
  { key: "edge_light", label: "LED", field: "edgeLights" },
] as const;

function OptionCard({ category, option, selected, onSelect }: {
  category: string;
  option: CatalogOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const requirementId = useId();
  const locked = option.isUnlocked === false;
  return (
    <button type="button" disabled={locked} onClick={onSelect} aria-pressed={selected}
      aria-describedby={locked ? requirementId : undefined}
      className={cn("relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed", selected ? "border-primary ring-2 ring-primary/20" : "border-border enabled:hover:border-primary/50")}>
      <div className={cn("relative grid h-28 place-items-center border-b bg-radial from-primary/10 to-transparent p-3 sm:h-32", locked && "opacity-50")}>
        <CustomizationImage categoryKey={category} optionKey={option.key} value={option.value} />
        {selected && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check aria-hidden className="size-4" /></span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <span className="text-sm font-semibold break-words">{option.label}</span>
        <span className={cn("flex items-center gap-1.5 text-xs font-medium", locked ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400")}>
          {locked ? <LockKeyhole aria-hidden className="size-3.5 shrink-0" /> : <Check aria-hidden className="size-3.5 shrink-0" />}
          {locked ? "Bloqueado" : selected ? "Em uso" : "Disponível"}
        </span>
        {locked && <span id={requirementId} className="text-xs leading-5 text-muted-foreground">{formatUnlockCta(option.unlock)}</span>}
      </div>
    </button>
  );
}

/** Editor de aparência reutilizável: catálogo e persistência pertencem ao chamador. */
export function BuildingCustomizer({ catalog, customization, textureSettings, onChange, onBusyChange }: {
  catalog: CustomizationCatalog | null;
  customization: BuildingCustomization;
  textureSettings: TextureSettings;
  onChange: (patch: Partial<BuildingCustomization>) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [category, setCategory] = useState("shape");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const readerRef = useRef<FileReader | null>(null);
  useEffect(() => { onBusyChange?.(imageBusy); }, [imageBusy, onBusyChange]);
  useEffect(() => () => { readerRef.current?.abort(); onBusyChange?.(false); }, [onBusyChange]);
  const categories = CATEGORIES.filter((item) => (catalog?.[item.field].length ?? 0) > 0);
  const activeCategory = categories.some((item) => item.key === category) || catalog?.features[category as "sign" | "hologram"] ? category : categories[0]?.key ?? (catalog?.features.sign ? "sign" : "hologram");
  const select = (key: string, option: CatalogOption) => {
    if (option.isUnlocked === false) return;
    if (key === "shape") onChange({ buildingShape: option.key as BuildingShape });
    if (key === "color" && option.value) onChange({ color: option.value });
    if (key === "texture") onChange({ textureKey: option.value });
    if (key === "rooftop") onChange({ rooftopType: option.key as RooftopType });
    if (key === "edge_light") onChange({ edgeLightType: option.key as EdgeLightType });
  };
  const selected = (key: string, option: CatalogOption) => {
    if (key === "shape") return customization.buildingShape === option.key;
    if (key === "color") return customization.color.toLowerCase() === option.value?.toLowerCase();
    if (key === "texture") return customization.textureKey === option.value;
    if (key === "rooftop") return customization.rooftopType === option.key;
    return customization.edgeLightType === option.key;
  };
  async function uploadHologram(file: File | undefined) {
    if (!file || catalog?.features.hologram?.isUnlocked === false) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 700 * 1024) {
      setImageError("Use PNG, JPG, WebP ou GIF de até 700 KB.");
      return;
    }
    setImageBusy(true);
    setImageError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        readerRef.current = reader;
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error());
        reader.onerror = () => reject(reader.error);
        reader.onabort = () => reject(new DOMException("Leitura cancelada", "AbortError"));
        reader.readAsDataURL(file);
      });
      onChange({ hologramImage: dataUrl });
    } catch {
      setImageError("Não foi possível ler a imagem. Tente de novo.");
    } finally {
      setImageBusy(false);
    }
  }
  return (
    <section aria-label="Personalizar seu edifício" className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
      <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-0 lg:h-[100cqh] lg:min-h-0">
        <Suspense fallback={<div role="status" className="grid h-48 max-h-[calc(100cqh-2.5rem)] place-items-center rounded-2xl bg-muted sm:h-80 lg:h-auto lg:max-h-none lg:min-h-0 lg:flex-1"><Loader2 aria-hidden className="size-6 animate-spin" /><span className="sr-only">Carregando prévia 3D…</span></div>}>
          <Preview customization={customization} textureSettings={textureSettings} />
        </Suspense>
        <p className="shrink-0 text-center text-xs text-muted-foreground">As mudanças de aparência são salvas automaticamente.</p>
      </div>
      <div className="min-w-0">
        {!catalog ? <p role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-4 animate-spin" />Carregando personalizações…</p> : (
          <Tabs.Root value={activeCategory} onValueChange={setCategory} className="space-y-3">
            <Tabs.List aria-label="Categorias de personalização" className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
              {[...categories, ...(catalog.features.sign ? [{ key: "sign", label: "Letreiro" }] : []), ...(catalog.features.hologram ? [{ key: "hologram", label: "Holograma" }] : [])].map((item) => (
                <Tabs.Trigger key={item.key} value={item.key} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:min-h-10">{item.label}</Tabs.Trigger>
              ))}
            </Tabs.List>
            {categories.map((item) => {
              const options = catalog[item.field];
              const defaults = item.key === "texture" ? [{ id: -1, key: "default", label: "Padrão", value: null, sortOrder: -1, unlock: null, isUnlocked: true }] : [];
              return <Tabs.Content key={item.key} value={item.key} className="space-y-4 outline-none">
                <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{item.label}</h3><span className="text-xs text-muted-foreground">{options.filter((option) => option.isUnlocked !== false).length + defaults.length} disponíveis</span></div>
                <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {[...defaults, ...options].map((option) => <OptionCard key={option.id} category={item.key} option={option} selected={selected(item.key, option)} onSelect={() => select(item.key, option)} />)}
                </div>
              </Tabs.Content>;
            })}
            {(["sign", "hologram"] as const).map((key) => {
              const feature = catalog.features[key];
              if (!feature) return null;
              const locked = feature.isUnlocked === false;
              return <Tabs.Content key={key} value={key} className="space-y-4 outline-none">
                <div className="rounded-2xl border bg-card p-4">
                  <div className="flex items-center gap-4"><div className="size-16 shrink-0"><CustomizationImage categoryKey={key} /></div><div><h3 className="font-semibold">{key === "sign" ? "Letreiro" : "Holograma"}</h3><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">{locked && <LockKeyhole aria-hidden className="size-3.5" />}{locked ? "Bloqueado" : "Disponível"}</p></div></div>
                  {locked && <p className="mt-3 text-sm text-muted-foreground">{formatUnlockCta(feature.unlock)}</p>}
                </div>
                <fieldset disabled={locked || imageBusy} className="space-y-4 disabled:opacity-50">
                  {key === "sign" ? <>
                    <label className="block space-y-2 text-sm font-medium">Texto do letreiro<Input maxLength={30} value={customization.signText} onChange={(event) => onChange({ signText: event.target.value })} placeholder="Marca ou empresa" /></label>
                    <label className="block space-y-2 text-sm font-medium">Lados visíveis<select value={customization.signSides} onChange={(event) => onChange({ signSides: Number(event.target.value) })} className="h-11 w-full rounded-xl border border-input bg-background px-3">{[1, 2, 3, 4].map((sides) => <option key={sides} value={sides}>{sides} {sides === 1 ? "lado" : "lados"}</option>)}</select></label>
                  </> : <>
                    <label className="block space-y-2 text-sm font-medium">Imagem ou GIF<Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { void uploadHologram(event.target.files?.[0]); event.target.value = ""; }} /><span className="block text-xs font-normal text-muted-foreground">PNG, JPG, WebP ou GIF. Até 700 KB.</span></label>
                    {imageBusy && <p role="status" className="text-sm text-muted-foreground">Lendo imagem…</p>}
                    {customization.hologramImage && <>
                      <img src={customization.hologramImage} alt="Imagem do holograma" className="h-24 w-full rounded-xl border bg-muted object-contain" />
                      <Button type="button" variant="outline" onClick={() => onChange({ hologramImage: null })}>Remover imagem</Button>
                      <label className="flex items-center justify-between gap-3 text-sm font-medium">Cor do holograma<input type="color" value={customization.hologramColor} onChange={(event) => onChange({ hologramColor: event.target.value })} className="h-10 w-16 rounded border" /></label>
                      <label className="block space-y-2 text-sm font-medium">Opacidade · {Math.round(customization.hologramOpacity * 100)}%<input type="range" min={0} max={1} step={0.01} value={customization.hologramOpacity} onChange={(event) => onChange({ hologramOpacity: Number(event.target.value) })} className="block w-full accent-primary" /></label>
                    </>}
                  </>}
                </fieldset>
                {key === "hologram" && imageError && <p role="alert" className="text-sm text-destructive">{imageError}</p>}
              </Tabs.Content>;
            })}
            {!categories.length && !catalog.features.sign && !catalog.features.hologram && <p className="py-8 text-sm text-muted-foreground">Nenhuma personalização disponível.</p>}
          </Tabs.Root>
        )}
      </div>
    </section>
  );
}
