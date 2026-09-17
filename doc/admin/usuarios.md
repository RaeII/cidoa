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
---

# Usuários

Página admin (`/dale/usuarios`) pra **dar ou tirar acesso de administrador**. Base de UI em [[componentes-html]]; auth e shell em [[area-admin]].

> [!info] Backend
> Front só chama rota existente. Nada de módulo novo: `GET /api/user/` (paginado + `?search=`) e `PUT /api/user/:id` com `{ is_admin }`. Ambas exigem JWT + admin. Detalhe: `cidoa-back/doc/modulos/usuarios/usuarios.md`.

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

## Buscar

Form com `Input` + botão. Submit (Enter ou clique) dispara `listUsers({ search, page, limit: 20 })`. Termo casa **username, nome ou e-mail**, parcial, sem diferenciar maiúsculas (`ILIKE` no backend).

Buscar o mesmo termo na página 1 não muda dep nenhuma — `reloadKey` força o refetch. `setLoading(true)` acontece nos handlers, nunca no corpo do effect (regra `set-state-in-effect`). Loading = `Skeleton`; erro = mensagem + "Tentar de novo".

Paginação só aparece com `totalPages > 1`. Listagem traz só `is_active = TRUE`.

---

## Ligar/desligar admin

`Switch` por linha → `setUserAdmin(id, next)` → `PUT /user/:id { is_admin }`. Resposta substitui a linha na lista; feedback inline embaixo.

> [!warning] Precisa relogar
> Claim `admin` é **assinado no JWT no login**. Promover usuário logado não muda o token dele: ele só vira admin de fato depois de sair e entrar de novo. Vale pro próprio painel e pro desbloqueio das personalizações — `isAdmin` no front vem do espelho da sessão em `localStorage`, gravado no login.

> [!danger] Não dá pra se rebaixar
> Switch da própria linha fica desabilitado (`isSelf`) e o backend recusa com `400`. Tirar o próprio admin fecha a porta por dentro: sem outro admin logado, só `scripts/create-admin.ts` devolve o acesso.

---

## Camada de API

`src/api/user/user.routes.ts` (mesmo axios `http` compartilhado, cookie httpOnly):

| Função | Rota | Retorno |
| --- | --- | --- |
| `listUsers({ search?, page?, limit? })` | `GET /user` | `UserPage` — `{ data: User[], pagination }` |
| `setUserAdmin(id, isAdmin)` | `PUT /user/:id` | `User` atualizado |
| `updateOwnProfile(input)` | `PUT /user/me` | `User` atualizado (perfil próprio, não-admin) |

Tipos em `src/api/user/user.types.ts` (`User`, `UserPage`). `search` vazio é omitido da query — axios pula chave `undefined`.

---

## Primeiro admin

Página só funciona pra quem **já** é admin. Primeiro admin nasce no backend:

```bash
bun run scripts/create-admin.ts <username> <password> [email]
```

Idempotente: reexecutar promove e reseta senha do mesmo username.

Checagem do filtro de busca (backend, PostgreSQL + rollback): `bun run scripts/check-user-search.ts`.

Ver [[area-admin]], [[componentes-html]], [[passe-cena]].
