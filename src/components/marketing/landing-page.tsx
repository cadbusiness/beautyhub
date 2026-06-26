import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const modules = [
  {
    icon: "📅",
    title: "Rendez-vous",
    text: "Calendrier praticien/cabine, réservation en ligne, portail client.",
  },
  {
    icon: "🛒",
    title: "Caisse unifiée",
    text: "Prestations, produits WooCommerce et articles internes dans un seul panier.",
  },
  {
    icon: "🎓",
    title: "Académie",
    text: "Formations, inscriptions et suivi des élèves.",
  },
  {
    icon: "🤖",
    title: "Assistant IA",
    text: "Actions déclarées par module — pilotage sans recâblage.",
  },
  {
    icon: "🏷️",
    title: "Marque blanche",
    text: "Plateforme → marques → instituts, domaines et branding custom.",
  },
  {
    icon: "🔐",
    title: "Multi-tenant",
    text: "Isolation stricte par institut, RLS Supabase, rôles équipe.",
  },
];

const steps = [
  { n: "1", title: "Connecte ton institut", text: "WooCommerce, Stripe, équipe et prestations." },
  { n: "2", title: "Active tes modules", text: "Institut, Académie — selon ta formule." },
  { n: "3", title: "Encaisse et planifie", text: "Caisse, RDV publics et assistant IA." },
];

export function LandingPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
              B
            </span>
            <span className="text-lg font-semibold tracking-tight">BeautyHub</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/reserver">
              <Button variant="ghost" className="text-slate-300">
                Réserver
              </Button>
            </Link>
            <Link href="/login">
              <Button>Connexion équipe</Button>
            </Link>
          </nav>
        </div>
      </header>

      {!configured ? (
        <div className="border-b border-amber-900/50 bg-amber-950/40 px-6 py-2 text-center text-xs text-amber-200">
          Déploiement incomplet — configure{" "}
          <code className="rounded bg-amber-900/50 px-1">NEXT_PUBLIC_SUPABASE_*</code> sur
          Vercel puis redeploie.
        </div>
      ) : null}

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgb(124 58 237 / 0.35), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-4 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1 text-sm text-violet-300">
            SaaS multi-tenant · Instituts &amp; académies
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            Gère ton institut
            <span className="block text-violet-400">comme une plateforme pro</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Rendez-vous, caisse WooCommerce, clients, équipe et formations — un seul
            back-office. Revendable en marque blanche ou self-hosted.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/login">
              <Button className="h-12 px-8 text-base">Accéder au back-office</Button>
            </Link>
            <Link href="/client/login">
              <Button variant="outline" className="h-12 border-slate-700 px-8 text-base">
                Espace client
              </Button>
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-3 gap-6 border-t border-slate-800 pt-10 text-center sm:max-w-lg sm:mx-auto">
            {[
              { v: "6+", l: "Modules métier" },
              { v: "RLS", l: "Isolation tenant" },
              { v: "IA", l: "Actions intégrées" },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-2xl font-semibold text-white">{s.v}</p>
                <p className="text-xs text-slate-500">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="border-t border-slate-800 bg-slate-900/50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold text-white">
            Tout ce qu&apos;il faut pour ton activité
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-400">
            Chaque module s&apos;active selon la formule de l&apos;institut. Pas de usine à gaz.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <Card
                key={m.title}
                className="border-slate-800 bg-slate-900/80 transition-colors hover:border-violet-500/40"
              >
                <span className="text-2xl">{m.icon}</span>
                <h3 className="mt-3 font-semibold text-white">{m.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{m.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-white">Démarrage rapide</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 font-medium text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800 px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/80 to-slate-900 p-10 text-center">
          <h2 className="text-2xl font-semibold text-white">Prêt à piloter ton institut ?</h2>
          <p className="mt-2 text-sm text-slate-400">
            Connecte-toi avec ton compte équipe ou réserve un créneau en ligne.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login">
              <Button className="h-11 px-6">Connexion équipe</Button>
            </Link>
            <Link href="/reserver">
              <Button variant="outline" className="h-11 border-slate-600 px-6">
                Prendre RDV
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 px-6 py-8 text-center text-xs text-slate-500">
        BeautyHub · Plateforme SaaS pour instituts de beauté
      </footer>
    </div>
  );
}
