import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * O manifesto de texturas casa PNG/JPG **e** .ktx2 no mesmo glob, e o PNG/JPG ganha
 * (Basis é lossy e o artefato aparece no normal map). O Rollup emite todo arquivo que
 * o glob referencia, então o .ktx2 superado iria pro dist como peso morto — nunca
 * baixado, mas ocupando o deploy. Aqui ele sai.
 *
 * A condição espelha a do manifesto: existindo o PNG/JPG do mesmo mapa, o .ktx2 não é
 * mais alcançável em runtime.
 */
function dropKtx2SupersededByTextures(): Plugin {
  return {
    name: "drop-ktx2-superseded-by-textures",
    generateBundle(_options, bundle) {
      const stems = new Set<string>();
      for (const asset of Object.values(bundle)) {
        if (asset.type !== "asset" || !asset.name) continue;
        const match = /^(.*)\.(png|jpe?g)$/i.exec(asset.name);
        if (match) stems.add(match[1]);
      }
      const dropped: string[] = [];
      for (const [key, asset] of Object.entries(bundle)) {
        if (asset.type !== "asset" || !asset.name?.endsWith(".ktx2")) continue;
        if (!stems.has(asset.name.slice(0, -".ktx2".length))) continue;
        dropped.push(asset.name);
        delete bundle[key];
      }
      // Sem log, um drop indevido (algum módulo importando o .ktx2 direto, não pelo
      // manifesto) sumiria em silêncio e viraria 404 só em produção.
      if (dropped.length) {
        this.info(`substituídos por PNG/JPG, fora do dist: ${dropped.join(", ")}`);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dropKtx2SupersededByTextures()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Back local (PORT=3000 no .env do cidoa_back). Same-origin em dev = sem CORS.
      // Produção: reverse proxy (nginx) servindo /api same-origin, ou VITE_API_URL.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
