"use client";

import { useEffect, useMemo, useState } from "react";

type ContractData = {
  id: string;

  name: string | null;
  email: string | null;
  phone: string | null;

  start_date: string | null;
  end_date: string | null;
  nights: number | null;

  adults: number | null;
  children: number | null;

  animals_count: number | null;
  animal_type: string | null;
  other_animal_label: string | null;

  pricing: any | null;
};

function formatEUR(value: number) {
  const v = Number.isFinite(value) ? value : 0;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function calcDeposit(total: number) {
  // 30% acompte, arrondi à 2 décimales
  const d = Math.round(total * 0.3 * 100) / 100;
  return d;
}

export default function ContractPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ContractData | null>(null);

  // Champs modifiables (pré-remplis)
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [nights, setNights] = useState<number>(0);

  const [adults, setAdults] = useState<number>(0);
  const [children, setChildren] = useState<number>(0);

  const [animalsSummary, setAnimalsSummary] = useState("");

  const rid = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    return url.searchParams.get("rid") || "";
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      if (!rid) {
        setLoading(false);
        setError("Lien invalide : paramètre rid manquant.");
        return;
      }

      try {
        const res = await fetch(`/api/contract?rid=${encodeURIComponent(rid)}`, {
          method: "GET",
          headers: { "Accept": "application/json" },
          cache: "no-store",
        });

        const json = (await res.json()) as { ok: boolean; error?: string; data?: ContractData };

        if (!res.ok || !json.ok || !json.data) {
          throw new Error(json.error || "Impossible de charger la demande.");
        }

        if (cancelled) return;

        const d = json.data;
        setData(d);

        const name = (d.name || "").trim();
        const email = (d.email || "").trim();
        const phone = (d.phone || "").trim();

        const start = (d.start_date || "").trim();
        const end = (d.end_date || "").trim();
        const n = Number.isFinite(d.nights as any) ? Number(d.nights) : 0;

        const a = Number.isFinite(d.adults as any) ? Number(d.adults) : 0;
        const c = Number.isFinite(d.children as any) ? Number(d.children) : 0;

        const animalsCount = Number.isFinite(d.animals_count as any) ? Number(d.animals_count) : 0;
        const animalType = (d.animal_type || "").trim();
        const otherLabel = (d.other_animal_label || "").trim();

        const animals =
          animalsCount <= 0
            ? "0"
            : animalType === "autre" && otherLabel
              ? `${animalsCount} (autre - ${otherLabel})`
              : `${animalsCount} (${animalType || "—"})`;

        setGuestName(name);
        setGuestEmail(email);
        setGuestPhone(phone);

        setCheckin(start);
        setCheckout(end);
        setNights(n);

        setAdults(a);
        setChildren(c);

        setAnimalsSummary(animals);

        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setLoading(false);
        setError(e?.message || "Erreur inconnue.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [rid]);

  const total = useMemo(() => {
    const t = data?.pricing?.total;
    const n = Number.isFinite(t) ? Number(t) : 0;
    return n;
  }, [data]);

  const deposit = useMemo(() => calcDeposit(total), [total]);
  const balance = useMemo(() => {
    const b = Math.round((total - deposit) * 100) / 100;
    return b < 0 ? 0 : b;
  }, [total, deposit]);

  return (
    <main className="min-h-screen">
      {/* Bandeau haut */}
      <section className="px-5 py-10 bg-gradient-to-b from-[#0b1b3a] to-[#0a1020] text-white">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold">Contrat de location</h1>
          <p className="opacity-80 mt-2">
            Cette page pré-remplit le contrat à partir de votre demande. Vous pouvez modifier les informations avant de signer.
          </p>
        </div>
      </section>

      {/* Contenu */}
      <section className="px-5 py-10 bg-white">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="rounded-2xl border p-5">
              <p className="font-medium">Chargement…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="font-semibold text-red-800">Erreur</p>
              <p className="text-red-800 mt-1">{error}</p>
            </div>
          ) : !data ? (
            <div className="rounded-2xl border p-5">
              <p className="font-medium">Aucune donnée.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Récap */}
              <div className="rounded-2xl border p-5">
                <h2 className="text-lg font-semibold">Récapitulatif</h2>
                <div className="mt-3 space-y-1 text-sm">
                  <div><b>Séjour :</b> {checkin} → {checkout} ({nights} nuit(s))</div>
                  <div><b>Voyageurs :</b> {adults} adulte(s) / {children} enfant(s)</div>
                  <div><b>Animaux :</b> {animalsSummary}</div>
                  <div className="mt-2"><b>Total estimé :</b> {formatEUR(total)}</div>
                  <div><b>Acompte (30%) :</b> {formatEUR(deposit)}</div>
                  <div><b>Solde restant :</b> {formatEUR(balance)}</div>
                </div>
              </div>

              {/* Infos locataire modifiables */}
              <div className="rounded-2xl border p-5">
                <h2 className="text-lg font-semibold">Informations locataire (modifiables)</h2>

                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1">
                    <span className="text-sm font-medium">Nom / Prénom</span>
                    <input
                      className="border rounded-xl px-3 py-2"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Nom / Prénom"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">E-mail</span>
                    <input
                      className="border rounded-xl px-3 py-2"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="email@exemple.com"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium">Téléphone</span>
                    <input
                      className="border rounded-xl px-3 py-2"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="06…"
                    />
                  </label>
                </div>

                <div className="mt-4 text-sm text-slate-600">
                  ✅ Étape suivante : on ajoute ici toutes les infos manquantes du contrat (adresse, ville, etc.) + la signature en ligne.
                </div>
              </div>

              {/* Contrat (version texte) */}
              <div className="rounded-2xl border p-5">
                <h2 className="text-lg font-semibold">Contrat (aperçu)</h2>
                <p className="text-sm text-slate-600 mt-2">
                  (V1 : page anti-404 + pré-remplissage. On mettra ensuite le contrat complet mot pour mot + champs obligatoires + signature.)
                </p>

                <div className="mt-4 whitespace-pre-wrap text-sm leading-6">
{`CONTRAT DE LOCATION SAISONNIÈRE ENTRE PARTICULIERS — N° [XXXX]

1) Parties
Propriétaire (Bailleur)
Nom / Prénom : [à compléter]
Adresse : [à compléter]
E-mail : [à compléter]
Téléphone : [à compléter]

Locataire
Nom / Prénom : ${guestName || "[ ]"}
Adresse : [à compléter]
E-mail : ${guestEmail || "[ ]"}
Téléphone : ${guestPhone || "[ ]"}

3) Durée — Dates — Horaires
Période : du ${checkin || "[date arrivée]"} au ${checkout || "[date départ]"} pour ${nights || "[X]"} nuits.
Arrivée : entre 16h et 18h
Départ : au plus tard 10h

4) Prix
Prix total estimé du séjour : ${formatEUR(total)}
Acompte (30%) : ${formatEUR(deposit)}
Solde restant : ${formatEUR(balance)}

(Le texte complet du contrat sera collé ici mot pour mot à l’étape suivante.)`}
                </div>

                <div className="mt-5">
                  <button
                    className="px-4 py-3 rounded-xl bg-slate-200 text-slate-500 cursor-not-allowed"
                    disabled
                  >
                    Signature en ligne (étape suivante)
                  </button>
                  <p className="text-xs text-slate-500 mt-2">
                    Pour l’instant ce bouton est désactivé : on valide d’abord que le lien /contract ne fait plus 404.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
