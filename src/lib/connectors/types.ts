export type ConnectorId = string;

export type ConnectorCapability =
  | "catalog_sync"
  | "stock_sync"
  | "order_push"
  | "order_pull"
  | "webhooks";

/** Contrat d'un connecteur commerce téléchargeable (plugin boutique, app Shopify…). */
export interface ConnectorManifest {
  id: ConnectorId;
  name: string;
  description: string;
  version: string;
  /** Plateforme cible (woocommerce, shopify, prestashop…). */
  platform: string;
  capabilities: ConnectorCapability[];
  /** Chemin relatif au repo du package téléchargeable (plugin WP, etc.). */
  packagePath?: string;
  /** Page de configuration dans le back-office BeautyHub. */
  settingsHref: string;
}
