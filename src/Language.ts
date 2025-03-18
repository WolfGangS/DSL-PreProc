import { PreProcConfig } from "./PreProc/PreProc.ts";

const languages: { [k: string]: string | PreProcConfig } = {
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
    options: {},
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
    options: {},
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
    options: {},
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
    options: {},
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
