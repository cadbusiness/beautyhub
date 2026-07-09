import { apiBaseUrl } from "@/lib/app-url";
import { wooConnectorManifest } from "./manifest";

export interface ConnectorReleaseInfo {
  name: string;
  slug: string;
  version: string;
  author: string;
  author_profile: string;
  homepage: string;
  requires: string;
  tested: string;
  requires_php: string;
  download_url: string;
  description: string;
  installation: string;
  changelog: string;
}

export function getWooConnectorRelease(): ConnectorReleaseInfo {
  const base = apiBaseUrl();
  const version = wooConnectorManifest.version;

  return {
    name: "BeautyHub Connector",
    slug: "beautyhub-connector",
    version,
    author: "BeautyHub",
    author_profile: "https://beautyhub.app",
    homepage: "https://beautyhub.app",
    requires: "6.0",
    tested: "6.7",
    requires_php: "7.1",
    download_url: `${base}/downloads/beautyhub-connector.zip`,
    description:
      "<p>Connecteur WooCommerce pour synchroniser catalogue, stock et commandes avec BeautyHub (caisse institut).</p>",
    installation:
      "<ol><li>Installez et activez le plugin</li><li>Ouvrez <strong>BeautyHub</strong> dans le menu WordPress</li><li>Connectez depuis le back-office BeautyHub (lien magique)</li></ol>",
    changelog: `
      <h4>${version}</h4>
      <ul>
        <li>Nouvelle interface : header avec logo, bouton « Se connecter » en un clic, design pleine largeur</li>
        <li>Protection anti-double-déclaration + garde version PHP (fin des erreurs fatales à l'activation)</li>
        <li>Compatibilité PHP 7.1+ (correctif erreur fatale à l'activation)</li>
        <li>Mises à jour automatiques depuis BeautyHub (comme Bruce Pilot)</li>
        <li>Menu BeautyHub visible dans la barre latérale WordPress</li>
        <li>Connexion en un clic sans clés API manuelles</li>
        <li>Synchronisation stock bidirectionnelle boutique ↔ caisse</li>
      </ul>
    `.trim(),
  };
}
