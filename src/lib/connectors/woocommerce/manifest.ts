import type { ConnectorManifest } from "../types";

export const WOO_CONNECTOR_ID = "woocommerce";

export const wooConnectorManifest: ConnectorManifest = {
  id: WOO_CONNECTOR_ID,
  name: "WooCommerce",
  description: "Catalogue, stock bidirectionnel et commandes caisse ↔ boutique.",
  version: "1.1.1",
  platform: "woocommerce",
  capabilities: ["catalog_sync", "stock_sync", "order_push", "order_pull", "webhooks"],
  packagePath: "extensions/woocommerce/beautyhub-connector",
  settingsHref: "/compte/institut/woocommerce",
};
