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

Camada de dados (`customizationApi.ts`, hook) fica em [[customization-api]]. Trilha visual compartilhada: `PassTrack` recebe recompensas por props; sem callback de edição, funciona em modo somente leitura. Admin inclui prévia das recompensas ativas.

## Ideia central

```
GET /customization/catalog  → o que existe + quanto custa   (igual pra todos, cacheado)
GET /customization/me       → quanto eu tenho + o que ganhei (por usuário, sem cache)
              ↓
      lib/unlock.ts  → badge, frase, "faltam X"
              ↓
   admin /dale/passe: define regra → PassTrack: trilha reutilizável
      cena: cadeado + RewardDialog com conquista, motivo e próxima meta
```

## Contrato do requisito

```ts
type UnlockRule = { donationMin: number | null; referralMin: number | null; mode?: "all" | "any" } | null;
```

| Valor | Lê-se |
| --- | --- |
| `null` | **grátis** — disponível pra todos |
| `{ donationMin: 30, referralMin: null }` | exige R$ 30 |
| `{ donationMin: null, referralMin: 3 }` | exige 3 indicações |
| `{ donationMin: 50, referralMin: 3, mode: "all" }` | exige **as duas** (AND) |
| `{ donationMin: 50, referralMin: 3, mode: "any" }` | exige **uma ou outra** (OR) |

Backend envia `mode`; ausente no catálogo antigo = `all`. Regras grátis continuam `null`.

> [!important] Zero não existe
> Backend recusa zero — "não exige" tem representação única (`null`). Nenhuma tela do front precisa tratar `0`. É isso que torna "R$ 30 de doação e 0 indicações" impossível de renderizar.

## Estado

| Peça | Situação |
| --- | --- |
| `unlock` no catálogo | ✅ [[customization-api]] |
| `fetchMyUnlocks()` | ✅ hook da cena; progresso, conquistas e avisos pendentes |
| `lib/unlock.ts` | ✅ [[passe-formatacao]] |
| UI admin (página Passe, trilha visual, dialog) | ✅ [[passe-admin-ui]] |
| Cadeado no `BuildingManageDialog` | ✅ [[passe-cena]] |
| Aviso de conquista | ✅ `RewardDialog`, Motion sob demanda, confirmação persistida |
| Escolha por indicação | ✅ `RewardDialog` (cards-radio), validada no backend — [[primeiros-inscritos]] |

## Notificação de recompensa

`useCustomizationCatalog` reaproveita `/customization/me` no login/reload e pagamento confirmado. Abrir menu da conta também atualiza conquistas — encontra indicações recebidas em outra sessão. Sem timer de recompensas; polling Pix existente continua exclusivo da cobrança pendente.

Passe conta indicação só com contribuição do indicado (`progress.referrals`). Etapas de escolha contam cadastros (`signupReferrals`). `PassTrack` avisa: "No passe, indicação conta quando a pessoa indicada contribui."

`AuthMenu` monta `RewardDialog` via lazy import só com pendências ou escolha disponível (`rewards.choice`). Pendência tem prioridade; escolha aparece depois. Espera termos, onboarding, indicação, menu, compartilhamento, pagamento, ajuda e edição/info do edifício liberarem tela. Sem interromper formulário aberto. Onboarding pulado offline, ainda não confirmado no servidor: avisos aguardam conclusão persistida.

Modal agrupa lote: item principal com miniatura + motivo; demais itens com miniatura/motivo próprios. Próxima conquista segue `sortPassRewards`, ignora grátis e conquistadas, usa `formatUnlockRemaining` para metas AND/OR. Sem próxima meta: incentivo neutro. Animação Motion: entrada curta + oito partículas quadradas âmbar, sem loop; movimento reduzido = fade sem partículas. Cores, borda pixel, botão e Dialog do DS.

X, Esc, clique fora ou Continuar dispensam lote apresentado; um POST idempotente, sem nova leitura. Backend conserva pendências se rede falhar. Histórico anterior à migration 0026 marcado visto; sem enxurrada retroativa. Preservação administrativa de item já usado também não notifica. Grants novos por doação, indicação ou escolha por indicação ficam pendentes.

Testes: `bun test tests/reward-notifications.test.ts` (motivo/ordem/metas); `node scripts/check-reward-notifications.mjs` (ciclo do hook, requests, contas, abort, offline). Contrato: [[customization-api]].

## Relacionado

- [[customization-api]] — camada de dados
- [[personalizacoes]] — CRUD do catálogo (ativo/inativo, cor, textura)
- [[html-components#BuildingManageDialog.tsx]] — painel que vai ganhar cadeado
