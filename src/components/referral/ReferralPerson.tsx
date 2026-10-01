import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ReferrerPreview } from "@/api/referral/referral.types";
import { cn } from "@/lib/utils";

export function ReferralPerson({
  label,
  person,
  className,
}: {
  label: string;
  person: ReferrerPreview;
  className?: string;
}) {
  const name = person.name?.trim() || "Usuário Cidoa";

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-muted/40 p-3", className)}>
      <Avatar className="size-10">
        {person.profile_image && (
          <AvatarImage src={person.profile_image} alt={`Imagem de ${name}`} className="object-cover" />
        )}
        <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{name}</p>
      </div>
    </div>
  );
}
