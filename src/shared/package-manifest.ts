import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export function nearestPackageDirectory(directory: string): string | undefined {
  for (let current = directory; ; current = dirname(current)) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }

    if (dirname(current) === current) {
      return undefined;
    }
  }
}

type ManifestFields = ReadonlyMap<string, unknown> | undefined;

type CachedManifest = { mtimeMs: number; size: number; fields: ManifestFields };

const manifests = new Map<string, CachedManifest>();

function parsedManifest(path: string) {
  try {
    const manifest: unknown = JSON.parse(readFileSync(path, "utf8"));

    return manifest;
  } catch {
    return undefined;
  }
}

function manifestFields(path: string) {
  const manifest = parsedManifest(path);

  return typeof manifest === "object" && manifest !== null && !Array.isArray(manifest)
    ? new Map(Object.entries(manifest))
    : undefined;
}

export function readPackageManifest(directory: string): ManifestFields {
  const path = join(directory, "package.json");
  const stats = statSync(path, { throwIfNoEntry: false });

  if (stats === undefined) {
    manifests.delete(path);

    return undefined;
  }

  const cached = manifests.get(path);

  if (cached?.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return cached.fields;
  }

  const fields = manifestFields(path);

  manifests.set(path, { mtimeMs: stats.mtimeMs, size: stats.size, fields });

  return fields;
}
