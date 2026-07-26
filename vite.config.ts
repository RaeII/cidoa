import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * O manifesto de texturas casa PNG/JPG **e** .ktx2 no mesmo glob (o PNG é o
 * fallback pra pasta que ainda não passou pelo `npm run textures:ktx2`). O Rollup
 * emite todo arquivo que o glob referencia, então a fonte já superada iria pro
 * dist como peso morto — nunca baixada, mas ocupando o deploy. Aqui ela sai.
 *
 * A condição espelha a do manifesto: existindo o .ktx2 do mesmo mapa, o PNG/JPG
 * não é mais alcançável em runtime.
 */
function dropTexturesSupersededByKtx2(): Plugin {
  return {
    name: "drop-textures-superseded-by-ktx2",
    generateBundle(_options, bundle) {
      const stems = new Set<string>();
      for (const asset of Object.values(bundle)) {
        if (asset.type === "asset" && asset.name?.endsWith(".ktx2")) {
          stems.add(asset.name.slice(0, -".ktx2".length));
        }
      }
      const dropped: string[] = [];
      for (const [key, asset] of Object.entries(bundle)) {
        if (asset.type !== "asset" || !asset.name) continue;
        const match = /^(.*)\.(png|jpe?g)$/i.exec(asset.name);
        if (match && stems.has(match[1])) {
          dropped.push(asset.name);
          delete bundle[key];
        }
      }
      // Sem log, um drop indevido (algum módulo importando a fonte direto, não
      // pelo manifesto) sumiria em silêncio e viraria 404 só em produção.
      if (dropped.length) {
        this.info(`substituídos por .ktx2, fora do dist: ${dropped.join(", ")}`);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dropTexturesSupersededByKtx2()],
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
