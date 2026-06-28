#!/usr/bin/env node
/**
 * Offline EN/ES generation when translation APIs are unavailable.
 * Uses NL (complete) + FR (source) with phrase dictionaries.
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

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

/** Longest-first NL → EN phrase replacements (beauty/salon SaaS). */
const NL_TO_EN = [
  ["Neem contact op met uw beheerder om de instituut- of academiemodules te activeren.", "Contact your administrator to enable the institute or academy modules."],
  ["Geen actieve modules op dit moment.", "No active modules at the moment."],
  ["Alle rechten voorbehouden.", "All rights reserved."],
  ["Hoofdnavigatie", "Main navigation"],
  ["Menu uitklappen", "Expand menu"],
  ["Kassasessie geopend.", "POS session opened."],
  ["Er is al een sessie geopend.", "A session is already open."],
  ["Geen open sessie — open eerst de kassa.", "No open session — open the register first."],
  ["Z-afsluiting voltooid", "Z close completed"],
  ["Een kassaverschil vereist een toelichting.", "A cash variance requires an explanatory note."],
  ["Komende afspraken", "Upcoming appointments"],
  ["Behandelingen", "Services"],
  ["Nieuwe afspraak", "New appointment"],
  ["Geen afspraken.", "No appointments."],
  ["Geen resultaten voor deze zoekopdracht.", "No results for this search."],
  ["Zoek een artikel…", "Search for an item…"],
  ["Winkelwagen", "Cart"],
  ["Geen artikelen.", "No items."],
  ["Winkelwagenkorting", "Cart discount"],
  ["Geen klant", "No client"],
  ["Interne notitie", "Internal note"],
  ["Kassa-instellingen", "POS settings"],
  ["Kassa openen", "Open register"],
  ["Kassa gesloten", "Register closed"],
  ["Verkoop afrekenen", "Check out a sale"],
  ["Sessie beheren", "Manage session"],
  ["Verwacht contant", "Expected cash"],
  ["Omzet incl. btw", "Revenue incl. VAT"],
  ["Instellingen opgeslagen.", "Settings saved."],
  ["Profiel opgeslagen.", "Profile saved."],
  ["Wachtwoord bijgewerkt.", "Password updated."],
  ["Sessie verlopen. Meld u opnieuw aan.", "Session expired. Please sign in again."],
  ["Sluiten", "Close"],
  ["Opslaan", "Save"],
  ["Opslaan…", "Saving…"],
  ["Bewerken", "Edit"],
  ["Annuleren", "Cancel"],
  ["Alles", "All"],
  ["Optioneel", "Optional"],
  ["Geen klant", "No client"],
  ["Afspr.", "Appt."],
  ["Afspraak", "Appointment"],
  ["Laadfout", "Loading error"],
  ["Behandelaar", "Practitioner"],
  ["Cabine", "Room"],
  ["Klant", "Client"],
  ["Notities", "Notes"],
  ["Vernieuwen", "Refresh"],
  ["Toevoegen", "Add"],
  ["Aanmaken", "Create"],
  ["Aanmaken…", "Creating…"],
  ["Verwijderen", "Delete"],
  ["Zoeken", "Search"],
  ["Ja", "Yes"],
  ["Nee", "No"],
  ["Kleur", "Color"],
  ["E-mail", "Email"],
  ["Wachtwoord", "Password"],
  ["Telefoon", "Phone"],
  ["Naam", "Name"],
  ["Prijs", "Price"],
  ["Beschrijving", "Description"],
  ["Actief", "Active"],
  ["Inactief", "Inactive"],
  ["Gepubliceerd", "Published"],
  ["Acties", "Actions"],
  ["Datum", "Date"],
  ["Behandeling", "Service"],
  ["Medewerker", "Staff member"],
  ["Bevestigen", "Confirm"],
  ["Uitvoeren", "Execute"],
  ["Uitvoeren…", "Executing…"],
  ["Gelukt", "Success"],
  ["Opgeslagen", "Saved"],
  ["Terug", "Back"],
  ["Secties", "Sections"],
  ["Onbeperkt", "Unlimited"],
  ["Laden…", "Loading…"],
  ["Voorbereiden…", "Preparing…"],
  ["Betalen", "Pay"],
  ["Contant", "Cash"],
  ["Kaart", "Card"],
  ["Notitie", "Note"],
  ["Doorgaan", "Continue"],
  ["Vorige", "Prev."],
  ["Volgende", "Next"],
  ["Totaal", "Total"],
  ["Intern", "Internal"],
  ["Geschiedenis", "History"],
  ["Producten", "Products"],
  ["Instellingen", "Settings"],
  ["Overzicht", "Overview"],
  ["Modules", "Modules"],
  ["Koppelen", "Connect"],
  ["Testen en opslaan…", "Testing and saving…"],
  ["Identificatie", "Identifier"],
  ["Formule", "Plan"],
  ["Periodiciteit", "Billing interval"],
  ["Maandelijks", "Monthly"],
  ["Jaarlijks", "Yearly"],
  ["Titel", "Title"],
  ["Duur", "Duration"],
  ["Voorraad", "Stock"],
  ["Zichtbaar", "Visible"],
  ["Verborgen", "Hidden"],
  ["Concept", "Draft"],
  ["Toevoegen…", "Adding…"],
  ["Geen", "None"],
  ["Kiezen…", "Choose…"],
  ["Toepassen", "Apply"],
  ["Ontkoppelen", "Disconnect"],
  ["Gekoppeld", "Connected"],
  ["Niet gekoppeld", "Not connected"],
  ["Verzenden", "Send"],
  ["Stap", "Step"],
  ["maand", "month"],
  ["jaar", "year"],
  [" van ", " of "],
  ["Vandaag", "Today"],
  ["Week", "Week"],
  ["Maand", "Month"],
  ["Jaar", "Year"],
  ["Kalender", "Calendar"],
  ["Lijst", "List"],
  ["Online reserveren", "Online booking"],
  ["Geboekt", "Booked"],
  ["Bevestigd", "Confirmed"],
  ["Afgerond", "Completed"],
  ["Geannuleerd", "Cancelled"],
  ["Niet verschenen", "No-show"],
  ["Nog te betalen", "Amount due"],
  ["Reeds betaald", "Already paid"],
  ["Creditnota", "Credit note"],
  ["Cadeaubon", "Gift card"],
  ["Cadeaubonnen", "Gift cards"],
  ["Geen afbeelding.", "No images."],
  ["Geen behandelingen gevonden.", "No services found."],
  ["Op afspraak.", "By appointment."],
];

/** EN → ES phrase replacements (from English base). */
const EN_TO_ES = [
  ["Close", "Cerrar"],
  ["Save", "Guardar"],
  ["Saving…", "Guardando…"],
  ["Edit", "Editar"],
  ["Cancel", "Cancelar"],
  ["All", "Todo"],
  ["Optional", "Opcional"],
  ["No client", "Sin cliente"],
  ["Appt.", "Cita"],
  ["Appointment", "Cita"],
  ["Loading error", "Error de carga"],
  ["Practitioner", "Profesional"],
  ["Room", "Cabina"],
  ["Client", "Cliente"],
  ["Notes", "Notas"],
  ["Refresh", "Actualizar"],
  ["Add", "Añadir"],
  ["Create", "Crear"],
  ["Creating…", "Creando…"],
  ["Delete", "Eliminar"],
  ["Search", "Buscar"],
  ["Yes", "Sí"],
  ["No", "No"],
  ["Color", "Color"],
  ["Email", "Email"],
  ["Password", "Contraseña"],
  ["Phone", "Teléfono"],
  ["Name", "Nombre"],
  ["Price", "Precio"],
  ["Description", "Descripción"],
  ["Active", "Activo"],
  ["Inactive", "Inactivo"],
  ["Published", "Publicado"],
  ["Actions", "Acciones"],
  ["Date", "Fecha"],
  ["Service", "Servicio"],
  ["Staff member", "Empleado/a"],
  ["Confirm", "Confirmar"],
  ["Execute", "Ejecutar"],
  ["Executing…", "Ejecutando…"],
  ["Success", "Éxito"],
  ["Saved", "Guardado"],
  ["Back", "Volver"],
  ["Sections", "Secciones"],
  ["Unlimited", "Ilimitado"],
  ["Loading…", "Cargando…"],
  ["Preparing…", "Preparando…"],
  ["Pay", "Pagar"],
  ["Cash", "Efectivo"],
  ["Card", "Tarjeta"],
  ["Note", "Nota"],
  ["Continue", "Continuar"],
  ["Prev.", "Ant."],
  ["Next", "Sig."],
  ["Total", "Total"],
  ["History", "Historial"],
  ["Products", "Productos"],
  ["Settings", "Ajustes"],
  ["Overview", "Resumen"],
  ["Connect", "Conectar"],
  ["Identifier", "Identificador"],
  ["Plan", "Plan"],
  ["Monthly", "Mensual"],
  ["Yearly", "Anual"],
  ["Title", "Título"],
  ["Duration", "Duración"],
  ["Stock", "Stock"],
  ["Visible", "Visible"],
  ["Hidden", "Oculto"],
  ["Draft", "Borrador"],
  ["None", "Ninguno"],
  ["Choose…", "Elegir…"],
  ["Apply", "Aplicar"],
  ["Disconnect", "Desconectar"],
  ["Connected", "Conectado"],
  ["Not connected", "No conectado"],
  ["Send", "Enviar"],
  ["Step", "Paso"],
  ["Today", "Hoy"],
  ["Week", "Semana"],
  ["Month", "Mes"],
  ["Year", "Año"],
  ["Calendar", "Calendario"],
  ["List", "Lista"],
  ["Booked", "Reservado"],
  ["Confirmed", "Confirmado"],
  ["Completed", "Completado"],
  ["Cancelled", "Cancelado"],
  ["No-show", "Ausente"],
  ["Gift card", "Tarjeta regalo"],
  ["Credit note", "Nota de crédito"],
  ["Register closed", "Caja cerrada"],
  ["Open register", "Abrir caja"],
  ["Cart", "Carrito"],
  ["Services", "Servicios"],
  ["Clients", "Clientes"],
  ["Appointments", "Citas"],
  [" of ", " de "],
];

function applyReplacements(text, pairs) {
  let out = text;
  for (const [from, to] of pairs) {
    out = out.split(from).join(to);
  }
  return out;
}

function nlToEn(text) {
  if (!text || typeof text !== "string") return text;
  return applyReplacements(text, NL_TO_EN);
}

function enToEs(text) {
  if (!text || typeof text !== "string") return text;
  return applyReplacements(text, EN_TO_ES);
}

/** Keys where FR is kept in EN (brands, acronyms). */
const KEEP_AS_FR = new Set(["WooCommerce", "Woo", "Stripe", "SKU", "OK", "—", "RLS", "IA", "NF525", "GKS", "TPE", "EUR", "€", "SaaS"]);

function translateFromNl(nlText, frText) {
  if (KEEP_AS_FR.has(nlText) || KEEP_AS_FR.has(frText)) return nlText;
  if (nlText === frText) {
    // Same in FR/NL — often English loanwords or proper nouns
    return nlText;
  }
  return nlToEn(nlText);
}

function generate() {
  const fr = JSON.parse(fs.readFileSync(path.join(ROOT, "messages/fr.json"), "utf8"));
  const nl = JSON.parse(fs.readFileSync(path.join(ROOT, "messages/nl.json"), "utf8"));
  const frFlat = flatten(fr);
  const nlFlat = flatten(nl);

  const enFlat = {};
  const esFlat = {};

  for (const key of Object.keys(frFlat)) {
    const frVal = frFlat[key];
    const nlVal = nlFlat[key] ?? frVal;
    if (typeof frVal !== "string") {
      enFlat[key] = frVal;
      esFlat[key] = frVal;
      continue;
    }
    const enVal = translateFromNl(nlVal, frVal);
    enFlat[key] = enVal;
    esFlat[key] = enToEs(enVal);
  }

  fs.writeFileSync(
    path.join(ROOT, "messages/en.json"),
    `${JSON.stringify(unflatten(enFlat), null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(ROOT, "messages/es.json"),
    `${JSON.stringify(unflatten(esFlat), null, 2)}\n`,
  );
  console.log("Generated messages/en.json and messages/es.json (offline)");
}

generate();
