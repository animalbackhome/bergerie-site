export default function BookingRefusedPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Bandeau haut (même style que le reste du site) */}
      <section className="px-5 py-10 bg-gradient-to-b from-[#0b1b3a] to-[#0a1020] text-white">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold">❌ Demande refusée</h1>
          <p className="opacity-80 mt-2">
            OK. La demande a bien été marquée comme <b>refusée</b>.
          </p>
        </div>
      </section>

      {/* Contenu */}
      <section className="px-5 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border p-5">
            <p className="text-slate-800">Vous pouvez fermer cette page.</p>

            <p className="text-sm text-slate-500 mt-3">
              (Si vous êtes arrivée ici depuis un bouton dans l’e-mail, c’est normal : cette page confirme que
              l’action a bien été prise en compte.)
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
