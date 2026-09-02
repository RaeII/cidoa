---
title: Passe · Cena 3D (fase seguinte)
tags:
  - passe
  - cena
  - todo
aliases:
  - passe-cena
---

# Passe · Cena 3D

> [!warning] Não implementado
> Contrato fechado, dado disponível, consumo ainda não escrito. Página existe pra quem for implementar não redecidir o que já foi decidido.

## O que falta

| Peça | Onde |
| --- | --- |
| Hook buscar `/customization/me` | `src/components/hooks/useCustomizationCatalog.ts` |
| Painel mostrar cadeado | [[html-components#BuildingCustomizePanel.tsx\|BuildingCustomizePanel]] |
| Backend recusar opção não liberada ao salvar | vault do backend — depende de `user_building_customization` ganhar escrita |

## Decisões já tomadas

### Opção bloqueada aparece, não some

Esconder mata o passe. **O bloqueio é o convite** — usuário precisa ver o que dá pra conquistar pra querer conquistar.

Bloqueada renderiza com cadeado + o que falta (`formatUnlockRemaining`, ver [[passe-formatacao]]).

### Deslogado vê o passe inteiro

`/customization/catalog` é público e já traz `unlock`. Sem sessão, tudo que não é grátis mostra cadeado com o requisito. Sem `/me`, sem progresso.

### Front nunca é autoridade

Cadeado no painel = conveniência. Checagem real acontece quando o backend gravar a escolha do usuário: ele recusa opção não liberada.

Qualquer proteção só no front é contornável pelo devtools.

## Como juntar os dois payloads

```ts
// catálogo: o que existe + quanto custa (cacheado, igual pra todos)
const catalog = await fetchCustomizationCatalog();
// me: quanto tenho + o que ganhei (por usuário, sem cache)
const mine = await fetchMyUnlocks();

// opção liberada quando:
const unlocked =
  option.unlock === null ||                        // grátis
  mine.unlockedOptionIds.includes(option.id) ||    // conquistada (permanente)
  meetsUnlock(option.unlock, mine.progress);       // acabou de bater
```

Terceiro termo cobre a janela entre bater a meta e o grant ser gravado. Ver [[customization-api]].

Feature (Letreiro/Holograma) usa `mine.unlockedCategoryKeys.includes("sign")` — front indexa categoria por key, não por id.

## Cuidados

- **Opção grátis não aparece em `unlockedOptionIds`.** Não é bug — grátis não é conquista. Decidir por `unlock === null`.
- **`/me` exige sessão.** Sem login, `401`. Tratar como "nada conquistado", não como erro na tela.
- **Progresso pode cair.** Doação estornada derruba `progress.donated`, mas a conquista fica. Por isso o `includes` vem **antes** do `meetsUnlock` na leitura mental — os dois são `OR`, ordem não muda resultado, mas a intenção é essa.
- **Eixo doação está zerado hoje.** Nada preenche `donation.user_id` ainda (não existe endpoint de doação). Só o eixo indicação funciona ponta a ponta — testar com isso em mente.

## Relacionado

- [[customization-api]] — `fetchMyUnlocks`, tipos
- [[passe-formatacao]] — `meetsUnlock`, `formatUnlockRemaining`
- [[html-components#BuildingCustomizePanel.tsx]] — painel a alterar
