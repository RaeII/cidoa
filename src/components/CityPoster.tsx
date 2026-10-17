import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Pôster estático da cidade (public/city-poster-*.webp) na área da cena até o
 * 1º frame do 3D. Mesma caixa e mesmas URLs do pôster do index.html: a troca
 * HTML → React → canvas não pisca nem desloca layout. `hidden` faz fade por
 * opacity; terminado o fade, desmonta e não volta (rebuilds usam só o overlay).
 */
export function CityPoster({ hidden = false }: { hidden?: boolean }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <picture>
      <source media="(orientation: portrait)" srcSet="/city-poster-portrait.webp" />
      <img
        src="/city-poster-landscape.webp"
        alt=""
        onTransitionEnd={() => setGone(true)}
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-screen w-full object-cover transition-opacity duration-500",
          hidden && "opacity-0",
        )}
      />
    </picture>
  );
}
