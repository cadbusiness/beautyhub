import { registerConnector } from "./registry";
import { wooConnectorManifest } from "./woocommerce/manifest";

registerConnector(wooConnectorManifest);

export { getAllConnectors, getConnector } from "./registry";
export type { ConnectorCapability, ConnectorManifest } from "./types";
export { wooConnectorManifest, WOO_CONNECTOR_ID } from "./woocommerce/manifest";
