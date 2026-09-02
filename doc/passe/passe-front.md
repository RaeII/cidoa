---
title: Passe de Conquistas (front)
tags:
  - passe
  - gamification
  - index
aliases:
  - passe-front
  - passe
---

# Passe de Conquistas — front

Personalização de edifício = conquista. Usuário libera quando bate meta de **doação** e/ou **indicação** que admin definiu.

Aqui = lado do front: de onde vem o dado, como vira texto, como admin edita regra, o que falta na cena.

> [!info] Regra mora no backend
> Modelo, motor de liberação e cenários ficam no vault do backend (`doc/modulos/passe/`). Front nunca decide quem pode usar o quê — só mostra. Ver [[customization-api]].

## Mapa

| Página | Responde |
| --- | --- |
| [[passe-formatacao]] | Como requisito vira texto. Regra "nunca mostre eixo não exigido" |
| [[passe-admin-ui]] | Tela onde admin define quanto custa cada personalização |
| [[passe-cena]] | Cadeado no painel do usuário — fase seguinte, contrato já fechado |

Camada de dados (`customizationApi.ts`, hook) fica em [[customization-api]].

## Ideia central

```
GET /customization/catalog  → o que existe + quanto custa   (igual pra todos, cacheado)
GET /customization/me       → quanto eu tenho + o que ganhei (por usuário, sem cache)
              ↓
      lib/unlock.ts  → badge, frase, "faltam X"
              ↓
   admin: define regra      ·      cena: mostra cadeado
```

## Contrato do requisito

```ts
type UnlockRule = { donationMin: number | null; referralMin: number | null } | null;
```

| Valor | Lê-se |
| --- | --- |
| `null` | **grátis** — disponível pra todos |
| `{ donationMin: 30, referralMin: null }` | exige R$ 30 |
| `{ donationMin: null, referralMin: 3 }` | exige 3 indicações |
| `{ donationMin: 50, referralMin: 3 }` | exige **as duas** (AND) |

> [!important] Zero não existe
> Backend recusa zero — "não exige" tem representação única (`null`). Nenhuma tela do front precisa tratar `0`. É isso que torna "R$ 30 de doação e 0 indicações" impossível de renderizar.

## Estado

| Peça | Situação |
| --- | --- |
| `unlock` no catálogo | ✅ [[customization-api]] |
| `fetchMyUnlocks()` | ✅ escrito, ainda sem consumidor |
| `lib/unlock.ts` | ✅ [[passe-formatacao]] |
| UI admin (badge, dialog, visão Passe) | ✅ [[passe-admin-ui]] |
| Cadeado no `BuildingCustomizePanel` | ⏳ [[passe-cena]] |

## Relacionado

- [[customization-api]] — camada de dados
- [[personalizacoes]] — CRUD do catálogo (ativo/inativo, cor, textura)
- [[html-components#BuildingCustomizePanel.tsx]] — painel que vai ganhar cadeado
