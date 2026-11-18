import type { OxfmtConfig } from "oxfmt";

type SortImports = OxfmtConfig["sortImports"];

export type FormatConfig = OxfmtConfig & { ignorePatterns: string[] };

function mergedSortImports({ defaults, option }: { defaults: SortImports; option: SortImports }) {
  if (option === undefined || (option === true && typeof defaults === "object")) {
    return defaults;
  }

  return typeof option === "object" && typeof defaults === "object"
    ? { ...defaults, ...option }
    : option;
}

export function defineFormatPreset(
  defaults: FormatConfig,
): (options?: OxfmtConfig) => FormatConfig {
  return (options = {}) => {
    const config: FormatConfig = {
      ...defaults,
      ...options,
      ignorePatterns: [...defaults.ignorePatterns, ...(options.ignorePatterns ?? [])],
    };

    const sortImports = mergedSortImports({
      defaults: defaults.sortImports,
      option: options.sortImports,
    });

    if (sortImports !== undefined) {
      config.sortImports = sortImports;
    }

    return config;
  };
}
