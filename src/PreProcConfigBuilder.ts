import Languages from "./Language.ts";
import { LanguageConfig } from "./PreProc/PreProc.ts";

export function getLangParams(fileExt: string): LanguageConfig {
  let config = Languages[fileExt];
  while (typeof config == "string") {
    config = Languages[config];
  }
  if (typeof config == "object" && config != null) return config;
  throw `Unable to get language config for '${fileExt}'`;
}
