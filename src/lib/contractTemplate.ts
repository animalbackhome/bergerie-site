// src/lib/contractTemplate.ts

/**
 * IMPORTANT : colle ici TON contrat.
 *
 * - Tu peux mettre des placeholders simples, ex :
 *   {{FULL_NAME}}, {{ARRIVAL_DATE}}, {{DEPARTURE_DATE}}, {{TOTAL_PRICE}}
 *
 * - On remplace automatiquement ces placeholders à l'affichage + dans l'email.
 * - Tant que tu ne colles pas ton texte, la page affiche un message.
 */
export const CONTRACT_TEXT_TEMPLATE = `
[COLLE ICI TON CONTRAT COMPLET]

Placeholders disponibles :
- {{FULL_NAME}}
- {{EMAIL}}
- {{PHONE}}
- {{ARRIVAL_DATE}}
- {{DEPARTURE_DATE}}
- {{NIGHTS}}
- {{TOTAL_PRICE}}
- {{ADDRESS}}
- {{OCCUPANTS}}
`;

export type ContractTemplateData = {
  fullName: string;
  email: string;
  phone: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  totalPrice: string;
  address: string;
  occupantsText: string;
};

function replaceAll(template: string, map: Record<string, string>) {
  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(k).join(v);
  }
  return out;
}

export function renderContractText(data: ContractTemplateData) {
  const t = (CONTRACT_TEXT_TEMPLATE || "").trim();
  if (!t || t.includes("[COLLE ICI TON CONTRAT COMPLET]")) {
    return "⚠️ Contrat non configuré : colle ton texte dans src/lib/contractTemplate.ts";
  }

  return replaceAll(t, {
    "{{FULL_NAME}}": data.fullName,
    "{{EMAIL}}": data.email,
    "{{PHONE}}": data.phone,
    "{{ARRIVAL_DATE}}": data.arrivalDate,
    "{{DEPARTURE_DATE}}": data.departureDate,
    "{{NIGHTS}}": String(data.nights),
    "{{TOTAL_PRICE}}": data.totalPrice,
    "{{ADDRESS}}": data.address,
    "{{OCCUPANTS}}": data.occupantsText,
  });
}
