---
title: Sistema de Design
tags:
  - cidoa
  - design-system
  - ui
aliases:
  - Design System
  - DS
---

# Sistema de Design

Regra visual de toda interface HTML do Cidoa (cena pública + `/dale`). Fonte: `Cidoe Design System.html` nesta pasta (v1.0, out 2026 — "Cidoe" no arquivo = Cidoa aqui). Cena 3D fora do escopo: canvas pinta próprio céu/chão.

> [!abstract] Ideia em uma linha
> Clareza de app financeiro (confiança) + detalhe pequeno e preciso de videogame 8 bits. Dinheiro sério, jogo = recompensa. Cidade 3D protagonista; interface só emoldura.

> [!important] Onde mora
> Tokens + utilitários: `src/index.css`. Primitivos: `src/components/ui/`. Ícones em pixel, gato/cachorro, carregando: `src/components/ui/pixel-icon.tsx`. Barra em blocos: `src/components/ui/block-bar.tsx`. Cursor de pata + padrão de pegadas: `src/assets/ui/`. Fontes: `index.html`.

## Princípios

| | Regra | Na prática |
|---|---|---|
| A · Confiança primeiro | Dinheiro sério. Jogo = recompensa. | Valor, ONG, recibo em texto limpo, número grande. Pixel só em borda e ícone — nunca na letra. |
| B · Plano, sem truque | Cor chapada, sombra sólida, zero degradê. | Profundidade = bisel de cor sólida na base (degrau de fliperama). Nunca desfoque. |
| C · Pequeno detalhe de jogo | Canto em pixel, cursor ▸, barra em blocos. | Tempero, não prato. Borda, ícone, progresso. |

## Cor

Três cores, cada uma com trabalho. Tom claro/escuro só para bisel, fundo de seleção e texto.

| Papel | Nome | Hex | Token Tailwind | Uso | Peso |
|---|---|---|---|---|---|
| Principal | Verde Praça | `#4E6B45` | `verde` / `primary` | Marca, botão primário, ONG verificada, bloco de progresso | 70% |
| Base | Papel | `#F2EEE3` | `papel` / `background` | Fundo, placa sobre cena, superfície | 25% |
| Auxiliar | Âmbar Moeda | `#E3A33B` | `ambar` / `ring` | XP, conquista, foco, alerta. Só quando algo é conquistado | 5% |

Tons de apoio:

| Token | Hex | Uso |
|---|---|---|
| `tinta` | `#1E2A1B` | Texto e contorno (verde a 15% de luz) |
| `tinta-2` | `#4A5446` | Texto secundário (`muted-foreground`) |
| `verde-700` | `#3A5134` | Bisel verde, estado pressionado, texto ghost |
| `verde-hover` | `#5A7B50` | Hover do botão primário |
| `verde-100` | `#DCE4D5` | Seleção, hover, prefixo de campo (`accent`, `secondary`) |
| `papel-claro` | `#FBF9F3` | Card, popover, campo (`card`) |
| `papel-300` | `#D9D3C2` | Bisel claro (`edge`), bloco vazio (`muted`), hairline (`border`) |
| `ambar-700` | `#B47D22` | Bisel da moeda, borda de erro |
| `ambar-800` | `#7D5414` | Texto de erro (`destructive`) — 5,7:1 sobre papel |
| `ambar-100` | `#F6E3BF` | Fundo de campo com erro, botão destrutivo |
| `ambar-hover` | `#EBB257` | Hover do botão âmbar |

> [!warning] Sem vermelho
> Erro = borda âmbar escura + `<ErrorMark />` ("!" âmbar sobre tinta) + frase clara em `text-destructive`. Atenção sem alarme, coerente com causa de cuidado. `destructive` aponta para âmbar, não vermelho.

**Proibido:** `white`, `black`, hex solto, paleta padrão do Tailwind (`emerald-*`, `red-*`, `sky-*`…), opacidade sobre branco/preto (`bg-white/10`, `bg-black/60`). Use token.

**Escuro** (só `/dale`, `.dark` no `<html>`): mesmas três cores, chão vira `tinta`, card `#2B3828`, contorno `#0B110A`. Cena pública sempre clara.

Contraste medido: tinta/papel 12,9 · papel/verde 5,2 · tinta-2/papel 6,8 · tinta/âmbar 6,8 · verde-700/verde-100 6,7. Exceção conhecida: papel sobre `verde-hover` 4,1 (só no hover).

## Tipografia

Sans firme e aberta para tudo que precisa ser lido e acreditado; mono para placar, rótulo, contador. **Nenhuma fonte pixel** — pixel fica na forma, não na letra.

| Fonte | Token | Papel |
|---|---|---|
| Manrope 400–800 | `font-sans` (padrão do body) | Leitura, valor, botão, título |
| JetBrains Mono 400–600 | `font-mono` / `mono-label` | Rótulo de campo, kicker, contador, selo, dica, HUD |

| Nível | Spec | Exemplo |
|---|---|---|
| Display | 48px · 600 · `tracking-[-0.02em]` | `R$ 12.480` |
| Título | 26–30px · 600 | Nome da ONG, título de modal |
| Texto | 15–18px · 400 · `leading-relaxed` | Corpo |
| Botão | 14px · 700 · `tracking-[0.04em]` | Ação |
| Rótulo | `mono-label` (12px mono, `tracking-[0.04em]`) | "Valor da contribuição" |
| Selo/meta | mono 11px | "ONG verificada", "312 edifícios" |

Regras:
- Mono: mínimo 12px na tela (selo 11px tolerado). Só texto curto — nunca parágrafo, valor de doação ou termo legal.
- Número: `tabular-nums` global (body). Valor em Manrope, nunca mono.
- Título: `font-semibold`, tracking levemente negativo.

## Assinatura de jogo

Cinco detalhes formam a identidade. Com moderação — juntos, fazem a tela parecer Cidoa.

### 1 · Canto em pixel — `pixel`

Borda de 3px que pula o canto, como sprite. **Substitui `border` + `rounded` em tudo.** Raio do tema zerado (`rounded-*` = 0); `rounded-full` só para coisa realmente redonda (raro).

```html
<div class="pixel bg-card">…</div>          <!-- 3px tinta -->
<div class="pixel pixel-thin bg-card">…</div> <!-- 2px: campo, selo, controle pequeno -->
<div class="pixel pixel-ink-verde">…</div>   <!-- cor da borda -->
```

> [!caution] Borda fica fora da caixa
> Desenhada com `box-shadow`: não mexe no layout, mas `overflow-hidden/auto` do pai corta. Dentro de área com scroll, dê respiro (`p-1`/`p-2`). Nunca junte `pixel` com `shadow-*` ou `ring-*` (brigam pelo `box-shadow`).

### 2 · Bisel sólido — `bevel-*`

Faixa de 4px no tom escuro na base dá volume. Soma com `pixel`.

| Superfície | Classes |
|---|---|
| Placa/card de papel | `pixel bevel-edge bg-card` |
| Bloco verde | `pixel bevel-verde-700 bg-primary text-primary-foreground` |
| Bloco âmbar | `pixel bevel-ambar-700 bg-ambar text-tinta` |
| Modal | `pixel bevel-edge bevel-w-6 bg-background` |

Altura: `bevel-w-3` (pequeno), padrão 4, `bevel-w-6` (modal). Compense o bisel no padding de baixo (`pb-1` a mais) para o conteúdo ficar centrado na área visível.

Botão soma **sombra dura** na diagonal (`raised`, luz do canto superior esquerdo) e **afunda ao pressionar** (`press`: anda 4px, sombra zera, bisel não muda). Só botão usa `raised`/`press`.

### 3 · Cursor de menu ▸ — `menu-cursor`

Seta ▸ marca opção ativa/destacada em lista, menu, select. `menu-cursor` + `pl-6` no item; aparece em `:hover`, `data-highlighted`, `data-state=checked`, `aria-current=page`, `aria-selected`. Ícone avulso: `PixelArrow`.

Aba: utilitário `tab` (bold, ativa = régua verde de 4px embaixo, foco por dentro). Reconhece `data-state=active` (Radix) e `data-active=true` (aba feita à mão). Tamanho da fonte no chamador (`text-[13px]`). Some `menu-cursor pl-6` para ▸.

### 4 · Barra em blocos — `<BlockBar>`

Todo progresso contado em blocos. Cheio = verde, **próximo bloco a conquistar acende em âmbar**, vazio = `muted`.

```tsx
<BlockBar value={6} max={10} label="Nível 7" />            // moldura + blocos 18px
<BlockBar value={8} max={12} blocks={12} size="sm" label="Meta da ONG" /> // HUD, sem moldura
```

Carregando sem progresso conhecido: `<BlockLoader />` (três blocos acendem em sequência). **Nada de spinner girando** (`animate-spin`).

### 5 · Ícones em pixel

Grade 8×8, uma ou duas cores da marca. `pixel-icon.tsx`: `PixelClose`, `PixelCheck`, `PixelChevronDown`, `PixelArrow`, `PixelHeart`, `PixelPaw`, `PixelBuilding`, `PixelCoin` (sempre âmbar), `CidoaLogo`, `ErrorMark` ("!" de erro). Gato/cachorro (`PixelCat`, `PixelDog`) usam pelagem real — mascote espiando por cima de modal/card, só onde o pai não tem `overflow` (senão corta).

Lucide segue onde não há ícone pixel; terminação reta via CSS global (`.lucide`).

### Extras globais (automáticos)

- **Cursor de pata** em tudo clicável (`src/assets/ui/paw-cursor.svg`).
- **Foco de teclado** = contorno âmbar 3px, offset 4px. Fora de `@layer`: vence `outline-none`. Campo `field` mostra foco pela moldura verde. Item dentro de `overflow` (lista/aba rolável): `focus-inset` desenha o contorno por dentro.
- **Seleção de texto** em âmbar.
- **Padrão de pegadas** no papel: `pattern-paws` (fundo do `/dale`).
- `checkbox`, `radio`, `range`, `color`, `select` nativos já saem no estilo do DS (quadrado, borda pixel, verde marcado).

## Componentes

| Componente | Spec | Arquivo |
|---|---|---|
| Botão | Ver tabela abaixo | `ui/button.tsx` |
| Campo | `field`: papel claro, borda 2px. Foco: borda verde 3px + fundo branco + bisel verde-100. Erro (`aria-invalid`): borda `ambar-700` + fundo `ambar-100` + linha "!" | `ui/input.tsx`, `field` no CSS |
| Rótulo | `mono-label` **acima** do campo, gap 8px. Sem label flutuante | `Input label=` |
| Prefixo | Grupo `field` com `R$` em `bg-secondary text-secondary-foreground font-mono` à esquerda; input interno sem moldura | — |
| Checkbox | 18px quadrado, borda 2px, marcado = verde + check papel | nativo |
| Radio / opção | Quadrado com quadrado interno verde. Opção em card: selecionada = `bg-secondary` + `pixel pixel-thin pixel-ink-verde` | nativo |
| Switch | Trilho 44×24 quadrado, bloco 18px. Ligado = trilho verde + bloco papel | `ui/switch.tsx` |
| Valor rápido | Botões lado a lado `pixel pixel-thin bevel-edge`; ativo = verde com `bevel-verde-700` | — |
| Abas | `tab text-[13px]` (+ `menu-cursor pl-6` para ▸); lista sem fundo, `border-b` | `tab` no CSS |
| Linha de erro | `<p role="alert" class="flex gap-2 text-sm text-destructive"><ErrorMark />frase</p>` | `ui/pixel-icon.tsx` |
| Selo | `Badge`: mono 11px, borda 2px. `default` verde, `secondary` papel, `reward` âmbar, `muted` verde-100 sem borda | `ui/badge.tsx` |
| Dica | Tooltip tinta, mono 12px papel, rabicho em degrau | `ui/tooltip.tsx` |
| Feedback | Toast = placa papel + quadrado sólido com ícone. Erro = "!" âmbar sobre tinta | `ui/toast.tsx` |
| Conquista | Placa `bg-ambar bevel-ambar-700` + `PixelCoin` + kicker mono | — |
| Card | `pixel bevel-edge bg-card`, padding com +4px embaixo | `ui/card.tsx` |
| Modal | `pixel bevel-edge bevel-w-6 bg-background`, overlay `bg-tinta/72`. Fluxo com etapas: `DialogKicker` (barra verde + rótulo mono + fechar) | `ui/dialog.tsx` |
| Menu/Select | Popover `pixel bg-popover`, item com `menu-cursor` | `ui/select.tsx`, `ui/dropdown-menu.tsx` |

### Botão

| Variante | Visual | Quando |
|---|---|---|
| `default` | Verde, texto papel, bisel verde-700, sombra dura | Ação principal. Uma por tela |
| `outline` / `secondary` | Papel claro, bisel papel-300, hover verde-100 | Ação secundária, cancelar |
| `reward` | Âmbar, texto tinta, bisel âmbar-700 | Resgatar/conquistar. Só moeda |
| `destructive` | Âmbar claro, bisel âmbar-700 | Excluir, sair de algo irreversível |
| `ghost` | Sem moldura, texto verde-700, hover verde-100 | Ação terciária, ícone em barra |
| `link` | Verde sublinhado 2px, hover verde-100 | Link em texto |

Tamanhos: `xs` 28, `sm` 32, `default` 40, `lg` 48 (px de altura). Estados: hover clareia, pressionado anda 4px, foco âmbar, desabilitado 45%.

## Interface sobre a cidade

HUD ocupa só os cantos. **Placa de papel sólido** garante leitura sobre qualquer trecho da cena — nada de vidro escuro, `backdrop-blur` ou transparência.

| Peça | Spec |
|---|---|
| Placa de HUD | `pixel bevel-edge bg-background` (ou `bg-card`), `px-4 py-2.5 pb-3` |
| Nível/XP | `CidoaLogo` + `mono-label` + `BlockBar size="sm"` |
| Contador | Placa + ícone pixel + número em mono 14px |
| Info de edifício | Placa: kicker mono verde ("Edifício #12.847"), título 20px 600, meta `text-muted-foreground` |
| CTA principal | Botão `default` `size="lg"` com ícone pixel, canto inferior |
| Dica sobre cena | Tooltip tinta |

Overlay só com `pointer-events-auto` na placa; o resto `pointer-events-none` para não roubar arrasto da câmera.

## Copy

- Regras do `CLAUDE.md` (UI copy enxuta) valem acima de exemplo do DS.
- Fluxo de contribuição: **"Contribuir"**, **"Erguer edifício"**, **"Aumentar edifício"**. Nunca "Doar", "Construir", "prédio" — textos de exemplo do arquivo do DS usam esses termos; não copiar.
- Erro: frase clara do que fazer ("Faltou o domínio — ex.: ana@email.com"), sem alarme.

## Proibido

- `rounded-*` (exceto `rounded-full` em círculo real), `border` cinza fina como contorno principal → `pixel`.
- `shadow-*`, `drop-shadow-*`, `backdrop-blur-*`, `bg-gradient-*`/`bg-linear-*`.
- Vermelho, `white`, `black`, hex solto, paleta padrão do Tailwind.
- Fonte pixel. Mono em parágrafo ou valor.
- `animate-spin` → `BlockLoader`.
- Âmbar decorativo: âmbar = moeda/conquista/foco/alerta.

## Checklist — componente novo

1. Superfície = token (`bg-background`, `bg-card`, `bg-primary`…). Nada de hex.
2. Contorno = `pixel` (+ `pixel-thin` se pequeno). Volume = `bevel-*`.
3. Botão = `<Button>` com variante; não reinvente.
4. Campo = `<Input>` ou `field`; rótulo `mono-label` acima.
5. Progresso = `BlockBar`; carregando = `BlockLoader`.
6. Opção ativa em lista = `menu-cursor`.
7. Dentro de scroll: respiro para a borda em pixel não cortar.
8. Foco visível sem fazer nada (global). Não esconda com `outline-none` em elemento sem outro sinal de foco.
9. Erro = `ErrorMark` + frase em `text-destructive`. Nunca vermelho.

Ver também: [[html-components]], [[three-components]], [[index]].
