export type TenantComplianceChecklist = {
  privacy_policy?: string;
  client_notices?: string;
  dpa_signed?: string;
  retention_policy?: string;
  team_training?: string;
};

export const COMPLIANCE_CHECKLIST_KEYS = [
  "privacy_policy",
  "client_notices",
  "dpa_signed",
  "retention_policy",
  "team_training",
] as const;

export type ComplianceChecklistKey = (typeof COMPLIANCE_CHECKLIST_KEYS)[number];

export function parseTenantCompliance(raw: unknown): TenantComplianceChecklist {
  if (typeof raw !== "object" || raw === null) return {};
  return raw as TenantComplianceChecklist;
}

export function complianceProgress(
  checklist: TenantComplianceChecklist,
): { done: number; total: number } {
  const total = COMPLIANCE_CHECKLIST_KEYS.length;
  const done = COMPLIANCE_CHECKLIST_KEYS.filter((k) => checklist[k]).length;
  return { done, total };
}

export function buildDpaDocument(input: {
  platformName: string;
  platformAddress: string;
  tenantName: string;
  tenantLegalName?: string | null;
  date: string;
}): string {
  const processor = input.tenantLegalName?.trim() || input.tenantName;
  return `# Accord de sous-traitance (DPA) — Article 28 RGPD

**Date :** ${input.date}

## 1. Parties

**Responsable de traitement (« Client »)**  
Raison sociale : ${processor}  
Institut : ${input.tenantName}

**Sous-traitant (« BeautyHub »)**  
${input.platformName}  
${input.platformAddress}

Le Client utilise la plateforme BeautyHub pour gérer ses rendez-vous, clients et activité commerciale. BeautyHub traite des données personnelles pour le compte du Client, en qualité de sous-traitant au sens de l'article 28 du RGPD.

## 2. Objet et durée

Traitement des données personnelles des clients finaux de l'institut, dans le cadre de l'utilisation du logiciel BeautyHub, pour la durée du contrat SaaS entre les parties.

## 3. Nature et finalités du traitement

- Gestion de rendez-vous et planning
- Fichier clients (CRM)
- Caisse et documents commerciaux
- Portail client et communications transactionnelles
- Programme fidélité (si activé)
- Assistant IA (si activé et configuré par le Client)

## 4. Types de données et personnes concernées

**Personnes concernées :** clients finaux de l'institut, membres de l'équipe.

**Catégories de données :** identité, coordonnées, historique RDV et achats, préférences marketing, notes internes, données de connexion portail client.

## 5. Obligations du sous-traitant (BeautyHub)

BeautyHub s'engage à :

- traiter les données uniquement sur instruction documentée du Client ;
- garantir la confidentialité des personnes autorisées à traiter les données ;
- mettre en œuvre des mesures techniques et organisationnelles appropriées (RLS multi-tenant, chiffrement des secrets, authentification) ;
- ne pas recruter un autre sous-traitant sans information préalable du Client (liste sur /legal/sous-traitants) ;
- aider le Client à répondre aux demandes d'exercice des droits (export, anonymisation intégrés) ;
- supprimer ou restituer les données à la fin du contrat, sous réserve des obligations légales de conservation ;
- mettre à disposition les informations nécessaires pour démontrer la conformité.

## 6. Obligations du responsable de traitement (Client)

Le Client s'engage à :

- disposer d'une base légale pour chaque traitement ;
- informer les personnes concernées (mentions légales, politique de confidentialité) ;
- recueillir les consentements requis (ex. marketing) ;
- paramétrer les durées de conservation adaptées à son activité ;
- former son équipe à la protection des données.

## 7. Sous-traitants ultérieurs

Liste indicative : Supabase (hébergement BDD), Vercel (hébergement app), Stripe (paiements), OpenAI (assistant IA, si activé). Détail : https://beautyhub.app/legal/sous-traitants

## 8. Transferts hors UE

Le Client est informé que certains sous-traitants peuvent traiter des données hors Union européenne, sous réserve de garanties appropriées (clauses contractuelles types, mesures complémentaires).

## 9. Violations de données

BeautyHub notifiera le Client dans les meilleurs délais après découverte d'une violation de données personnelles le concernant.

## 10. Sort des données

À la résiliation, export des données via les outils BeautyHub puis anonymisation/suppression selon instructions du Client, sous réserve des obligations comptables (conservation des écritures).

---

**Pour le Client (Responsable de traitement)**  

Nom : ___________________________  
Date : ___________________________  
Signature :

**Pour BeautyHub (Sous-traitant)**  

Nom : ___________________________  
Date : ___________________________  
Signature :
`;
}
