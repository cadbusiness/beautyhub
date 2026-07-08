import type { ConnectorId, ConnectorManifest } from "./types";

const registry = new Map<ConnectorId, ConnectorManifest>();

export function registerConnector(manifest: ConnectorManifest): void {
  registry.set(manifest.id, manifest);
}

export function getConnector(id: ConnectorId): ConnectorManifest | undefined {
  return registry.get(id);
}

export function getAllConnectors(): ConnectorManifest[] {
  return [...registry.values()];
}
