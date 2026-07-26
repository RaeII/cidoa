---
title: Admin · Personalizações
tags:
  - admin
  - customization
aliases:
  - personalizacoes
---

# Admin · Personalizações

Página de gestão do catálogo de personalizações da cena. Rota `/dale/personalizacoes`.

**Arquivo:** [`src/pages/admin/Customizations.tsx`](../../src/pages/admin/Customizations.tsx) · client em [`src/api/admin/admin.routes.ts`](../../src/api/admin/admin.routes.ts).

## O que faz

Carrega a árvore completa (`GET /admin/customization`, inclui inativas) e renderiza categorias top-level; **Customização** aninha subcategorias (Letreiro/Topo/LED/Holograma).

Por opção:
- **Ativa/Inativa** — toggle (`PUT /admin/customization/options/:id`). Desativada some da cena.
- **Editar** — dialog: label + value (hex, se Cor/Textura).
- **Excluir** — só se **não** presa a código (`DELETE`). Presas a código (🔒 Formato/Topo/LED) só desativam.

Por categoria:
- **Ativa/Inativa** — toggle (`PUT /admin/customization/categories/:id`). Serve pra ligar/desligar features (Letreiro/Holograma) e categorias inteiras.
- **Adicionar opção** — só em categoria extensível. **Cor** = dialog com hex.

## Textura: cadastradas × não-cadastradas

Categoria **Textura** não usa dialog de digitar caminho. Compara pastas do repo (`FACADE_TEXTURE_FOLDERS`, ver [[scene-textures]]) com o catálogo:

- **Cadastrada** = já é opção → usuário seleciona; admin controla (toggle/editar/excluir).
- **Não-cadastrada** = pasta no repo sem opção → linha tracejada + botão **Cadastrar** (`POST /admin/customization/options`, `value` = pasta, key = slug). Vira dado puro (`isCodeBound=false`) → depois dá pra excluir.

Textura nova = dropar pasta em `src/assets/texture/` + `npm run textures:ktx2` → aparece como não-cadastrada, sem editar código. Backend não valida asset (front só oferece pasta existente).

Textura cadastrada aparece em dois lugares: seletor **global** da cena ([[html-components#TextureControls.tsx|TextureControls]]) e seletor **por edifício** ([[html-components#BuildingCustomizePanel.tsx|BuildingCustomizePanel]], seção Textura).

## Regra-chave

Opção **presa a código** (`isCodeBound`) tem key travada a um builder do front — admin não cria/deleta, só toggle/edita label. Só **Cor** (e Textura-URL) é dado puro (`isExtensible`), CRUD livre. Liberação por doação/indicação (`unlockType`) é **estrutura futura** — sem UI ainda.

Backend + tabelas: [[personalizacoes|Módulo Personalizações (backend)]]. Consumo na cena: [[customization-api]].
