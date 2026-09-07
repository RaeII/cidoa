---
title: Admin · Primeiros inscritos
tags: [cidoa, admin, passe]
aliases: [Benefícios de cadastro]
---

# Primeiros inscritos

Página `/dale/primeiros-inscritos` · `src/pages/admin/EarlySignups.tsx`. Menu desktop e mobile via `src/lib/nav.ts`; rota lazy protegida por `RequireAuth`.

## Administrar

1. Definir quantidade dos primeiros inscritos (1–1.000.000).
2. Selecionar modelo, textura, cor, topo, LED, letreiro e/ou holograma. Um item basta; vários formam combo.
3. Ativar **Distribuir benefícios** e salvar. Backend também concede aos cadastros antigos elegíveis.

Cards mostram estado salvo, usuários já beneficiados e posições restantes para novos cadastros. Seleção com miniaturas compartilhadas (`CustomizationImage`), resumo do combo e indicação de alterações pendentes. Erro mantém formulário; carregamento permite tentar novamente.

## Regras

- Ordem desde o início da plataforma. Cadastros anteriores incluídos; administrador no cadastro não ocupa posição. Conta desativada preserva posição, recebe após reativação se ainda elegível.
- Recompensa = liberação de uso, não criação de doação/prédio nem aplicação automática do visual.
- Benefício dispensa requisitos de doação/indicação. Demais usuários continuam usando regras do [[passe-front]]. Item grátis já disponível para todos; card informa isso.
- Pausar interrompe novas concessões. Retomar reconcilia primeiros N; cadastro durante pausa também ocupa posição histórica.
- Reduzir limite/remover item não revoga conquistas. Contagem histórica pode superar limite reduzido.
- Adicionar item concede aos primeiros N ativos quando distribuição ativa. Beneficiário fora do limite atual conserva itens antigos, não ganha novos.
- Ativação exige combo não vazio, itens e categorias ativos. Padrões `default`/`none` não entram. Rascunho pausado aceita itens inativos.
- Opção vinculada ao combo não pode ser excluída do catálogo; remover do combo primeiro.

## Integração

`getEarlySignupSettings` / `saveEarlySignupSettings` em `src/api/admin/admin.routes.ts`; tipos `EarlySignupInput` / `EarlySignupSettings` em `admin.types.ts`.

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/api/admin/early-signups` | Configuração, IDs e contagens |
| PUT | `/api/admin/early-signups` | Salvar configuração + distribuir atomicamente |

Cena: `useCustomizationCatalog` consulta `/customization/me` por sessão, mescla conquistas permanentes e requisitos via `canUseCustomization`; painel mantém opções bloqueadas visíveis com cadeado. Ver [[passe-cena]] e [[customization-api]].

## Verificação

`npm run build`, `npm run lint`, `node scripts/check-customization-access.mjs`. Sem servidor/navegador.
