// src/app/contract/OtpSignature.tsx
"use client";

import { useMemo, useState } from "react";
import PaymentAfterSignModal from "./PaymentAfterSignModal";

type Occupant = { first_name: string; last_name: string; age: string };

type Booking = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  arrival_date: string;
  departure_date: string;
  pricing?: any;
};

type Props = {
  booking: Booking;
  token: string;

  signer_address_line1: string;
  signer_address_line2: string;
  signer_postal_code: string;
  signer_city: string;
  signer_country: string;
  occupants: Occupant[];
  contract_date: string;
  accepted_terms: boolean;

  disabled?: boolean;

  onSigned?: () => void;
};

function maskEmail(email: string) {
  const s = String(email || "").trim();
  const [user, domain] = s.split("@");
  if (!user || !domain) return s;
  const u = user.length <= 2 ? `${user[0] || ""}*` : `${user.slice(0, 2)}***`;
  return `${u}@${domain}`;
}

export default function OtpSignature(props: Props) {
  const [step, setStep] = useState<"idle" | "sent" | "verifying" | "signed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [deposit30, setDeposit30] = useState<number | null>(null);

  const masked = useMemo(() => maskEmail(props.booking.email), [props.booking.email]);

  async function sendOtp() {
    setError(null);
    setStep("verifying");

    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "send_otp",
          rid: props.booking.id,
          t: props.token,
          signer_address_line1: props.signer_address_line1,
          signer_address_line2: props.signer_address_line2,
          signer_postal_code: props.signer_postal_code,
          signer_city: props.signer_city,
          signer_country: props.signer_country,
          occupants: props.occupants,
          accepted_terms: props.accepted_terms,
          contract_date: props.contract_date,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Erreur lors de l’envoi du code.");
        setStep("idle");
        return;
      }

      setDeposit30(typeof json?.deposit30 === "number" ? json.deposit30 : null);
      setStep("sent");
    } catch {
      setError("Erreur réseau. Réessayez.");
      setStep("idle");
    }
  }

  async function verifyOtp() {
    setError(null);
    setStep("verifying");

    try {
      const res = await fetch("/api/contract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "verify_otp",
          rid: props.booking.id,
          t: props.token,
          otp_code: otpCode,
          signer_address_line1: props.signer_address_line1,
          signer_address_line2: props.signer_address_line2,
          signer_postal_code: props.signer_postal_code,
          signer_city: props.signer_city,
          signer_country: props.signer_country,
          occupants: props.occupants,
          accepted_terms: props.accepted_terms,
          contract_date: props.contract_date,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Code invalide.");
        setStep("sent");
        return;
      }

      setDeposit30(typeof json?.deposit30 === "number" ? json.deposit30 : deposit30);
      setStep("signed");
      setShowPaymentModal(true);
      props.onSigned?.();
    } catch {
      setError("Erreur réseau. Réessayez.");
      setStep("sent");
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="text-sm text-slate-700">
        Pour confirmer légalement la signature électronique, un code à 6 chiffres est envoyé à l’adresse email
        utilisée pour la réservation. La saisie de ce code dans le contrat permet de confirmer que la personne qui
        réserve a bien accès à cette boîte email.
      </div>

      {step === "idle" ? (
        <button
          type="button"
          onClick={sendOtp}
          disabled={props.disabled}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Recevoir mon code de signature (6 chiffres)
        </button>
      ) : null}

      {step === "sent" || step === "verifying" ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-900 font-semibold">Code envoyé ✅</div>
          <div className="mt-1 text-xs text-slate-600">
            Nous avons envoyé un code à <b>{masked}</b>. (Validité ~10 minutes)
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Code (6 chiffres)"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              disabled={props.disabled || step === "verifying"}
            />
            <button
              type="button"
              onClick={verifyOtp}
              disabled={props.disabled || step === "verifying" || otpCode.length !== 6}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {step === "verifying" ? "Validation..." : "Valider & signer"}
            </button>
          </div>

          <button
            type="button"
            onClick={sendOtp}
            disabled={props.disabled || step === "verifying"}
            className="mt-3 text-xs text-slate-600 underline disabled:opacity-60"
          >
            Renvoyer un nouveau code
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <PaymentAfterSignModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        booking={props.booking}
        token={props.token}
        deposit30={deposit30}
      />
    </div>
  );
}
