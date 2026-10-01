import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

// lucide 1.x não tem ícones de marca; glifos de simple-icons (CC0) e Feather (MIT, Facebook).
const networks = [
  {
    name: "WhatsApp",
    className: "bg-[#25D366]",
    href: (url: string) => `https://wa.me/?text=${url}`,
    path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
  },
  {
    name: "Facebook",
    className: "bg-[#1877F2]",
    href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    path: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
  },
  {
    name: "LinkedIn",
    className: "bg-[#0A66C2]",
    href: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 4.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z",
  },
  {
    name: "X",
    className: "bg-black dark:ring-1 dark:ring-white/20",
    href: (url: string) => `https://x.com/intent/post?url=${url}`,
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
];

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}

/** Modal de compartilhamento: redes sociais + link com botão de copiar. */
export function ShareDialog({ open, onOpenChange, url }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Compartilhar</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2">
          {networks.map((network) => (
            <a
              key={network.name}
              href={network.href(encodedUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-2 rounded-lg py-1 text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span
                className={`grid size-14 place-items-center rounded-full text-white transition-transform group-hover:scale-105 ${network.className}`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-7" aria-hidden="true">
                  <path d={network.path} />
                </svg>
              </span>
              {network.name}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-1.5 pl-3">
          <input
            readOnly
            value={url}
            aria-label="Link"
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 truncate bg-transparent text-sm outline-none"
          />
          <Button type="button" size="sm" onClick={copyLink}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
