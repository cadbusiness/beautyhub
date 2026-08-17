import type { PosSettings } from "@/lib/institut/pos-settings";
import { getTaxCountry, isVatExemptRegime } from "@/lib/institut/tax-catalog";

export type LegalMentionBlock = {
  vatExemption: string;
  paymentDiscount: string;
  latePaymentPenalty: string;
  fixedRecoveryFee: string;
  retentionOfTitle: string;
  jurisdiction: string;
};

function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function getVatExemptionMention(settings: PosSettings): string {
  if (!isVatExemptRegime(settings.fiscal_regime)) return "";
  if (settings.country_code === "FR") {
    return "TVA non applicable, article 293 B du CGI (franchise en base de TVA).";
  }
  return "TVA non applicable (régime de franchise).";
}

export function getLegalMentions(
  settings: PosSettings,
  locale = "fr-FR",
): LegalMentionBlock {
  const vatExemption = getVatExemptionMention(settings);

  if (settings.legal_mentions?.trim()) {
    const lines = settings.legal_mentions.trim().split("\n").filter(Boolean);
    return {
      vatExemption,
      paymentDiscount: lines[0] ?? "",
      latePaymentPenalty: lines[1] ?? "",
      fixedRecoveryFee: lines[2] ?? "",
      retentionOfTitle: lines[3] ?? "",
      jurisdiction: lines[4] ?? "",
    };
  }

  const recoveryFee = formatMoney(settings.fixed_recovery_fee_cents, settings.currency, locale);
  const country = getTaxCountry(settings.country_code).code;

  if (country === "BE") {
    return {
      vatExemption,
      paymentDiscount:
        "Aucun escompte ne sera accordé pour paiement anticipé. Tout retard de paiement engendre des pénalités exigibles le jour suivant, calculées sur la base du taux légal +5 %.",
      latePaymentPenalty:
        settings.late_payment_penalty_text?.trim() ||
        "Tout paiement intervenu après la date d'échéance entraînera une pénalité forfaitaire de 40 € (art. 1226 et 1231 du Code civil belge, loi du 2 août 2002).",
      fixedRecoveryFee: `Indemnité forfaitaire de recouvrement : ${recoveryFee} (B2B, loi belge du 2 août 2002).`,
      retentionOfTitle:
        "Réserve de propriété applicable selon la loi du 25 juin 1991 (vente à tempérament) et l'article 101 du Code civil belge jusqu'au paiement intégral du prix.",
      jurisdiction:
        "En cas de litige, seul le tribunal du ressort du siège social de l'entreprise est compétent.",
    };
  }

  if (country === "FR") {
    return {
      vatExemption,
      paymentDiscount:
        "Aucun escompte ne sera accordé en cas de paiement anticipé (art. L441-10 du Code de commerce).",
      latePaymentPenalty:
        settings.late_payment_penalty_text?.trim() ||
        "En cas de retard de paiement, des pénalités de retard au taux légal majoré de 10 points seront exigibles (art. L441-10 et D441-4 du Code de commerce).",
      fixedRecoveryFee: `Indemnité forfaitaire pour frais de recouvrement : ${recoveryFee} (art. L441-10 et D441-5 du Code de commerce).`,
      retentionOfTitle:
        "Clause de réserve de propriété : les biens demeurent la propriété du vendeur jusqu'au paiement intégral du prix (art. 2367 du Code civil).",
      jurisdiction:
        "En cas de litige, compétence exclusive est attribuée au tribunal du ressort du siège social du vendeur.",
    };
  }

  return {
    vatExemption,
    paymentDiscount: "Aucun escompte n'est accordé pour paiement anticipé.",
    latePaymentPenalty:
      settings.late_payment_penalty_text?.trim() ||
      "Tout retard de paiement peut entraîner des pénalités selon le droit applicable au siège de l'entreprise.",
    fixedRecoveryFee: `Indemnité forfaitaire de recouvrement : ${recoveryFee}.`,
    retentionOfTitle:
      "Les biens restent la propriété du vendeur jusqu'au paiement intégral du prix.",
    jurisdiction:
      "En cas de litige, le tribunal du ressort du siège social du vendeur est compétent.",
  };
}

export function getVatLabel(settings: PosSettings): string {
  return getTaxCountry(settings.country_code).vatNumberLabel;
}

export function getCompanyIdLabel(settings: PosSettings): string {
  return getTaxCountry(settings.country_code).companyIdLabel;
}
