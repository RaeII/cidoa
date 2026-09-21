---
title: Usuários (Admin)
tags:
  - cidoa
  - admin
  - usuarios
  - permissoes
aliases:
  - Usuários
  - Promover admin
  - Excluir usuário
---

# Usuários

Página admin (`/dale/usuarios`) pra **visualizar e administrar as contas da aplicação**: busca, paginação, dar/tirar admin e excluir. Base de UI em [[componentes-html]]; auth e shell em [[area-admin]].

> [!info] Backend
> Front só chama rota existente. Nada de módulo novo: `GET /api/user/` (paginado + `?search=`), `PUT /api/user/:id` com `{ is_admin }` e `DELETE /api/user/:id`. Todas exigem JWT + admin. Detalhe: `cidoa-back/doc/modulos/usuarios/usuarios.md`.

---

## Rota & navegação

- Rota lazy em `src/App.tsx`, dentro de `<RequireAuth>` (só admin logado). Path `/dale/usuarios`.
- Item na sidebar/bottom-bar vem de `src/lib/nav.ts` (ícone `Users`) — fonte única, [[componentes-html#Componentes reutilizáveis|AppSidebar + MobileNav]] leem de lá.
- Página: `src/pages/admin/Users.tsx`. Mesmo shell do [[area-admin#Dashboard|Dashboard]]: `SidebarProvider` + `AppSidebar` + conteúdo rolável + `MobileNav`.

---

## O que admin ganha

| Poder | Onde |
| --- | --- |
| Entrar no painel `/dale` | `RequireAuth` exige `isAdmin`; backend exige `adminGuard` em cada rota |
| Usar **toda** personalização sem cumprir passe | `canUseCustomization(..., isAdmin)` em [[passe-formatacao]] · tabela em [[passe-cena]] |

Admin nem chega a pedir `/customization/me`: `useCustomizationCatalog` pula o fetch de conquistas e marca tudo `isUnlocked`. Sem cadeado, sem requisito, sem `fieldset` desabilitado no [[html-components#BuildingCustomizePanel.tsx|BuildingCustomizePanel]].

---

## Linha da lista

Avatar + nome + `@username · e-mail`, badge `Admin` quando for o caso, `#id` (some no mobile) e o menu de ações. Nada de controle solto na linha: layout limpo, uma ação por vez.

---

## Buscar

Form com `Input` + botão. Submit (Enter ou clique) dispara `listUsers({ search, page, limit: 20 })`. Termo casa **username, nome ou e-mail**, parcial, sem diferenciar maiúsculas (`ILIKE` no backend).

Buscar o mesmo termo na página 1 não muda dep nenhuma — `reloadKey` força o refetch. `setLoading(true)` acontece nos handlers, nunca no corpo do effect (regra `set-state-in-effect`). Loading = `Skeleton`; erro = mensagem + "Tentar de novo".

Listagem traz só `is_active = TRUE`.

---

## Paginação

`Pagination` do shadcn (`src/components/ui/pagination.tsx`), 20 por página, só aparece com `totalPages > 1`. `pageWindow(page, totalPages)` em `src/lib/pagination.ts` monta a janela: **1, atual ± 1 e a última**; buraco vira `PaginationEllipsis`, buraco de uma página só mostra o número (mais curto que as reticências que o esconderiam).

> [!note] Botão, não `<a>`
> A cópia local troca o `<a href>` do shadcn por `<button type="button">`: aqui a página vive em estado React, não na URL, e `<a>` sem `href` não recebe foco nem tecla. Rótulos e `aria-label` em português.

Teste executável: `bun test tests/page-window.test.ts` — extremos, meio, buraco de uma página e a invariante (sem repetição, dentro do intervalo, sempre contém a atual).

---

## Menu de ações (⋮)

`DropdownMenu` do shadcn no fim da linha, gatilho `MoreVertical`:

| Item | Efeito |
| --- | --- |
| **Tornar admin** / **Remover admin** | `setUserAdmin(id, next)` → `PUT /user/:id { is_admin }`. Resposta substitui a linha; feedback inline embaixo da lista |
| **Excluir usuário** (destrutivo) | Abre a confirmação — ver [[#Excluir usuário]] |

Enquanto a promoção está em voo, o gatilho vira `Loader2` e fica desabilitado.

> [!info] Permissão atual no banco
> Backend consulta conta ativa/admin em cada requisição. Promoção/rebaixamento vale com o token existente. Front consulta `GET /user/me` ao carregar e ao recuperar foco; `localStorage` não restaura autorização. `RequireAuth` aguarda `isLoading` antes de redirecionar. Atualizar página ou voltar à aba sincroniza a UI.

> [!warning] Cena local não é autorização
> Admin libera todas as opções **ativas** do catálogo. Personalização atual só altera estado React/Three.js no próprio navegador: DevTools pode modificar essa cena. Não concede permissão de API nem grava alterações compartilhadas. Persistência futura exige validar propriedade e conquistas/admin no backend.

> [!danger] Não dá pra se rebaixar
> Item de admin da própria linha fica desabilitado (`isSelf`) e o backend recusa com `400`. Tirar o próprio admin fecha a porta por dentro: sem outro admin logado, só `scripts/create-admin.ts` devolve o acesso.

---

## Excluir usuário

`Dialog` de confirmação nomeando quem vai embora (`Excluir @username?`) antes de qualquer chamada. Confirmar dispara `deleteUser(id)` → `DELETE /user/:id`.

Apaga a conta **e todos os dados dela**: doações (o prédio some da cena), personalizações, conquistas, indicações e identidades de login. Definitivo, sem soft delete — e o e-mail volta a ficar livre, que é o que permite repetir o teste de login com a mesma conta. O inventário de tabelas está em `cidoa-back/doc/modulos/usuarios/usuarios.md`.

Erro (ex.: `403`) mantém o diálogo aberto com o motivo. Sucesso fecha, avisa inline e recarrega a página atual — se o excluído era o último item de uma página além da primeira, recua uma, senão a lista ficaria vazia.

> [!danger] Excluir a si mesmo é permitido
> Diferente do rebaixamento, a própria conta **pode** ser excluída — o diálogo avisa que o acesso ao painel cai na hora e que só `scripts/create-admin.ts` devolve. Se preferir bloquear, o lugar é o mesmo guarda do `is_admin: false` no `user.controller.ts` do backend.

> [!info] Só admin exclui
> Rota exige JWT + `adminGuard`, e a página inteira vive atrás do `RequireAuth`. Conta não-admin nem chega na listagem.

---

## Camada de API

`src/api/user/user.routes.ts` (mesmo axios `http` compartilhado, cookie httpOnly):

| Função | Rota | Retorno |
| --- | --- | --- |
| `getOwnSession()` | `GET /user/me` | Perfil atual + `expiresIn`; resposta `no-store` |
| `listUsers({ search?, page?, limit? })` | `GET /user` | `UserPage` — `{ data: User[], pagination }` |
| `setUserAdmin(id, isAdmin)` | `PUT /user/:id` | `User` atualizado |
| `deleteUser(id)` | `DELETE /user/:id` | Nada — exclui a conta e todos os dados dela |
| `updateOwnProfile(input)` | `PUT /user/me` | `User` atualizado (perfil próprio, não-admin) |

Tipos em `src/api/user/user.types.ts` (`User`, `UserPage`). `search` vazio é omitido da query — axios pula chave `undefined`.

---

## Primeiro admin

Página só funciona pra quem **já** é admin. Primeiro admin nasce no backend:

```bash
bun run scripts/create-admin.ts <username> <password> [email]
```

Idempotente: reexecutar promove e reseta senha do mesmo username.

Checagens no backend (PostgreSQL + rollback): `bun run scripts/check-user-search.ts` (filtro de busca) e `bun run scripts/check-user-purge.ts` (exclusão leva todos os dados e libera o e-mail).

Ver [[area-admin]], [[componentes-html]], [[passe-cena]].
