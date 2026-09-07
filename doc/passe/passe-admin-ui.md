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

Página própria: `/dale/passe`. Entrada **Passe** na sidebar e navegação mobile. Catálogo/CRUD continua em `/dale/personalizacoes`, com atalho pro Passe.

## Arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/pages/admin/Pass.tsx` | Carregar árvore admin, montar recompensas, prévia pública, abrir edição |
| `src/components/pass/PassTrack.tsx` | Trilha horizontal reutilizável; uma recompensa por cartão |
| `src/components/customization/CustomizationImage.tsx` | Miniatura compartilhada entre catálogo e passe |
| `src/components/admin/UnlockDialog.tsx` | Editar requisito; usado nas duas páginas |
| `src/lib/pass.ts` | Contrato visual `PassReward`, ordenação e mapa de preview |
| `src/lib/adminUnlock.ts` | Alvos de edição por opção/categoria |

## Visão Passe

Cartões lado a lado, imagem grande, categoria, nome e requisito. Linha conecta posições numeradas. Requisitos iguais mantêm cartões separados.

Ordenação: **grátis primeiro → menor doação → menos indicações no empate**. Requisito só de indicação vem após grátis, antes das doações. Empates completos preservam ordem do catálogo. Posição representa ordenação visual; não exige conquistar cartão anterior.

Rolagem horizontal nativa, snap, botões anterior/próximo, região focável por teclado. Movimento dos botões respeita `prefers-reduced-motion`. Layout claro/escuro pelos tokens existentes.

| Personalização | Visual |
| --- | --- |
| Formato, topo, LED | `CustomizationThumb`: mesma geometria da cena, PNG cacheado, import lazy |
| Cor | Amostra da cor cadastrada |
| Textura | Imagem de preview da pasta, sem sufixo `_…`; mapas KTX2 não servem pra `<img>` |
| Letreiro / holograma | Ícones ilustrativos |
| Sem imagem cadastrada | Placeholder |

Opções base `default` e `none` ficam fora: estado inicial do edifício, não recompensa. Features usam requisito da categoria; demais usam requisito da opção.

## Prévia do usuário

Switch **Prévia do usuário** remove botões de edição e filtra inativas, incluindo categorias com ancestral inativo. Modo admin mantém cartões inativos identificados para configuração.

`PassTrack` recebe `rewards: readonly PassReward[]` e callback opcional `onConfigure`. Sem callback, somente leitura. Sem import de API/admin/auth. Outro consumidor pode fornecer recompensas do catálogo público. Prévia não carrega progresso individual; integração com conquistas continua em [[passe-cena]].

## Dialog de liberação

Botão **Configurar** no cartão abre `UnlockDialog`. Catálogo mantém atalhos por opção/feature, usando mesmo diálogo.

| Eixo | Significa |
| --- | --- |
| Exigir doação | Soma de tudo que usuário já doou |
| Exigir indicações | Total histórico de quem entrou pelo código dele |

Dois ligados = ambos necessários (AND). Switch desligado envia `null`, nunca zero. Ligado sem valor positivo bloqueia salvar.

- Preview da frase via `formatUnlockCta` ([[passe-formatacao]]).
- `unlockedCount > 0`: aviso de acesso permanente pra quem já conquistou.
- **Tornar grátis**: desliga ambos.
- Dinheiro aceita `50`, `50,90`, `1.234,56` e `50.5`.
- Sempre envia os dois campos: `null` limpa exigência.
- Salvar recarrega catálogo e reposiciona recompensa automaticamente.
- Falha de carregamento mostra erro + tentar novamente; lista vazia tem estado próprio.

## Badge do requisito

Catálogo mantém `Grátis`, `R$ 50`, `3 indicações`, `R$ 50 + 3 indicações` ou `Padrão`. Trilha destaca valor acumulado e indicações separadamente. Eixo não exigido nunca aparece.

## Regras-chave

- Ativo ≠ liberado. Desativar remove da cena; conquista fica registrada.
- Conquista permanente: subir requisito não remove acesso existente.
- `option_list`/`group` não recebem regra de categoria; editar opções.
- Backend invalida cache após escrita.

## Verificação

`node scripts/check-pass.mjs`: grátis, doações, indicações, centavos, empates, cartões individuais e entrada imutável. Sem servidor/navegador. `npm run build` + `npm run lint` verificam integração.

## Relacionado

- [[passe-front]] — mapa do módulo
- [[passe-formatacao]] — texto dos requisitos
- [[personalizacoes]] — catálogo e preview 3D
- [[html-components#PassTrack.tsx]] — contrato reutilizável
