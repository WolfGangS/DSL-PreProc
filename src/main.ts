import { exists } from "jsr:@std/fs/exists";
import { ComCommand, ComHandler } from "./coms.ts";
import Config from "./Config.ts";
import Instance from "./Instance.ts";

await Config.get().setup();
const coms = ComHandler.setup(Config.get().port, startProc);

console.log("Projects folder:", Config.get().project_dir);

const instances: { [k: string]: Instance } = {};

async function startProc(args: string[]): Promise<void> {
  if (args.length != 1) return;
  const file = args[0];
  if (!(await exists(file))) {
    console.log("File does not exist, not starting.", file);
    return;
  }
  if (instances[file]) {
    console.log("Repeat file", file);
  } else {
    const instance = new Instance(
      file,
      Config.get(),
      (e: string) => {
        if (e) console.error(e);
        delete instances[file];
      },
    );
    instances[file] = instance;
    instance.start();
  }
}

function init() {
  coms.listen()
    .then(() => console.log("setup listen over"))
    .catch((e) => console.log("setup liste error", e));
  try {
    const file = Config.get().file;
    if (file) startProc([file]);
  } catch (_e: any) {
    console.log("Not starting server with file");
  }
}

async function run() {
  console.log("Connecting...");
  let res = false;
  if (!Config.get().server || Config.get().client) {
    res = await coms.connect(ComCommand.NEW, [Config.get().file]);
  } else {
    res = await coms.connect(ComCommand.PING);
  }
  if (res) {
    Deno.exit();
  }
  console.log("No existing host");
  if (!Config.get().client) {
    console.log("Starting...");
    init();
  }
}

try {
  await run();
} catch (e) {
  if (e instanceof Array) {
    console.error("Errors:\n\t" + e.join("\n\t"));
  } else {
    console.error(e);
  }
  alert("PreProc Error...");
  Deno.exit(1);
}
