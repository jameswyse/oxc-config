import type { Options } from "@oxlint/plugins";

export function optionStrings(options: Readonly<Options>, key: string): string[] {
  const [option] = options;

  if (typeof option !== "object" || option === null || Array.isArray(option)) {
    return [];
  }

  const value = option[key];

  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
