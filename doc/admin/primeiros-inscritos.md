---
title: Admin · Recompensas por indicação
tags: [cidoa, admin, passe]
aliases: [Benefícios de cadastro, Primeiros inscritos]
---

# Recompensas por indicação

Página `/dale/primeiros-inscritos` · `src/pages/admin/EarlySignups.tsx`. Menu desktop e mobile via `src/lib/nav.ts`; rota lazy protegida por `RequireAdmin`.

Etapas por meta de cadastros indicados. Indicado não precisa contribuir. Cada etapa: usuário escolhe **um** item. Não escolhidos seguem regra do [[passe-front|passe]] — lá indicação só conta com contribuição do indicado.

## Administrar

1. **Limitar aos primeiros inscritos** (switch). Desligado = todo cadastro comum participa. Ligado = primeiros N (1–1.000.000), contando desde início da plataforma.
2. **Adicionar etapa** (até 10). Cada etapa: meta de cadastros indicados (inteira, única) + itens oferecidos (modelo, textura, cor, topo, LED, letreiro, holograma).
3. Ativar **Distribuir benefícios** e salvar.

Exemplo: etapa 2 → Loftifício ou Varanda Gourmet; etapa 5 → Yatchcasa ou Residencial. Usuário com 5 indicações escolhe duas vezes.

Cards: estado salvo, usuários com escolha, posições restantes (ou "Sem limite"). Botões de etapa alternam grade de itens. Item grátis ou inativo desabilitado (só desmarca). Aviso de alteração pendente; erro mantém formulário.

## Regras

- Ativação exige etapa, itens ativos e com regra no passe. Padrões `default`/`none` não entram. Rascunho pausado aceita itens inativos.
- Meta identifica etapa: remover e recriar mesma meta não renova escolhas.
- Pausar esconde ofertas; escolhas feitas permanecem. Reduzir limite não revoga.
- Opção usada em etapa não pode ser excluída do catálogo; remover da etapa primeiro.
- Recompensa = liberação de uso, não cria edifício nem aplica visual.

## Integração

`getEarlySignupSettings` / `saveEarlySignupSettings` em `src/api/admin/admin.routes.ts`; tipos `EarlySignupInput` (`userLimit: number | null`, `tiers`) / `EarlySignupSettings` em `admin.types.ts`.

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/api/admin/early-signups` | Configuração, etapas e contagens |
| PUT | `/api/admin/early-signups` | Salvar etapas, limite e ativação |
| POST | `/api/customization/me/rewards/choose` | Escolha do usuário na cena |

Cena: `/customization/me` traz `signupRewards`; `RewardDialog` abre escolha. Backend recalcula oferta e recusa item/etapa forjados — front nunca é autoridade. Ver [[customization-api#Escolha por indicação]] e [[html-components#RewardDialog.tsx]].

## Verificação

`npm run build`, `npm run lint`, `node scripts/check-reward-notifications.mjs`. Backend: `bun test tests/reward-notifications.test.ts tests/early-signups.test.ts`.
