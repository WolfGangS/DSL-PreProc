import { parseArgs } from "jsr:@std/cli/parse-args";
import PreProcHandler from "./PreProcHandler.ts";
import { getLangParams } from "./PreProcConfigBuilder.ts";
import meta from "./meta.json" with { type: "json" };

const args = parseArgs(
  Deno.args,
  {
    string: ["file", "lang", "out", "root", "remapLines"],
    boolean: ["raw", "version"],
  },
);

if (args.version) {
  console.log(`DSL Preproc: ${meta.version}`);
  Deno.exit();
}

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

try {
  await Deno.stat(file);
} catch (_e) {
  console.error(`Cannot access file '${file}'`);
  Deno.exit(1);
}

const lang = langFromExt(args.lang ?? file);

if (lang !== "lsl" && lang != "lua") {
  console.error("Could not determine language");
  Deno.exit(1);
}

const language = getLangParams(lang);

if (args.remapLines) {
  const lineNumbers = args.remapLines.split(",").map((s) => parseInt(s.trim()));
  const text = await Deno.readTextFile(file);
  const lines = text.split("\n");
  const out: { [k: string]: [string, number] } = {};
  let mapFile = "";
  let mapLine = 0;
  let mapAtLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith(`${language.comments.single} : MAP : `)) {
      const map = line.split(":").map((p) => p.trim());
      if (map.length != 5) {
        throw "INVALID MAP ENTRY";
      }
      mapAtLine = i;
      mapFile = map[2];
      mapLine = parseInt(map[3]);
    }
    if (lineNumbers.includes(i)) {
      out[i.toString()] = [mapFile, (i - mapAtLine) + mapLine - 1];
    }
  }
  console.log(
    JSON.stringify({
      success: true,
      lines: out,
    }),
  );
} else {
  const handler = new PreProcHandler(
    file,
    (result) => {
      if (args.raw) {
        console.log(result.text);
      } else {
        console.log(JSON.stringify(result));
      }
      return Promise.resolve();
    },
    {
      root: args.root ?? "",
      options: {},
      language,
    },
  );

  handler.runPreProc();
}
