import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const modules = [
  {
    icon: "📅",
    title: "Rendez-vous",
    text: "Calendrier praticien/cabine, reservation en ligne, portail client.",
  },
  {
    icon: "🛒",
    title: "Caisse unifiee",
    text: "Prestations, produits WooCommerce et articles internes dans un seul panier.",
  },
  {
    icon: "🎓",
    title: "Academie",
    text: "Formations, inscriptions et suivi des eleves.",
  },
  {
    icon: "🤖",
    title: "Assistant IA",
    text: "Actions declarees par module — pilotage sans recablage.",
  },
  {
    icon: "🏷️",
    title: "Marque blanche",
    text: "Plateforme → marques → instituts, domaines et branding custom.",
  },
  {
    icon: "🔐",
    title: "Multi-tenant",
    text: "Isolation stricte par institut, RLS Supabase, roles equipe.",
  },
];

const steps = [
  { n: "1", title: "Connecte ton institut", text: "WooCommerce, Stripe, equipe et prestations." },
  { n: "2", title: "Active tes modules", text: "Institut, Academie — selon ta formule." },
  { n: "3", title: "Encaisse et planifie", text: "Caisse, RDV publics et assistant IA." },
];

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
              B
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">BeautyHub</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/reserver">
              <Button variant="ghost">Reserver</Button>
            </Link>
            <Link href="/login">
              <Button>Connexion equipe</Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 pb-20 pt-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgb(124 58 237 / 0.12), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-4 inline-flex rounded-full border border-violet-200 bg-violet-50 px-4 py-1 text-sm text-violet-700">
            SaaS multi-tenant · Instituts &amp; academies
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Gere ton institut
            <span className="block text-violet-600">comme une plateforme pro</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Rendez-vous, caisse WooCommerce, clients, equipe et formations — un seul
            back-office. Revendable en marque blanche ou self-hosted.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/login">
              <Button className="h-12 px-8 text-base">Acceder au back-office</Button>
            </Link>
            <Link href="/client/login">
              <Button variant="outline" className="h-12 px-8 text-base">
                Espace client
              </Button>
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-3 gap-6 border-t border-slate-200 pt-10 text-center sm:mx-auto sm:max-w-lg">
            {[
              { v: "6+", l: "Modules metier" },
              { v: "RLS", l: "Isolation tenant" },
              { v: "IA", l: "Actions integrees" },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-2xl font-semibold text-slate-900">{s.v}</p>
                <p className="text-xs text-slate-500">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold text-slate-900">
            Tout ce qu&apos;il faut pour ton activite
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-600">
            Chaque module s&apos;active selon la formule de l&apos;institut. Pas de usine a gaz.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <Card
                key={m.title}
                className="transition-colors hover:border-violet-300 hover:shadow-md"
              >
                <span className="text-2xl">{m.icon}</span>
                <h3 className="mt-3 font-semibold text-slate-900">{m.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{m.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-slate-900">Demarrage rapide</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 font-medium text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 px-6 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-10 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Pret a piloter ton institut ?</h2>
          <p className="mt-2 text-sm text-slate-600">
            Connecte-toi avec ton compte equipe ou reserve un creneau en ligne.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login">
              <Button className="h-11 px-6">Connexion equipe</Button>
            </Link>
            <Link href="/reserver">
              <Button variant="outline" className="h-11 px-6">
                Prendre RDV
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-8 text-center text-xs text-slate-500">
        BeautyHub · Plateforme SaaS pour instituts de beaute
      </footer>
    </div>
  );
}
