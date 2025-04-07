import { parseArgs } from "jsr:@std/cli/parse-args";
import PreProcHandler from "./PreProcHandler.ts";
import { getLangParams } from "./PreProcConfigBuilder.ts";
const args = parseArgs(
  Deno.args,
  {
    string: ["file", "lang", "out", "root"],
  },
);

function langFromExt(ext: string): string | false {
  switch ((ext.split(".").pop() || "").toLowerCase()) {
    case "lsl":
      return "lsl";
    case "slua":
    case "lua":
    case "luau":
      return "lua";
  }
  return false;
}

const file = args.file;
if (!file) {
  console.error("No file specified");
  Deno.exit(1);
}

const lang = langFromExt(args.lang ?? file);

if (lang !== "lsl" && lang != "lua") {
  console.error("Could not determine language");
  Deno.exit(1);
}

const handler = new PreProcHandler(
  file,
  (result) => {
    console.log(JSON.stringify(result));
    return Promise.resolve();
  },
  {
    root: args.root ?? "",
    options: {},
    language: getLangParams(lang),
  },
);

handler.runPreProc();
