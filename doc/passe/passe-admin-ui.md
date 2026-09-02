---
title: Passe · UI do Admin
tags:
  - passe
  - admin
  - ui
aliases:
  - passe-admin-ui
---

# Passe · UI do Admin

Onde admin define quanto custa cada personalização. Rota `/dale/personalizacoes`, mesma página do catálogo — sem rota nova.

**Arquivo:** [`src/pages/admin/Customizations.tsx`](../../src/pages/admin/Customizations.tsx)

Catálogo em si (ativar/desativar, cadastrar cor e textura, preview 3D) fica em [[personalizacoes]].

## Duas visões

Botão no topo alterna. Mesmo catálogo, perguntas diferentes.

| Visão | Serve pra |
| --- | --- |
| **Lista** (padrão) | Gerir uma categoria por vez |
| **Passe** | Ler a curva inteira de conquistas |

## Badge do requisito

Cada linha de opção e cada categoria-`feature` mostra o requisito na sublinha, junto da key:

`Grátis` · `R$ 50` · `3 indicações` · `R$ 50 + 3 indicações` · `Padrão`

Texto vem de `formatUnlockRequirement` ([[passe-formatacao]]) — eixo não exigido nunca aparece.

`Padrão` = opção base (`default`, `none`). Estado padrão do edifício, nunca vira conquista.

## Dialog de liberação

Abre pelo menu de três pontos → **Definir liberação**. Em categoria-`feature`, por botão no cabeçalho.

Dois eixos independentes, cada um com `Switch` + input:

| Eixo | Significa |
| --- | --- |
| **Exigir doação** | Soma de tudo que usuário já doou |
| **Exigir indicações** | Total histórico de quem entrou pelo código dele |

Os dois ligados = precisa dos **dois** (AND). Um só = só ele conta.

> [!important] `Switch` é o que impede "R$ 30 e 0 indicações"
> "Não exigir" = estado do controle, não número digitado. Eixo desligado → campo nem existe → impossível gravar zero.
>
> Regra de UX vira estrutura, não validação de texto. Backend recusa zero também, mas o admin nunca chega a ver esse erro.

Também tem:

- **Preview ao vivo** — frase exata que usuário vai ler, por `formatUnlockCta`. Mesma função da cena, então admin e usuário nunca leem coisas diferentes.
- **Aviso de conquista** — quando `unlockedCount > 0`: "N usuários já conquistaram e mantêm o acesso". Mudar valor **não** tira de ninguém. Número na tela > frase em documentação que admin não lê.
- **Tornar grátis** — desliga os dois de uma vez.

Input aceita `50` e `50,90`. Com vírgula, ponto vira separador de milhar (`1.234,56`). Sem vírgula, ponto é decimal (`50.5`) — cobre os dois hábitos.

Dialog é dono da regra inteira: manda **sempre os dois** campos, então `null` significa "limpa", não "não mexe".

## Visão Passe

Todas as personalizações de todas as categorias, agrupadas por requisito **idêntico**, ordenadas por esforço (doação, depois indicação). Grátis abre a trilha.

Existe porque visão em lista mostra uma categoria por vez e **esconde a curva**. Buraco entre R$ 10 e R$ 500, ou dez conquistas empilhadas no mesmo degrau, só aparecem com tudo lado a lado.

Cada degrau mostra o badge + quantas personalizações tem. Cada chip mostra `categoria · opção` e abre o dialog de liberação.

Opção base fica fora — não é conquista.

## O que a UI bloqueia sozinha

| Situação | UI faz |
| --- | --- |
| Opção base (`default`, `none`) | Não mostra "Definir liberação". Badge vira `Padrão` |
| Categoria `option_list` ou `group` | Não mostra ação — regra vive nas opções |
| Zero | Campo não existe com eixo desligado |
| Salvar campo vazio com eixo ligado | Botão desabilitado + "Preencha um valor maior que zero, ou desligue a exigência" |

Backend recusa os mesmos casos com `400`. UI evita o erro; backend garante.

## Componentes

Já existiam: `Dialog`, `Switch`, `Input`, `Button`, `DropdownMenu`, `Select`, `Card`, `Skeleton`.

Novo: [`badge.tsx`](../../src/components/ui/badge.tsx) (shadcn). Toggle Lista/Passe usa dois `Button` com `variant` — instalar `tabs` por dois botões não paga.

## Regras-chave

- **Ativo ≠ liberado.** `isActive` = liga/desliga global (some da cena pra todo mundo). Liberação = por usuário. Opção desativada some da cena mas conquista continua registrada; reativar devolve acesso.
- **Conquista é permanente.** Subir limiar nunca tira de quem já conquistou. `unlockedCount` existe pro admin ver esse impacto **antes** de mexer.
- **Cena reflete na hora.** Backend invalida o cache do catálogo a cada escrita — sem espera de 60s.

## Relacionado

- [[passe-formatacao]] — de onde vem todo texto de requisito
- [[personalizacoes]] — resto da tela (catálogo, preview 3D, textura)
- [[componentes-html]] — base de UI do admin
