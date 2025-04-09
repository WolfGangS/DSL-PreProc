import { LanguageConfig } from "./PreProc/PreProc.ts";

const languages: { [k: string]: string | LanguageConfig } = {
  lua: {
    comments: {
      single: "--",
      multi: {
        open: "--[[",
        close: "]]",
      },
    },
    leadChar: "#",
    leadCharCommented: true,
    validSymbol: /^[A-z]{1}[A-z0-9_]*$/,
    predefined: {
      "require(f)": "(function()\n--#include f\nend)()",
    },
    string: [
      {
        char: "'",
        escape: "\\",
      },
      {
        char: '"',
        escape: "\\",
      },
      {
        char: "`",
        escape: "\\",
        interpolate: {
          start: "{",
          end: "}",
        },
      },
    ],
  },
  bash: {
    comments: {
      single: "#",
      multi: false,
    },
    leadChar: "#",
    leadCharCommented: false,
    validSymbol: /^[A-z]{1}[A-z0-9_]*$/,
    string: [],
  },
  c: {
    comments: {
      single: "//",
      multi: {
        open: "/*",
        close: "*/",
      },
    },
    leadChar: "#",
    leadCharCommented: false,
    validSymbol: /^[A-z]{1}[A-z0-9_]*$/,
    string: [],
  },
  cpp: "c",
  h: "c",
  lsl: {
    comments: {
      single: "//",
      multi: {
        open: "/*",
        close: "*/",
      },
    },
    leadChar: "#",
    leadCharCommented: false,
    validSymbol: /^[A-z]{1}[A-z0-9_]*$/,
    string: [
      {
        char: '"',
        escape: "\\",
      },
    ],
  },
  luau: "lua",
};

export default languages;
