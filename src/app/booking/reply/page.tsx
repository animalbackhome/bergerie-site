export default function BookingReplyPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Bandeau haut (même style que le reste du site) */}
      <section className="px-5 py-10 bg-gradient-to-b from-[#0b1b3a] to-[#0a1020] text-white">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold">💬 Répondre</h1>
          <p className="opacity-80 mt-2">
            OK. Vous pouvez répondre directement au voyageur depuis votre e-mail.
          </p>
        </div>
      </section>

      {/* Contenu */}
      <section className="px-5 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border p-5">
            <p className="text-slate-800">
              Ce bouton ne change pas le statut : il sert uniquement de raccourci.
            </p>

            <p className="text-sm text-slate-500 mt-3">
              Astuce : répondez à l’e-mail reçu (fonction “Répondre”) pour garder l’historique de la demande.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
