type DonationInfoSectionProps = {
  totalRaised: number;
  donationCount: number;
};

// ONGs parceiras — dados ilustrativos enquanto parcerias reais não são firmadas.
// `share` define a fração do total arrecadado destinada a cada ONG (soma = 1).
const PARTNER_NGOS = [
  {
    name: "Patas do Bem",
    focus: "Resgate e adoção de cães e gatos abandonados",
    city: "São Paulo · SP",
    share: 0.28,
  },
  {
    name: "Instituto Focinho Feliz",
    focus: "Castração gratuita e atendimento veterinário",
    city: "Belo Horizonte · MG",
    share: 0.24,
  },
  {
    name: "Abrigo Quatro Patas",
    focus: "Lar temporário e reabilitação de animais resgatados",
    city: "Porto Alegre · RS",
    share: 0.2,
  },
  {
    name: "Refúgio Animal Litoral",
    focus: "Resgate e cuidado de fauna costeira e silvestre",
    city: "Florianópolis · SC",
    share: 0.16,
  },
  {
    name: "Amigos dos Animais",
    focus: "Educação e campanhas de adoção responsável",
    city: "Recife · PE",
    share: 0.12,
  },
] as const;

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="text-2xl font-semibold tabular-nums text-[#14161c]">{value}</dd>
      <dt className="mt-1 text-xs uppercase tracking-[0.15em] text-[#14161c]/45">{label}</dt>
    </div>
  );
}

export function DonationInfoSection({ totalRaised, donationCount }: DonationInfoSectionProps) {
  return (
    <section className="min-h-screen w-full bg-white text-[#14161c]">
      <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:px-10 sm:py-32">
        {/* Projeto — texto + foto */}
        <header className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#a8814a]">
              O projeto
            </p>
            <h2 className="mt-5 text-3xl font-medium leading-tight sm:text-4xl">
              Cada doação ergue um prédio. Cada prédio sustenta uma causa animal.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-[#14161c]/60">
              Cidoa transforma cada contribuição em um edifício da cidade acima — a maior doação
              ocupa o centro. 100% do valor arrecadado é repassado a ONGs de proteção animal:
              resgate, castração, tratamento veterinário e adoção responsável.
            </p>
          </div>
          <img
            src="/cat_dog.jpeg"
            alt="Um cachorro e um gato resgatados, lado a lado"
            className="w-full rounded-2xl object-cover"
          />
        </header>

        <div className="my-16 h-px w-full bg-black/10" />

        {/* Totais */}
        <div className="grid gap-12 sm:grid-cols-[1.2fr_1fr] sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#14161c]/45">
              Total arrecadado
            </p>
            <p className="mt-3 text-5xl font-semibold tabular-nums text-[#a8814a] sm:text-6xl">
              {formatBRL(totalRaised)}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-6">
            <Stat label="Doações" value={donationCount.toLocaleString("pt-BR")} />
            <Stat label="ONGs parceiras" value={String(PARTNER_NGOS.length)} />
            <Stat label="Repasse" value="100%" />
          </dl>
        </div>

        <div className="my-16 h-px w-full bg-black/10" />

        {/* ONGs */}
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#a8814a]">
          ONGs parceiras
        </p>
        <h3 className="mt-4 text-2xl font-medium">Para onde vai o seu investimento</h3>

        <ul className="mt-8 border-t border-black/10">
          {PARTNER_NGOS.map((ngo) => (
            <li
              key={ngo.name}
              className="flex flex-col gap-2 border-b border-black/10 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8"
            >
              <div className="min-w-0">
                <p className="text-lg font-medium text-[#14161c]">{ngo.name}</p>
                <p className="mt-1 text-sm text-[#14161c]/60">{ngo.focus}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#14161c]/40">
                  {ngo.city}
                </p>
              </div>
              <div className="flex shrink-0 items-baseline gap-3 sm:flex-col sm:items-end sm:gap-1">
                <p className="text-lg font-semibold tabular-nums text-[#14161c]">
                  {formatBRL(totalRaised * ngo.share)}
                </p>
                <p className="text-xs font-medium tabular-nums text-[#a8814a]">
                  {Math.round(ngo.share * 100)}%
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs leading-relaxed text-[#14161c]/40">
          Dados de ONGs ilustrativos — parcerias em formação. Valores distribuídos
          proporcionalmente ao total arrecadado.
        </p>
      </div>
    </section>
  );
}
