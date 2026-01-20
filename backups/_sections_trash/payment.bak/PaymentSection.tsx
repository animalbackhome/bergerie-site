type Props = {
  contractLine: string;
  paymentLine: string;
  cautionLine: string;
  animalsLine: string;
  scheduleLine: string;
};

export default function PaymentSection({
  contractLine,
  paymentLine,
  cautionLine,
  animalsLine,
  scheduleLine,
}: Props) {
  return (
    <section className="w-full bg-gradient-to-b from-[#0b2a3a] via-[#0a2a3c] to-[#051a2b]">
      <div className="mx-auto max-w-6xl px-6 py-14" id="paiement">
        <div className="rounded-3xl bg-white/10 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur">
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Paiement &amp; conditions
          </h2>

          <div className="mt-6 rounded-2xl bg-white p-6 text-slate-900 shadow-sm">
            <div className="space-y-4 text-sm leading-relaxed text-slate-800">
              <p>
                <span className="font-semibold">Contrat :</span> {contractLine}
              </p>
              <p>
                <span className="font-semibold">Paiement :</span> {paymentLine}
              </p>
              <p>
                <span className="font-semibold">Caution :</span> {cautionLine}
              </p>
              <p>
                <span className="font-semibold">Animaux :</span> {animalsLine}
              </p>
              <p>
                <span className="font-semibold">Horaires :</span> {scheduleLine}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
