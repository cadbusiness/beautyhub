#!/usr/bin/env node
/**
 * Sync translation files with messages/fr.json (source of truth).
 *
 * Usage:
 *   node scripts/i18n-sync.mjs patch-nl
 *   node scripts/i18n-sync.mjs generate en
 *   node scripts/i18n-sync.mjs generate es
 *   node scripts/i18n-sync.mjs verify
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FR_PATH = path.join(ROOT, "messages/fr.json");

const NL_PATCHES = {
  "institut.actions.giftCardIssued": "Cadeaubon uitgegeven",
  "institut.actions.creditNoteCreated": "Creditnota aangemaakt",
  "institut.actions.creditAmountInvalid": "Ongeldig creditnota-bedrag.",
  "institut.actions.saleNotFound": "Verkoop niet gevonden.",
  "institut.actions.saleNotPartial": "Deze verkoop is geen openstaand voorschot.",
  "institut.actions.balancePaid": "Saldo ontvangen",
  "institut.actions.giftCardInvalid": "Ongeldige cadeaubon.",
  "institut.actions.giftCardInsufficient": "Onvoldoende saldo cadeaubon.",
  "institut.actions.giftCardExpired": "Cadeaubon verlopen.",
  "institut.actions.giftCardCodeRequired": "Cadeauboncode verplicht.",
  "institut.actions.creditNoteInvalid": "Ongeldige creditnota.",
  "institut.actions.creditNoteInsufficient": "Onvoldoende creditnota-saldo.",
  "institut.actions.creditNoteExpired": "Creditnota verlopen.",
  "institut.actions.creditNoteRefRequired": "Creditnotanummer verplicht.",
  "institut.posSettings.form.sessionTitle": "Kassasessie",
  "institut.posSettings.form.requireOpenSession": "Sessie verplicht om af te rekenen",
  "institut.posSettings.form.defaultOpeningFloat": "Standaard kassafonds (€)",
  "institut.marketing.loyalty.program.description":
    "Naam, puntenlabel en activering van het loyaliteitsprogramma.",
  "pos.terminal.cart.staffAria": "Behandelaar",
  "pos.terminal.cart.noStaff": "— Geen behandelaar —",
  "pos.terminal.cart.appointmentAria": "Afspraak",
  "pos.terminal.cart.noAppointment": "— Geen afspr. —",
  "pos.checkout.creditNotePlaceholder": "Creditnota nr. (AV-…)",
  "pos.checkout.methods.credit_note": "Creditnota",
  "pos.history.payBalance": "Saldo",
  "pos.history.paymentMethods.credit_note": "Creditnota",
  "pos.ticket.methods.credit_note": "Creditnota",
  "pos.vouchers.issueGiftCard": "Cadeaubon uitgeven",
  "pos.vouchers.issueCreditNote": "Creditnota aanmaken",
  "pos.vouchers.giftCardsTitle": "Cadeaubonnen",
  "pos.vouchers.creditNotesTitle": "Creditnota's",
  "pos.vouchers.noGiftCards": "Geen cadeaubonnen.",
  "pos.vouchers.noCreditNotes": "Geen creditnota's.",
  "pos.vouchers.columns.code": "Code",
  "pos.vouchers.columns.balance": "Saldo",
  "pos.vouchers.columns.number": "Nr.",
  "pos.vouchers.columns.remaining": "Resterend",
  "pos.vouchers.columns.status": "Status",
  "pos.vouchers.columns.date": "Datum",
  "pos.vouchers.status.active": "Actief",
  "pos.vouchers.status.depleted": "Opgebruikt",
  "pos.vouchers.status.cancelled": "Geannuleerd",
  "pos.vouchers.giftForm.amount": "Bedrag (€)",
  "pos.vouchers.giftForm.recipient": "Ontvanger (optioneel)",
  "pos.vouchers.giftForm.submit": "Bon uitgeven",
  "pos.vouchers.creditForm.selectSale": "Bronverkoop",
  "pos.vouchers.creditForm.noSalesHint": "Geen recente verkopen met betaling.",
  "pos.vouchers.creditForm.amount": "Creditnota-bedrag (€)",
  "pos.vouchers.creditForm.reason": "Reden",
  "pos.vouchers.creditForm.submit": "Creditnota aanmaken",
  "pos.balance.sale": "Verkoop",
  "pos.balance.total": "Totaal incl. BTW",
  "pos.balance.paid": "Reeds betaald",
  "pos.balance.remaining": "Nog te betalen",
  "pos.balance.pay": "Afrekenen {amount}",
  "pos.balance.back": "Historiek",
};

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

function unflatten(flat) {
  const out = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] ??= {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  return out;
}

function deepMerge(base, patch) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function setByPath(obj, dotPath, value) {
  const parts = dotPath.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function protectIcu(str) {
  const tokens = [];
  const protectedStr = str.replace(/\{[^{}]+\}/g, (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `__ICU${idx}__`;
  });
  return { protectedStr, tokens };
}

function restoreIcu(str, tokens) {
  return str.replace(/__ICU(\d+)__/g, (_, i) => tokens[Number(i)] ?? "");
}

async function translateText(text, targetLang) {
  const { protectedStr, tokens } = protectIcu(text);
  if (!protectedStr.trim()) return text;

  const sl = "fr";
  const tl = targetLang === "en" ? "en" : "es";
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sl);
  url.searchParams.set("tl", tl);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", protectedStr);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const translated = data?.[0]?.[0]?.[0];
  if (!translated || typeof translated !== "string") {
    throw new Error("Translation failed");
  }
  return restoreIcu(translated, tokens);
}

async function mapConcurrent(items, fn, concurrency = 12) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function generateLocale(targetLang) {
  const fr = JSON.parse(fs.readFileSync(FR_PATH, "utf8"));
  const frFlat = flatten(fr);
  const keys = Object.keys(frFlat).sort();
  const uniqueValues = [...new Set(keys.map((k) => frFlat[k]).filter((v) => typeof v === "string"))];
  console.log(`[${targetLang}] translating ${uniqueValues.length} unique strings…`);

  const translatedValues = await mapConcurrent(uniqueValues, async (value, i) => {
    if (i > 0 && i % 100 === 0) process.stdout.write(`\r[${targetLang}] ${i}/${uniqueValues.length}`);
    try {
      return await translateText(value, targetLang);
    } catch {
      return value;
    }
  }, 8);

  const valueMap = new Map(uniqueValues.map((v, i) => [v, translatedValues[i]]));
  const outFlat = {};
  for (const key of keys) {
    const value = frFlat[key];
    outFlat[key] =
      typeof value === "string" ? (valueMap.get(value) ?? value) : value;
  }

  process.stdout.write(`\r[${targetLang}] ${uniqueValues.length}/${uniqueValues.length}\n`);
  const outPath = path.join(ROOT, `messages/${targetLang}.json`);
  const outObj = unflatten(outFlat);
  fs.writeFileSync(outPath, `${JSON.stringify(outObj, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function patchNl() {
  const fr = JSON.parse(fs.readFileSync(FR_PATH, "utf8"));
  const nlPath = path.join(ROOT, "messages/nl.json");
  const nl = JSON.parse(fs.readFileSync(nlPath, "utf8"));
  const patched = structuredClone(nl);
  for (const [key, value] of Object.entries(NL_PATCHES)) {
    setByPath(patched, key, value);
  }
  const frFlat = flatten(fr);
  const nlFlat = flatten(patched);
  for (const key of Object.keys(frFlat)) {
    if (!(key in nlFlat)) setByPath(patched, key, frFlat[key]);
  }
  fs.writeFileSync(nlPath, `${JSON.stringify(patched, null, 2)}\n`);
  console.log("Patched messages/nl.json");
}

function verify() {
  const fr = JSON.parse(fs.readFileSync(FR_PATH, "utf8"));
  const frFlat = flatten(fr);
  const locales = ["nl", "en", "es"];
  let ok = true;
  for (const loc of locales) {
    const p = path.join(ROOT, `messages/${loc}.json`);
    if (!fs.existsSync(p)) {
      console.error(`Missing ${p}`);
      ok = false;
      continue;
    }
    const flat = flatten(JSON.parse(fs.readFileSync(p, "utf8")));
    const missing = Object.keys(frFlat).filter((k) => !(k in flat));
    const empty = Object.keys(flat).filter((k) => !flat[k] && frFlat[k]);
    console.log(`${loc}: keys=${Object.keys(flat).length} missing=${missing.length} empty=${empty.length}`);
    if (missing.length) {
      ok = false;
      console.log("  missing:", missing.slice(0, 10).join(", "), missing.length > 10 ? "…" : "");
    }
  }
  process.exit(ok ? 0 : 1);
}

const [,, cmd, arg] = process.argv;

if (cmd === "patch-nl") {
  patchNl();
} else if (cmd === "generate" && (arg === "en" || arg === "es")) {
  await generateLocale(arg);
} else if (cmd === "verify") {
  verify();
} else {
  console.log("Usage: node scripts/i18n-sync.mjs patch-nl|generate en|es|verify");
  process.exit(1);
}
