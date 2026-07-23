import { useEffect, useState } from "react";
import axios from "axios";
import {
  fetchCustomizationCatalog,
  type CustomizationCatalog,
} from "../../api/customizationApi";

/**
 * Carrega o catálogo de personalizações do backend uma vez no mount.
 * Enquanto `null`, o painel mostra estado de carregamento.
 */
export function useCustomizationCatalog(): CustomizationCatalog | null {
  const [catalog, setCatalog] = useState<CustomizationCatalog | null>(null);

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

  return catalog;
}
