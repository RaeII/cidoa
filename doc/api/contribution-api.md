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

Costura do fluxo [[html-components#ContributeDialog.tsx|Contribuir]]: cobrança Pix + perfil do edifício (imagem, nome, descrição).

> [!warning] Hoje = mock em memória
> Backend ainda não tem pagamento nem perfil. Arquivo é mock (`ponytail:`): backend troca o **corpo** das funções, **assinatura fica**. Recarregar página zera tudo; edifício novo ganha id **negativo** e some no reload.

## Contrato

```ts
type Contribution =
  | { donationId: null; ongId: number; cityId: number; value: number } // erguer
  | { donationId: number; value: number };                             // aumentar (herda ONG e cidade)

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

| Função | Quem chama | Regra no back |
|---|---|---|
| `createPixCharge(c)` | etapa 1 / "Gerar novo código" | Sessão. Cancela pendente anterior do usuário. 400 com `message` aparece na tela; 401 abre login |
| `getChargeStatus(id, signal)` | poll 3 s + `visibilitychange` | Só dono. Lê **nosso** banco, nunca o PSP |
| `getPendingCharge(signal)` | ao logar / remontar | 1 pendente por usuário; null = nenhuma |
| `fetchBuildingProfile(id, signal)` | etapa 3, card do edifício | Público. Fora do snapshot (imagem por edifício incharia o JSONB baixado em toda carga) |
| `saveBuildingProfile(id, p)` | etapa 3, "Editar nome e imagem" | Dono ou admin. Substitui tudo |

## Para o backend

- **Pago = webhook do PSP** (assinatura verificada) marca cobrança e cria/aumenta edifício no servidor. Front nunca confirma pagamento.
- **Validade recomendada 1 h** (MP aceita 30 min–30 dias; padrão BCB 24 h).
- **Imagem do perfil** = mesma regra Zod do `hologramImage`: só data URL, sem SVG, teto 1.000.000 chars (cabe no `json({ limit: "1mb" })`).
- **PSP sem CPF obrigatório** de preferência (Asaas exige `cpfCnpj`; Efí, devedor opcional). Campo a mais = abandono.
- `Idempotency-Key` no back.
- **Moderação** de imagem/texto públicos bloqueia ir pra produção.
- Ao confirmar: recarregar `fetchMyUnlocks` (passe) — mock não muda desbloqueios.
- Remover guarda `donationId < 0` do `flushSave` no [[html-components#ContributeDialog.tsx|CitySceneEditor]].

## Mock (testar à mão)

- `createPixCharge` espera 600 ms; QR = SVG "TESTE"; recebedor "Cidoa"; validade 60 min.
- `getChargeStatus` → `paid` 6 s depois de criar.
- **Valor R$ 13** nunca paga e expira em 15 s → testa tela "Este código expirou.".
