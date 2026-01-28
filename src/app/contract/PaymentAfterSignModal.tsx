// src/app/contract/PaymentAfterSignModal.tsx
"use client";

import { useMemo, useState } from "react";
import PaiementSection from "../_sections/paiement/PaiementSection";

type Booking = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  arrival_date: string;
  departure_date: string;
  pricing?: any;
};

function toMoneyEUR(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return `${n.toFixed(2)} €`;
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentAfterSignModal({
  open,
  onClose,
  booking,
  token,
  deposit30,
}: {
  open: boolean;
  onClose: () => void;
  booking: Booking;
  token: string;
  deposit30: number | null;
}) {
  const [checked, setChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountText = useMemo(() => {
    if (deposit30 == null) return "la somme";
    const t = toMoneyEUR(deposit30);
    return t || "la somme";
  }, [deposit30]);

  async function declareTransferSent() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "transfer_sent",
          rid: booking.id,
          t: token,
          // pas besoin d'autre data
          signer_address_line1: "x",
          signer_postal_code: "x",
          signer_city: "x",
          signer_country: "x",
          occupants: [{ first_name: "x", last_name: "x", age: "x" }],
          accepted_terms: true,
          contract_date: "01/01/2000",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Impossible d’enregistrer la confirmation.");
        return;
      }
      setSentOk(true);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Réservation : étape paiement (acompte 30%)">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900">
          <p className="font-semibold">Merci ! Votre contrat est signé ✅</p>
          <p className="mt-2">
            <b>Pour bloquer vos dates de réservation</b>, merci d’effectuer le paiement des 30% (soit <b>{amountText}</b>)
            par virement bancaire.
          </p>
          <p className="mt-2">
            Le solde sera à régler selon les modalités prévues au contrat, au plus tard 7 jours avant l'entrée dans les lieux.
          </p>
        </div>

        {/* ✅ On réutilise la section existante (RIB + instructions) */}
        <div className="rounded-2xl border border-slate-200 p-4">
          <PaiementSection />
        </div>

        <label className="flex items-start gap-3 text-sm text-slate-900">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            disabled={sending || sentOk}
          />
          <span>Virement envoyé</span>
        </label>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        {sentOk ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Merci ✅ Confirmation enregistrée.
          </div>
        ) : null}

        <button
          type="button"
          onClick={declareTransferSent}
          disabled={!checked || sending || sentOk}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? "Envoi..." : "J’ai bien envoyé le virement des 30%"}
        </button>
      </div>
    </Modal>
  );
}
