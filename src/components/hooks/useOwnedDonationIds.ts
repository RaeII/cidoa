import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyDonationIds } from "../../api/donationApi";

const EMPTY = new Set<number>();

/**
 * Doações da sessão atual. Vazio sem login, durante a carga ou em erro — na
 * dúvida o edifício fica só-leitura, nunca editável por engano.
 */
export function useOwnedDonationIds(): {
  ids: ReadonlySet<number>;
  /** Pagamento confirmado: o edifício já é do usuário antes de recarregar a lista. */
  addOwned: (donationId: number) => void;
} {
  const { user } = useAuth();
  const userId = user?.id;
  const [owned, setOwned] = useState<{ userId: number; ids: Set<number> } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    fetchMyDonationIds({ signal: controller.signal })
      .then((ids) => {
        if (!controller.signal.aborted) setOwned({ userId, ids: new Set(ids) });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        console.error("Falha ao carregar suas doações", err);
      });
    return () => controller.abort();
  }, [userId]);

  const addOwned = useCallback(
    (donationId: number) => {
      if (!userId) return;
      setOwned((prev) => ({
        userId,
        ids: new Set(prev?.userId === userId ? prev.ids : []).add(donationId),
      }));
    },
    [userId],
  );

  // Nunca reaproveita a lista de outra sessão durante login/logout.
  return { ids: userId && owned?.userId === userId ? owned.ids : EMPTY, addOwned };
}
