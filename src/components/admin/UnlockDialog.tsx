import { useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { updateCustomizationCategory, updateCustomizationOption } from "@/api/admin/admin.routes";
import { ApiError } from "@/api/http";
import { formatUnlockCta, type UnlockRule } from "@/lib/unlock";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type { UnlockTarget } from "@/lib/adminUnlock";

type Feedback = { ok: boolean; text: string } | null;

/**
 * Aceita as duas formas que o admin digita: "50,90" (vírgula, pt-BR) e "50.90".
 * A vírgula decide: com ela, ponto é separador de milhar. Devolve null para
 * qualquer coisa que não seja um valor exigível (vazio, zero, texto).
 */
function parseMoney(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

function parseCount(raw: string): number | null {
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Define o requisito de liberação de uma personalização.
 *
 * Cada eixo é um Switch + input. O Switch é o que torna impossível gravar
 * zero: "não exigir" é um estado do controle, não um número digitado — que é
 * exatamente o que impede a tela do usuário de dizer "R$ 30 e 0 indicações".
 */
export function UnlockDialog({
  target,
  onClose,
  onDone,
}: {
  target: UnlockTarget;
  onClose: () => void;
  onDone: (fb: Feedback) => void;
}) {
  const [requireDonation, setRequireDonation] = useState(target.unlock?.donationMin != null);
  const [donation, setDonation] = useState(
    target.unlock?.donationMin != null ? String(target.unlock.donationMin).replace(".", ",") : "",
  );
  const [requireReferral, setRequireReferral] = useState(target.unlock?.referralMin != null);
  const [referral, setReferral] = useState(
    target.unlock?.referralMin != null ? String(target.unlock.referralMin) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const donationMin = requireDonation ? parseMoney(donation) : null;
  const referralMin = requireReferral ? parseCount(referral) : null;
  const incomplete =
    (requireDonation && donationMin === null) || (requireReferral && referralMin === null);
  const preview: UnlockRule =
    donationMin == null && referralMin == null ? null : { donationMin, referralMin };

  async function handleSave() {
    setSaving(true);
    setError(null);
    // Manda os dois eixos sempre: este diálogo é dono da regra inteira, então
    // null aqui significa "limpa", não "não mexe".
    const payload = { unlockDonationMin: donationMin, unlockReferralMin: referralMin };
    try {
      if (target.kind === "option") await updateCustomizationOption(target.id, payload);
      else await updateCustomizationCategory(target.id, payload);
      onDone({ ok: true, text: `Liberação de "${target.label}" atualizada.` });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao salvar liberação");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberação · {target.label}</DialogTitle>
          <DialogDescription>
            O que o usuário precisa fazer para conquistar esta personalização.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-sm font-medium">Exigir doação</span>
                <p className="text-xs text-muted-foreground">
                  Soma de tudo que o usuário já doou.
                </p>
              </div>
              <Switch
                checked={requireDonation}
                onCheckedChange={setRequireDonation}
                aria-label="Exigir doação"
              />
            </div>
            {requireDonation && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  autoFocus
                  inputMode="decimal"
                  value={donation}
                  onChange={(e) => setDonation(e.target.value)}
                  placeholder="50,00"
                  aria-label="Valor mínimo de doação"
                />
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-sm font-medium">Exigir indicações</span>
                <p className="text-xs text-muted-foreground">
                  Total histórico de pessoas que entraram pelo código dele.
                </p>
              </div>
              <Switch
                checked={requireReferral}
                onCheckedChange={setRequireReferral}
                aria-label="Exigir indicações"
              />
            </div>
            {requireReferral && (
              <Input
                inputMode="numeric"
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
                placeholder="3"
                aria-label="Número mínimo de indicações"
              />
            )}
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              O usuário vai ler
            </span>
            <p className="mt-1 text-sm font-medium">{formatUnlockCta(preview)}</p>
          </div>

          {target.unlockedCount > 0 && (
            <p className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
              <Trophy className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <strong>{target.unlockedCount}</strong>{" "}
                {target.unlockedCount === 1 ? "usuário já conquistou" : "usuários já conquistaram"}{" "}
                esta personalização e {target.unlockedCount === 1 ? "mantém" : "mantêm"} o acesso.
                A regra nova só vale para quem ainda não conquistou.
              </span>
            </p>
          )}

          {incomplete && (
            <p className="text-sm text-destructive">
              Preencha um valor maior que zero, ou desligue a exigência.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            disabled={saving || (!requireDonation && !requireReferral)}
            onClick={() => {
              setRequireDonation(false);
              setRequireReferral(false);
            }}
          >
            Tornar grátis
          </Button>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={() => void handleSave()} disabled={saving || incomplete}>
              {saving && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

