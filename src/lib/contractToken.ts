// src/lib/contractToken.ts
import crypto from "crypto";

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Token simple signé (HMAC) pour empêcher les signatures au hasard.
 * - Stable : pas besoin de stocker le token en DB
 * - Vérifiable côté serveur en re-faisant le HMAC
 */
export function createContractToken(args: {
  rid: string | number;
  email: string;
  secret: string;
}) {
  const ridStr = String(args.rid).trim();
  const emailNorm = String(args.email || "").trim().toLowerCase();
  const secret = String(args.secret || "");

  if (!ridStr || !emailNorm || !secret) return "";

  const h = crypto.createHmac("sha256", secret);
  h.update(`${ridStr}.${emailNorm}`);
  return b64url(h.digest());
}

export function verifyContractToken(args: {
  rid: string | number;
  email: string;
  secret: string;
  token: string | null | undefined;
}) {
  const expected = createContractToken({
    rid: args.rid,
    email: args.email,
    secret: args.secret,
  });
  if (!expected) return true; // si pas de secret configuré, on ne bloque pas
  return String(args.token || "") === expected;
}
