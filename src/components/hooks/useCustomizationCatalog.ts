import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { canUseCustomization } from "@/lib/unlock";
import {
  fetchCustomizationCatalog,
  fetchMyUnlocks,
  type MyUnlocks,
  type CatalogOption,
  type CatalogFeature,
  type CustomizationCatalog,
} from "../../api/customizationApi";

/**
 * Carrega o catálogo de personalizações do backend uma vez no mount.
 * Enquanto `null`, o painel mostra estado de carregamento.
 */
export function useCustomizationCatalog(): CustomizationCatalog | null {
  const { user, isAdmin } = useAuth();
  const userId = user?.id;
  const [catalog, setCatalog] = useState<CustomizationCatalog | null>(null);
  const [unlocks, setUnlocks] = useState<{ userId: number; data: MyUnlocks } | null>(null);

  useEffect(() => {
    if (!userId || isAdmin) return;
    const controller = new AbortController();
    fetchMyUnlocks({ signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setUnlocks({ userId, data });
    }).catch((err: unknown) => {
      if (!controller.signal.aborted && !axios.isCancel(err)) console.error("Falha ao carregar benefícios", err);
    });
    return () => controller.abort();
  }, [userId, isAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCustomizationCatalog({ signal: controller.signal })
      .then(setCatalog)
      .catch((err: unknown) => {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        console.error("Falha ao carregar catálogo de personalizações", err);
      });
    return () => controller.abort();
  }, []);

  if (!catalog) return null;
  // Nunca reaproveita benefícios de outra sessão durante login/logout.
  const mine = userId && unlocks?.userId === userId ? unlocks.data : null;
  const options = (items: CatalogOption[]) => items.map((item) => ({
    ...item, isUnlocked: canUseCustomization(item.unlock, mine?.progress ?? null, !!mine?.unlockedOptionIds.includes(item.id), isAdmin),
  }));
  const feature = (key: string, item: CatalogFeature | null): CatalogFeature | null => item && ({
    ...item, isUnlocked: canUseCustomization(item.unlock, mine?.progress ?? null, !!mine?.unlockedCategoryKeys.includes(key), isAdmin),
  });
  return {
    shapes: options(catalog.shapes), colors: options(catalog.colors), textures: options(catalog.textures),
    rooftops: options(catalog.rooftops), edgeLights: options(catalog.edgeLights),
    features: { sign: feature("sign", catalog.features.sign), hologram: feature("hologram", catalog.features.hologram) },
  };
}
