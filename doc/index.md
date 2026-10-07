---
title: Cidoa — Visão Geral
tags:
  - cidoa
  - arquitetura
  - overview
aliases:
  - Documentação Principal
  - Home
---

# Cidoa — Documentação

Cidoa é uma cena 3D de cidade procedural feita com `React 19`, `Three.js`, `TypeScript` e `Vite`. Gera prédios baseados em doações, com texturas PBR, iluminação configurável e sistema de sombras — tudo controlável via painel em tempo real.

> [!abstract] Para quem é essa documentação?
> O objetivo é ajudar um dev júnior a entender por onde a aplicação começa, onde cada responsabilidade fica, em qual arquivo mexer e como os dados saem do React e chegam na cena 3D.

> [!important] Estilo de escrita
> Toda escrita aqui = modo homem das cavernas. Corta artigo, enchimento, hedge. Fragmento OK. Termo técnico exato. Code block, wikilink, Mermaid ficam intactos.

## Como a Documentação Está Organizada

As páginas ficam em pastas que **espelham as pastas do código** — assim você acha o doc pelo mesmo caminho do arquivo.

| Pasta da doc       | Espelha          | O que documenta                                            |
| ------------------ | ---------------- | ---------------------------------------------------------- |
| `components/`      | `src/components` | Interface React: painel de controle e canvas               |
| `scene/engine/`    | `src/scene`      | Maquinaria que monta e roda a cena (runtime, hooks, managers, builders) |
| `scene/foundation/`| `src/scene`      | Base que o engine consome: config, tipos e utils           |
| `admin/`           | `src/components` · `src/pages/admin` | Área admin (fora da cena): UI HTML/shadcn, roteamento, login e dashboard |
| `passe/`           | transversal      | Gamificação: liberação de personalização por doação + indicação |

> [!tip] Adicionando uma página nova
> 1. Crie o `.md` dentro da pasta cujo **tema** combina (componente novo → `components/`; peça nova da cena → `scene/engine/`; tipo/config novo → `scene/foundation/`).
> 2. Linke com wikilink pelo **nome do arquivo**, ex.: `[[scene-runtime]]` — funciona de qualquer pasta, não use o caminho.
> 3. Registre a página aqui no `index.md` (árvore de arquivos + tabela "Onde Mexer?").

## Visão Geral Rápida

O projeto é dividido em 3 grandes partes:

| Pasta            | Responsabilidade                                                       |
| ---------------- | ---------------------------------------------------------------------- |
| `src/components` | Interface React — editor, painel lateral e canvas                      |
| `src/scene`      | Lógica 3D — tipos, configs, utils, builders, managers, hooks e runtime |
| `doc`    | Documentação da estrutura                                              |

## Estrutura de Arquivos

```text
scripts/
  ui-add.sh                    ← adiciona primitivo shadcn corrigindo o CLI (`bun run ui:add <nome>`)
  encode-ktx2.mjs              ← converte texturas PBR pra KTX2 (`npm run textures:ktx2`)
  check-pass.mjs               ← ordenação do passe sem servidor/navegador
  check-city-search.mjs        ← busca de cidade (acento, prefixo antes de substring, UF, limite) sem navegador
  check-contribution.mjs       ← máscara monetária: 2 casas fixas, digitação/exclusão, colagem BRL e validação; sem servidor/navegador
  check-building-shapes.mjs    ← checa os 12 formatos + o preview do admin sem navegador (`node scripts/check-building-shapes.mjs`)
  check-building-textures.mjs  ← troca de textura no destaque padrão; reuso de meshes/cache, sem navegador
  check-horizon.mjs            ← horizonte, montanhas e culling no runtime sem servidor/navegador/GPU
public/
  basis/                       ← transcoder basis do KTX2Loader (js + wasm)
src/
  App.tsx
  main.tsx                      ← entry; reload em `vite:preloadError` (chunk de deploy antigo)
  index.css
  api/
    http.ts
    admin/
      admin.routes.ts             ← sessão do painel (login senha/me/logout) + usuários + rotas /admin
    auth/
      auth.routes.ts              ← sessão da cena: login e cadastro passwordless/Google
      auth.types.ts               ← contratos do perfil + desafio por código
    referral/
      referral.routes.ts          ← preview, resumo e confirmação de indicação
      referral.types.ts           ← contratos do sistema de indicação
      referral.logic.ts           ← normalização e decisão do modal
    user/
      user.routes.ts              ← perfil próprio + `completeOnboarding` (sessão da cena)
      user.types.ts               ← usuário público (imagem base64, cidade, origem, onboarding)
    location/
      location.routes.ts          ← `getCities()`: catálogo IBGE, 1 requisição memoizada por carga
      location.types.ts           ← `City { id, name, uf }`
    customizationApi.ts             ← catálogo de personalizações + conquistas do usuário
    donationApi.ts                  ← snapshot + personalizações atuais + doações próprias + PUT da personalização
    contributionApi.ts              ← costura Pix + perfil do edifício (mock em memória até o back)
    regions.ts
  pages/admin/
    Pass.tsx                    ← página dedicada /dale/passe
    Users.tsx                   ← /dale/usuarios: busca conta, menu ⋮ (admin/excluir), paginação
  components/
    pass/
      PassTrack.tsx             ← trilha/grade reutilizável, um cartão por recompensa
    customization/
      CustomizationImage.tsx    ← miniatura compartilhada com catálogo
    admin/
      UnlockDialog.tsx          ← editor de requisitos compartilhado
    ui/
      badge.tsx                     ← Badge shadcn; requisito de liberação no admin
      switch.tsx                    ← Switch shadcn usado nas ativações do admin
      pagination.tsx                ← Pagination shadcn; botão no lugar de <a> (página é estado, não URL)
      select.tsx                    ← Select shadcn; filtro de personalização no admin
      toast.tsx                     ← notificações: toast.* + <Toaster /> (Radix Toast), cena e admin
    AuthMenu.tsx                  ← botão do usuário na cena: Entrar ou abre o GameMenu; fluxo de indicação; monta o onboarding
    OnboardingDialog.tsx          ← 1º login: cidade + como conheceu, opcional, uma vez por conta, "Pular"
    ProfileDetailsFields.tsx      ← campos compartilhados onboarding/Perfil: busca de cidade + chips de origem
    GameMenu.tsx                  ← menu estilo GTA: abas perfil/doações/personalizações/indicações, dia/noite, sair
    AuthDialog.tsx                ← login por e-mail ou Google; cadastro confirma nome + username
    AuthProvider.tsx              ← sessão da cena (cookie token_access), só na rota /
    AdminAuthProvider.tsx         ← sessão do painel (cookie token_admin), só em /dale/*
    RequireAdmin.tsx              ← guarda de /dale: exige sessão do painel
    ProfilePanel.tsx              ← aba Perfil do GameMenu: nome, username, imagem, cidade e como conheceu
    referral/
      ReferralDialog.tsx          ← confirmação e avisos da indicação
      ReferralPerson.tsx          ← nome e imagem do indicador
      ShareDialog.tsx             ← `SharePanel` (redes + copiar link, inline no menu) + `ShareDialog` (modal da home)
    CitySceneEditor.tsx
    html/
      CityControlPanel.tsx
      BuildingHeightInput.tsx
      BuildingLayoutCard.tsx       ← card flutuante: modo de layout + teto de edifícios na tela
      DonationLoadOverlay.tsx
      DonationFilterBar.tsx
      BuildingInfoModal.tsx          ← card só-leitura do prédio clicado; lápis só p/ dono/admin
      donate/
        ContributeDialog.tsx         ← pílula Contribuir + modal 3 etapas: contribuição → Pix → seu edifício
        BuildingProfileForm.tsx      ← imagem/nome/descrição do edifício + dialog de edição
      BuildingCustomizePanel.tsx
      BuildingControls.tsx
      TextureControls.tsx
      ReflectionControls.tsx         ← aba reflexo: probe do envMap dos prédios
      GroundControls.tsx
      HorizonControls.tsx          ← modos do final do chão, distâncias e névoa
      TerrainControls.tsx
      SceneLightControls.tsx
      EnvironmentControls.tsx
      PointLightControls.tsx
  lib/
    image.ts                       ← valida e reduz imagens proporcionalmente para até 400 px
    citySearch.ts                  ← busca de cidade pura: sem acento, prefixo antes de substring
    moneyInput.ts                  ← máscara monetária da contribuição: vírgula/2 casas sempre, milhar e colagem em reais
    pass.ts                        ← contrato visual e ordenação por esforço estimado
    adminUnlock.ts                 ← alvos de edição por opção/feature
    unlock.ts                      ← fonte única: requisito do passe → texto (badge, frase, o que falta)
    pagination.ts                  ← janela de páginas da barra de paginação (1, atual ± 1, última)
      PanelIntro.tsx
      KeyboardShortcutsHelp.tsx
      controls/
        PanelSection.tsx
        ColorField.tsx
        RangeField.tsx
        NumberField.tsx
        CheckboxField.tsx
        PointLightCard.tsx
    hooks/
      useKeyboardShortcuts.ts
      useDonations.ts
      useCustomizationCatalog.ts   ← carrega catálogo de personalizações 1×
      useOwnedDonationIds.ts       ← ids das doações da sessão (quem pode editar)
    three/
      CitySceneCanvas.tsx
      CustomizationPreview.tsx     ← miniatura + preview 3D de formato/topo/LED (admin)
  scene/
    types.ts
    config/
      citySceneConfig.ts
      buildingConfig.ts
      textureConfig.ts
      groundConfig.ts
      horizonConfig.ts             ← linha reta por padrão
      terrainConfig.ts
      lightConfig.ts
      environmentConfig.ts
      reflectionConfig.ts
      blockLayoutConfig.ts
      uiVisibilityConfig.ts
    builders/
      createLightingRig.ts
      createGroundPlane.ts
      createTerrain.ts
      createRooftopMesh.ts
      createParapetMesh.ts         ← platibandas automáticas, 3 modelos instanciados
      createSignMesh.ts
      createEdgeLightMesh.ts
      createBuildingShapeMesh.ts   ← registro formato → builder (cena + admin)
      createPreviewScene.ts        ← cena isolada de 1 personalização (preview do admin)
      createTwistedBuildingMesh.ts
      createOctagonalBuildingMesh.ts
      createSetbackBuildingMesh.ts
      createTaperedBuildingMesh.ts
      createHearstBuildingMesh.ts
      createEmpireBuildingMesh.ts
      createTaipeiBuildingMesh.ts
      createOneTradeBuildingMesh.ts
      createYachthouseBuildingMesh.ts ← torres gêmeas sobre embasamento comum
      createResidentialBuildingMesh.ts ← torre residencial com sacadas, vidro refletindo a cena
      createHologramMesh.ts
      loadEnvironment.ts
    managers/
      createDonationManager.ts
      createChunkManager.ts   ← referência arquitetural
    textures/
      facadeTextureManifest.ts  ← descobre pastas de textura (glob, sem THREE). PNG/JPG > KTX2
      facadeTextureLoader.ts    ← carrega set PBR (KTX2Loader, lazy + async + cache)
    hooks/
      useCityScene.ts
    runtime/
      createCitySceneRuntime.ts
    utils/
      math.ts
      materials.ts
      lighting.ts
      random.ts
      instanceCulling.ts
      devAssertions.ts
doc/
  index.md                       ← você está aqui (mapa da documentação)
  api/                           ← espelha src/api (camada de dados / doações)
    donation-api.md
    referral.md                  ← links, código, confirmação e compartilhamento
    customization-api.md         ← catálogo, conquistas do usuário, formatação do requisito
    contribution-api.md          ← Pix + perfil do edifício: contrato, mock, regras pro back
  components/                    ← espelha src/components (interface React)
    html-components.md
    three-components.md
  scene/                         ← espelha src/scene (lógica 3D)
    engine/                      ← maquinaria que monta e roda a cena
      scene-runtime.md
      scene-hooks.md
      scene-managers.md
      scene-builders.md
      scene-textures.md          ← texturas: manifesto, loader lazy/async/cache, pipeline KTX2, por-edifício
    foundation/                  ← base de dados consumida pelo engine
      scene-config.md
      scene-types.md
      scene-utils.md
  passe/                         ← gamificação (transversal: api + lib + admin + cena)
    passe-front.md               ← índice do módulo: contrato, estado, mapa
    passe-formatacao.md          ← src/lib/unlock.ts — requisito vira texto (fonte única)
    passe-admin-ui.md            ← tela onde admin define quanto custa cada personalização
    passe-cena.md                ← cadeado no painel do usuário (fase seguinte)
  admin/                         ← área admin do front (fora da cena 3D)
    componentes-html.md          ← base de UI: shadcn, tema, roteamento, componentes
    area-admin.md                ← login, dashboard, auth e API admin
    edificios-teste.md           ← gerar/excluir edifícios fictícios em massa
    personalizacoes.md           ← CRUD do catálogo de personalizações
    ibge.md                      ← vincular catálogo geográfico do IBGE
    usuarios.md                  ← listar contas, dar/tirar admin, excluir usuário; o que admin ganha
```

## Fluxo da Aplicação

### 1. Entrada

- `src/main.tsx` → renderiza React no `#root`
- `src/App.tsx` → `BrowserRouter` com rotas lazy: `/` = `CitySceneEditor` (cena) dentro de `AuthProvider`; `/dale/login` + `/dale` = área admin dentro de `AdminAuthProvider` (layout route) + `RequireAdmin` (ver [[componentes-html#Roteamento]] e [[area-admin]]). Cada área monta só a própria sessão — login numa não abre a outra ([[area-admin#Duas sessões (cena × painel)]]). `<Toaster />` global montado aqui — ver [[componentes-html#Notificações (toast)]]
- Acesso público na cena → `AuthDialog`: e-mail → código, ou Google. Conta existente entra; conta nova confirma `name` + `username` (Google já sugere ambos) com o e-mail bloqueado na tela. Campo de indicação fica no rodapé do modal, escondido atrás de link sublinhado; `?ref=` já abre preenchido com preview. Ver [[area-admin#Login público na cena (passwordless)]] e [[referral]].

### 2. Container Principal

`src/components/CitySceneEditor.tsx` é o componente mais importante do lado React.

Ele guarda todos os estados:

- `buildingSettings`, `textureSettings`, `groundSettings`
- `lightSettings`
- `environmentSettings`, `reflectionSettings`, `horizonSettings`, `blockLayoutSettings`, `terrainSettings`
- `sceneStats`, `hoverInfo`
- `showControlPanel` — toggle do painel de configuração (escondido por padrão)
- `infoBuildingId` — edifício clicado; abre [[html-components#BuildingInfoModal.tsx|BuildingInfoModal]]
- `selectedBuildingId` — edifício em personalização; painel só renderiza se `canEdit` (dono ou admin, ver [[donation-api#Quem pode editar]])
- `buildingCustomizations` — `Map<donationId, BuildingCustomization>` com cor, formato (default/twisted/octagonal/setback/tapered/chrysler/hearst/empire/taipei/one-trade/yachthouse/residential), acessório de topo (holofotes, heliponto, jardim suspenso ou helicóptero com casco único, vidros integrados e rotores proporcionais), letreiro, LED de arestas e holograma cyberpunk. **Persistido**: nasce do snapshot, cada mudança grava em `donation.customization` no banco — ver [[donation-api#Personalização persistida]]
- Falha da gravação (sem login, prédio de outro, opção travada) → toast por edifício, ver [[donation-api#Personalização persistida]]

E entrega para:

- [[three-components|CitySceneCanvas]] — monta a cena 3D
- [[html-components|CityControlPanel]] — mostra os controles (abre pelo ícone de engrenagem, que some quando o painel está aberto; fecha pelo "X" na barra de abas)
- [[html-components#BuildingCustomizePanel.tsx|BuildingCustomizePanel]] — personalização do edifício selecionado com cor, formato, letreiro, topo, LED e holograma (upload de imagem ou GIF), sem controles de textura
- [[html-components#BuildingHeightInput.tsx|BuildingHeightInput]] — input de doação e layout
- [[html-components#BuildingLayoutCard.tsx|BuildingLayoutCard]] — card flutuante: modo de layout + quantos edifícios entram na cena

Também gerencia:

- Doações do backend via `useDonations` (snapshot cacheado + personalizações `no-store`) → `canvasRef.setDonations(donations)` quando `loadState.status === "ready"`. Ver [[donation-api]]
- Contribuição: ONG escolhida a cada pagamento; mesmo edifício apoia várias ONGs. Máximo 3 edifícios por conta, validado no backend/banco. Aumentar com vários exige escolher destino. Pix segue simulado; ver [[contribution-api]].
- Teto de edifícios na cena (`visibleLimit`, padrão `null` = todos): ordena por valor desc e corta antes do `setDonations`, então o corte fica com as maiores doações. Controlado pelo [[html-components#BuildingLayoutCard.tsx|BuildingLayoutCard]]
- Doações manuais via `canvasRef.addDonation(value)` e `canvasRef.addDonations(values)`
- Foco em edifício via `canvasRef.focusOnDonation(id)` e `canvasRef.clearFocus()`
- Personalização via `canvasRef.updateDonationCustomization(id, customization)`

### 3. Canvas 3D

[[three-components|CitySceneCanvas.tsx]] cria um `div` com `ref` e chama o hook [[scene-hooks|useCityScene]], que monta o renderer Three.js dentro do div.

### 4. Painel Lateral

[[html-components|CityControlPanel.tsx]] organiza os componentes do painel em abas. Não conhece Three.js — só atualiza estado React.

### 5. Hook da Cena

[[scene-hooks|useCityScene.ts]] conecta React com Three.js. Cria o runtime uma vez, depois sincroniza mudanças de estado chamando métodos do runtime.

### 6. Runtime da Cena

[[scene-runtime|createCitySceneRuntime.ts]] é o cérebro do Three.js. Orquestra scene, camera, renderer, controls, builders e managers.

Aba **Horizonte** → **Final do chão**: **Linha reta** (padrão), **Circular** ou **Quadrado (original)**. `groundEdgeMode` escolhe formato; `groundDistance` (20–2200, padrão 660) define distância à frente, raio ou meio lado. Reta acompanha direção da câmera e dimensiona laterais pelo frustum completo, evitando quinas mesmo em ultrawide ou distância curta. Névoa suaviza transição. `renderDistance` continua controlando câmera/céu; edifícios preservam controle próprio. Montanhas e chão da cidade (lotes, calçadas, postes, asfalto) seguem o horizonte (1.8·`far`), não o slider dos edifícios: raio menor desenha arco dentro da imagem e o chão parece encolher quando a câmera mexe. Pesquisa e limites em [[scene-builders#createGroundPlane.ts]]; integração em [[scene-runtime#Alcance visual e distância dos edifícios]].

## Diagrama de Fluxo

```mermaid
flowchart TD
    A[main.tsx] --> B[App.tsx]
    B --> C[CitySceneEditor]
    C --> D[CitySceneCanvas]
    C --> E[CityControlPanel]
    C --> F[BuildingHeightInput]
    C --> BI[BuildingInfoModal]
    C --> P[BuildingCustomizePanel]
    C --> BL[BuildingLayoutCard]
    D --> G[useCityScene]
    G --> H[createCitySceneRuntime]
    H --> I[createLightingRig]
    H --> J[createGroundPlane]
    H --> TR[createTerrain]
    H --> L[loadEnvironment]
    H --> M[createDonationManager]
    M --> N[createRooftopMesh]
    M --> O[createSignMesh]
    M --> Q[createEdgeLightMesh]
    M --> BS[createBuildingShapeMesh]
    BS --> T[createTwistedBuildingMesh]
    BS --> U[createOctagonalBuildingMesh]
    BS --> V[createSetbackBuildingMesh]
    BS --> W[createTaperedBuildingMesh]
    BS --> X[createHearstBuildingMesh]
    BS --> Y[createEmpireBuildingMesh]
    BS --> Z[createTaipeiBuildingMesh]
    BS --> OT[createOneTradeBuildingMesh]
    BS --> YC[createYachthouseBuildingMesh]
    BS --> RS[createResidentialBuildingMesh]
    M --> HG[createHologramMesh]
    E --> C
    P --> C
```

## Fluxo de Personalização de Edifícios

```mermaid
flowchart LR
    Click[Clique no edifício] --> Focus[focusOnDonation]
    Focus --> Info[BuildingInfoModal]
    Info --> |lápis, só dono/admin| Panel[BuildingCustomizePanel]
    Panel --> |cor| UC[updateCustomization]
    Panel --> |formato| UC
    Panel --> |letreiro| UC
    Panel --> |topo| UC
    Panel --> |holograma| UC
    UC --> Runtime[runtime.updateDonationCustomization]
    Runtime --> DM[donationManager]
    DM --> |cor| IC[instanceColor]
    DM --> |formato| BS[createBuildingShapeMesh]
    BS --> SH["builder do formato<br/>twisted · octagonal · setback · tapered · chrysler<br/>hearst · empire · taipei · one-trade · yachthouse · residential"]
    DM --> |topo| RM[createRooftopMesh]
    DM --> |sign| SM[createSignMesh]
    DM --> |LED| EL[createEdgeLightMesh]
    DM --> |holograma| HM[createHologramMesh]
    Admin[Admin · Personalizações] --> CP[CustomizationPreview]
    CP --> PS[createPreviewScene]
    PS --> BS
    PS --> RM
    PS --> EL
```

## Onde Mexer?

| Objetivo                                         | Arquivo                                           |
| ------------------------------------------------ | ------------------------------------------------- |
| Alterar valor padrão dos prédios                 | [[scene-config]]                                  |
| Alterar a UI do painel de configuração           | [[html-components#CityControlPanel.tsx]]          |
| Granulado de render sob carga (padrão `0`)       | aba **tela** em [[html-components#CityControlPanel.tsx]] · `setGrain` em [[scene-runtime#Granulado (setGrain)]] |
| Menu do usuário (abas, perfil, doações, sair)    | [[html-components#GameMenu.tsx]]                  |
| Modo noite: toggle no menu do usuário            | [[area-admin#Modo noite (menu do usuário)]]       |
| Modo noite: céu escuro e estrelas                | [[scene-builders#loadEnvironment.ts]]             |
| Modo noite: luz, IBL e névoa                     | [[scene-runtime#Modo noite]] · `NIGHT_PRESET` em [[scene-config#environmentConfig.ts]] |
| Modo noite: janelas acesas na fachada            | [[scene-managers#Janelas acesas de noite]]        |
| Modo noite: brilho das janelas (slider)          | seção **Ambiente** → [[html-components#EnvironmentControls.tsx]] |
| Postes de luz nas ruas (quantidade, altura, luz) | [[scene-managers#Postes de Luz (rebuildStreetLamps)]] |
| Adicionar/alterar atalho de teclado              | [[html-components#Atalhos de teclado]]            |
| Mostrar/esconder componentes HTML da tela        | aba **Tela** → [[scene-config#uiVisibilityConfig.ts]] |
| Trocar modo de layout (quadra × centro)          | [[html-components#BuildingLayoutCard.tsx]]        |
| Limitar quantos edifícios aparecem na tela       | [[html-components#BuildingLayoutCard.tsx]] · `visibleLimit` no `CitySceneEditor` |
| Alterar a UI de personalização de edifício       | [[html-components#BuildingCustomizePanel.tsx]]    |
| Botão Contribuir / fluxo de contribuição         | [[html-components#ContributeDialog.tsx]]          |
| Busca de ONG / campo de valor / resumo do Pix     | [[html-components#ContributeDialog.tsx]] · `src/lib/moneyInput.ts` · `scripts/check-contribution.mjs` |
| Pagamento Pix / contrato pro backend / mock      | [[contribution-api]]                              |
| Imagem, nome e descrição do edifício             | [[html-components#BuildingProfileForm.tsx]]       |
| Card de info do prédio / quem pode editar        | [[html-components#BuildingInfoModal.tsx]] · [[donation-api#Quem pode editar]] |
| Personalização salvar/carregar do banco          | [[donation-api#Personalização persistida]]        |
| Entender de onde vêm as opções de personalização | [[customization-api]]                             |
| Cadastrar/ativar cores e opções (admin)          | [[personalizacoes]]                               |
| Entender a gamificação inteira                   | [[passe-front]]                                   |
| Definir quanto doar/indicar pra liberar (admin)  | [[passe-admin-ui#Dialog de liberação]]            |
| Ver a curva inteira de conquistas (admin)        | [[passe-admin-ui#Visão Passe]]                    |
| Reutilizar a trilha visual para usuários         | [[html-components#PassTrack.tsx]]                |
| Mudar o texto do requisito ("R$ 50 + 3 indicações") | [[passe-formatacao]]                           |
| Colocar cadeado na cena / painel do usuário      | [[passe-cena]]                                    |
| Trocar textura da fachada (UI) / entender loading | [[scene-textures]] · aba **texturas** → [[html-components#TextureControls.tsx]] |
| Cadastrar textura nova (dropar pasta + `npm run textures:ktx2` + admin) | [[scene-textures]] · [[personalizacoes]] |
| Textura por edifício (usuário escolhe a dele)    | [[scene-textures#Por edifício]] · [[html-components#BuildingCustomizePanel.tsx]] |
| Textura sorteada por edifício (cidade variada)   | [[scene-textures#Sorteio por edifício]] · [[scene-managers#Grupos de fachada]] |
| Mexer no pipeline KTX2 (codec, tamanho, qualidade) | [[scene-textures#Pipeline KTX2]] · `scripts/encode-ktx2.mjs` |
| Alterar o canvas ou a ligação com o hook         | [[three-components]]                              |
| Alterar fórmulas de luz, clamp ou material       | [[scene-utils]]                                   |
| Mexer no cull de distância do chão (quadra, calçada, poste, asfalto) | [[scene-utils#`instanceCulling.ts`]] · [[scene-managers#Cull do chão da cidade]] |
| Mexer no cull de distância das montanhas         | [[scene-builders#createTerrain.ts]]               |
| Alterar criação do chão, grid, luzes ou ambiente | [[scene-builders]]                                |
| Alterar o relevo procedural (terreno verde)      | [[scene-builders#createTerrain.ts]]               |
| Alterar valores padrão do relevo                 | [[scene-config#terrainConfig.ts]]                 |
| Alterar a UI dos controles de relevo (aba **terreno**) | [[html-components#TerrainControls.tsx]]     |
| Alterar acessórios de topo                       | [[scene-builders#createRooftopMesh.ts]]           |
| Alterar platibandas automáticas                  | [[scene-builders#createParapetMesh.ts]]           |
| Alterar letreiros de fachada (signs)             | [[scene-builders#createSignMesh.ts]]              |
| Alterar LED de arestas                           | [[scene-builders#createEdgeLightMesh.ts]]         |
| Ajustar luz do LED nos vizinhos (intensidade, alcance, nº de luzes) | [[scene-managers#Fora do reflexo, dentro da luz]] |
| Alterar holograma cyberpunk                      | [[scene-builders#createHologramMesh.ts]]          |
| Adicionar formato de edifício novo               | [[scene-builders#createBuildingShapeMesh.ts]] + [[scene-types#BuildingShape]] |
| Ver formato/topo/LED em 3D no admin              | [[personalizacoes#Preview 3D: Formato, Topo e LED]] · [[three-components#CustomizationPreview.tsx]] |
| Dar preview 3D a outra categoria do catálogo     | `PREVIEW_KIND` em `src/lib/pass.ts` + [[scene-builders#createPreviewScene.ts]] |
| Alterar torre torcida (twisted)                  | [[scene-builders#createTwistedBuildingMesh.ts]]   |
| Alterar torre octogonal (octagonal)              | [[scene-builders#createOctagonalBuildingMesh.ts]] |
| Alterar torre setback (setback)                  | [[scene-builders#createSetbackBuildingMesh.ts]]   |
| Alterar torre afunilada (tapered)                | [[scene-builders#createTaperedBuildingMesh.ts]]   |
| Alterar torre Hearst (hearst)                    | [[scene-builders#createHearstBuildingMesh.ts]]    |
| Alterar torre Empire State (empire)              | [[scene-builders#createEmpireBuildingMesh.ts]]    |
| Alterar torre Taipei 101 (taipei)                | [[scene-builders#createTaipeiBuildingMesh.ts]]    |
| Alterar torres Yachthouse (yachthouse)           | [[scene-builders#createYachthouseBuildingMesh.ts]] |
| Alterar torre residencial com sacadas (residential) | [[scene-builders#createResidentialBuildingMesh.ts]] |
| Alterar torre One Trade (one-trade)              | [[scene-builders#createOneTradeBuildingMesh.ts]]  |

| Alterar torre Chrysler (chrysler) | [[scene-builders#createChryslerBuildingMesh.ts]] |
| Carregar/buscar doações do backend | [[donation-api]] |
| Filtrar doações por região/UF/cidade/ONG | [[donation-api]] |
| Overlay de carregamento / barra de filtros | [[html-components]] |
| Alterar geração dos prédios de doação | [[scene-managers]] |
| Alterar loteamento / lotes vazios / asfalto | [[scene-managers#Loteamento e Lotes Vazios]] |
| Ajustar destaque da quadra central (escala/altura das torres, prédio do centro) | [[scene-managers#Destaque da Quadra Central]] |
| Alterar calçada / faixa central / cruzamentos | [[scene-managers#Rede de Estradas (Asfalto)]] |
| Alterar postes de luz das ruas | [[scene-managers#Postes de Luz (rebuildStreetLamps)]] |
| Trocar a cor das quadras (UI) | aba **geral** → seção Quadras → [[html-components#CityControlPanel.tsx]] |
| Trocar cor/altura da calçada (UI) | aba **geral** → seção Calçada → [[html-components#CityControlPanel.tsx]] |
| Alterar o ciclo completo da cena | [[scene-runtime]] |
| Ajustar reflexo dos prédios (probe do envMap) | [[scene-runtime#Probe de reflexo (envMap dos prédios)]] |
| Controlar reflexo pela UI (posição, qualidade, cadência) | aba **reflexo** → [[html-components#ReflectionControls.tsx]] |
| Mudar a direção do reflexo (reflexo só nas laterais) | aba **reflexo** → seção Direção do reflexo → [[scene-runtime#Probe de reflexo (envMap dos prédios)]] |
| Entender o contrato dos dados | [[scene-types]] |
| Entender como React sincroniza com Three.js | [[scene-hooks]] |
| Mexer na UI/tema/componentes do admin | [[componentes-html]] |
| Mexer no login, dashboard ou auth do admin | [[area-admin]] |
| Mexer no login do painel / sessão admin (`token_admin`) | [[area-admin#AdminAuthProvider]] · guarda em [[area-admin#RequireAdmin]] |
| Sessão da cena vs painel (cookies, providers, 401) | [[area-admin#Duas sessões (cena × painel)]] |
| Botão de login + modal passwordless na cena | [[area-admin#Login público na cena (passwordless)]] |
| Onboarding do 1º login (cidade, como conheceu, pular) | [[html-components#OnboardingDialog.tsx]] · [[area-admin#Perfil progressivo (onboarding)]] |
| Campo Cidade (busca) / chips "Como conheceu?" | [[html-components#ProfileDetailsFields.tsx]] · busca em `src/lib/citySearch.ts` |
| Rótulos das origens ("Instagram", "Uma ONG"…) | `DISCOVERY_LABELS` em [[html-components#ProfileDetailsFields.tsx]] |
| Gerar/excluir edifícios fictícios em massa (admin) | [[edificios-teste]] |
| Vincular catálogo do IBGE (regiões/estados/municípios) | [[ibge]] |
| Colocar um usuário como admin | [[usuarios]] |
| Excluir um usuário e todos os dados dele | [[usuarios#Excluir usuário]] |
| Entender o que admin libera (personalização sem cadeado) | [[usuarios#O que admin ganha]] · [[passe-cena]] |
| Adicionar rota ou página no admin | [[componentes-html#Roteamento]] |
| Adicionar primitivo shadcn (`bun run ui:add <nome>`) | [[componentes-html#Adicionar primitivo shadcn]] |
| Mostrar aviso/erro temporário (toast) | [[componentes-html#Notificações (toast)]] |

## Ordem de Leitura Recomendada

1. `src/App.tsx`
2. `src/components/CitySceneEditor.tsx`
3. [[html-components]]
4. [[three-components]]
5. [[scene-hooks]]
6. [[scene-runtime]]
7. [[scene-managers]]
8. [[scene-builders]]
9. [[scene-config]]
10. [[scene-utils]]

Gamificação (transversal, ler à parte): [[passe-front]] → [[passe-formatacao]] → [[passe-admin-ui]] → [[passe-cena]]

## Ideia Central da Arquitetura

```
React  → estado e interface
Three.js → renderização 3D
config   → valores padrão
types    → contratos
utils    → funções puras
builders → peças isoladas da cena
managers → partes complexas com estado interno
runtime  → orquestra tudo
hooks    → ponte React ↔ runtime
```

> [!tip] Padrões do projeto
>
> - **Factory functions** em vez de classes (`create*()`)
> - **Dispose explícito** — todo recurso Three.js tem cleanup
> - **InstancedMesh** para performance nos prédios
> - **Seeded random** para geração determinística por posição
> - **Texto de interface enxuto** — label diz o que é; descrição só quando label não basta,
>   uma frase curta e direta. Sem descrição decorativa nem explicação longa.

## Benefícios dos primeiros inscritos

- [[primeiros-inscritos]] — página própria `/dale/primeiros-inscritos`; combo, quantidade, ativação e contagem histórica.
- `src/pages/admin/EarlySignups.tsx` — gestão; `src/api/admin/admin.routes.ts` + `admin.types.ts` — contrato.
- `scripts/check-customization-access.mjs` — verifica presente permanente, requisitos e sessão ausente.

## Passe: doação ou indicação

Quatro modalidades: doação, indicação, doação + indicação (`all`) e doação ou indicação (`any`). Editor compartilhado, cartões e textos seguem o modo. Ver [[passe-admin-ui]] e [[passe-formatacao]].

## Balanceamento inicial do Passe

[[passe-balanceamento]] — regras aplicadas, faixas editoriais e ordenação por esforço: doação, indicação, AND e OR.
