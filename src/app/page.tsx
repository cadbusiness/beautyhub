import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const pillars = [
  {
    title: "Institut",
    text: "Rendez-vous, prestations, fiches clients et caisse connectee a WooCommerce.",
  },
  {
    title: "Academie",
    text: "Formations en ligne, coachs et eleves, avec inscriptions et paiements.",
  },
  {
    title: "Marque blanche",
    text: "Hierarchie plateforme -> brands -> instituts, branding et domaines custom.",
  },
  {
    title: "Modules + IA",
    text: "Chaque module declare ses actions IA: l'assistant pilote tout, sans cablage.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16">
      <section className="space-y-4">
        <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-slate-900">
          BeautyHub
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Le SaaS tout-en-un pour instituts, boutiques et academies.
        </h1>
        <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Multi-tenant, modulaire, revendable en marque blanche et pilotable par IA.
          Distribuable en SaaS ou en self-hosted.
        </p>
        <div className="flex gap-3 pt-2">
          <Link href="/login">
            <Button>Espace equipe</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Tableau de bord</Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {pillars.map((p) => (
          <Card key={p.title}>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {p.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {p.text}
            </p>
          </Card>
        ))}
      </section>
    </main>
  );
}
