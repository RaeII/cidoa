---
title: Contribuição e Pix (API)
tags:
  - api
  - contribuicao
  - pix
aliases:
  - contribution-api
---

# Contribuição e Pix — `src/api/contributionApi.ts`

API compartilhada: cobrança Pix em [[html-components#ContributeDialog.tsx|Contribuir]]; perfil em [[html-components#BuildingManageDialog.tsx|administração do edifício]] (imagem, nome, descrição). Fluxos de interface independentes.

> [!info] Gravado no banco
> Cobrança, pagamento e perfil vivem no backend (`donation_charge`, `donation_profile`, migration `0019`). Pago = edifício gravado em `donation`; recarregar/relogar mantém. Sem PSP: back só gera Pix com `PIX_SIMULATED=1` (dev, nunca produção); desligado → `503` com mensagem na tela.

## Contrato

```ts
type Contribution =
  | { donationId: null; ongId: number; cityId: number; value: number } // erguer
  | { donationId: number; ongId: number; value: number };              // aumentar (mantém cidade)

type PixCharge = {
  id: string;
  contribution: Contribution; // eco do pedido: resumo + retomada
  copyPaste: string;          // Pix Copia e Cola
  qrCodeImage: string;        // data URL, nunca URL externa
  expiresAt: string;          // ISO 8601; tela mostra "Válido até HH:MM"
  receiverName: string;       // nome que o app do banco mostra
};

type ChargeStatus =
  | { status: "pending" }
  | { status: "paid"; donationId: number } // edifício novo ou o aumentado
  | { status: "expired" };                 // vencida ou cancelada

type BuildingProfile = {
  name: string | null;        // ≤ 40
  description: string | null; // ≤ 160
  image: string | null;       // data URL JPEG de resizeImage(file, 800)
};
```

| Função | Rota | Quem chama | Regra no back |
|---|---|---|---|
| `createPixCharge(c)` | `POST /donation/charges` → `201 PixCharge` | etapa 1 / "Gerar novo código" | Sessão, máximo 3 edifícios, destino próprio, ONG ativa/cidade existente. Cancela pendente anterior. `400`/`503` com `message` na tela; `401` abre login |
| `getChargeStatus(id, signal)` | `GET /donation/charges/:id` | poll 3 s + `visibilitychange` | Só dono (`404` resto). Lê **nosso** banco, nunca o PSP. Simulado: aqui vira `paid` e grava edifício |
| `getPendingCharge(signal)` | `GET /donation/charges/pending` → `{ data }` | ao logar / remontar | 1 pendente no prazo por usuário; `null` = nenhuma |
| `fetchBuildingProfile(id, signal)` | `GET /donation/:id/profile` → `{ data }` | administração, card do edifício | Público, `no-store`. Fora do snapshot (imagem incharia toda carga) |
| `saveBuildingProfile(id, p)` | `PUT /donation/:id/profile` → `204` | administração, "Editar nome e imagem" | Dono ou admin (`404` resto). Substitui tudo; vazio vira `null` |

Pago → `onPaid` → editor relê `/donation/me` e mescla na cidade — ver [[donation-api#Edifícios do usuário no login]].

## Backend

- `donationId: null` ergue; `donationId` positivo aumenta edifício próprio escolhido. `ongId` obrigatório nos dois casos; não precisa coincidir com ONG anterior.
- `donation` mantém valor total/cidade/dono. `donation_beneficiary` acumula por edifício + ONG. `building_slot` + índice único bloqueiam quarto edifício mesmo sob concorrência.
- Confirmação trava a cobrança (`FOR UPDATE`): polls simultâneos gravam edifício uma vez só. Destino sumiu entre Pix e pagamento (ONG desligada, limite) → simulado marca `expired`.
- Validade 1 h (MP aceita 30 min–30 dias; padrão BCB 24 h).
- Imagem do perfil = mesma regra Zod do `hologramImage`: só data URL, sem SVG, teto 1.000.000 chars.

### Falta para produção

- **PSP real**: webhook com assinatura verificada trava cobrança, chama `recordPaidContribution` + `markChargePaid` na mesma transação. Nunca descartar pagamento recebido (simulado expira; real precisa estorno/destino).
- **PSP sem CPF obrigatório** de preferência (Asaas exige `cpfCnpj`; Efí, devedor opcional). Campo a mais = abandono.
- **Moderação** de imagem/texto públicos bloqueia produção.

## Pix simulado (testar à mão)

`PIX_SIMULATED=1` no `.env` do back.

- QR = SVG "TESTE"; recebedor "Cidoa"; validade 60 min.
- `getChargeStatus` → `paid` 6 s depois de criar; edifício gravado no banco.
- **Valor R$ 13** nunca paga e expira em 15 s → testa tela "Este código expirou.".
