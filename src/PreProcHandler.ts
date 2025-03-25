import PreProc, {
  DefFunc,
  PreProcConfig,
  PreProcStateInterface,
} from "./PreProc/PreProc.ts";
import { Tokenstream } from "./PreProc/Streams.ts";

export default class PreProcHandler {
  private files: string[];
  private root_file: string;
  private watcher: Deno.FsWatcher | null = null;
  private output: (content: string) => Promise<void>;
  private preProcConfig: PreProcConfig;
  private closed = false;

  constructor(
    root_file: string,
    output: (content: string) => Promise<void>,
    preProcCpnfig: PreProcConfig,
  ) {
    this.root_file = root_file;
    this.files = [root_file];
    this.output = output;
    this.preProcConfig = preProcCpnfig;
  }

  async run() {
    this.runPreProc();
    let timeout: number | null = null;
    while (!this.closed) {
      this.watcher = Deno.watchFs(this.files);
      for await (const event of this.watcher) {
        switch (event.kind) {
          case "modify":
          case "remove":
          case "rename":
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
              timeout = null;
              this.runPreProc();
            }, 2500);
            break;
        }
      }
    }
  }

  close() {
    this.watcher?.close();
    this.watcher = null;
    this.closed = true;
  }

  private async runPreProc(dry: boolean = false) {
    console.log("PreProc Run");
    const preProc = await PreProc.createFromFile(
      this.root_file,
      new ProcState(
        this.cleanState(),
        this.preProcConfig,
      ),
      this.preProcConfig,
      1,
    );
    try {
      const output = await preProc.run();
      if (!dry) {
        await this.output(output);
      }
    } catch (e: unknown) {
      console.error(e);
    }
    this.files = preProc.state.files;
    this.watcher?.close();
  }

  private cleanState(): PreProcStateStore {
    return {
      "__UNIXTIME__": Math.floor(Date.now() / 1000).toString(),
    };
  }

  addFile(path: string): void {
    if (this.files.includes(path)) return;
    this.files.push(path);
  }
}

type PreProcStateStore = { [k: string]: string | DefFunc };

class ProcState implements PreProcStateInterface {
  private state: PreProcStateStore;
  private _files: string[] = [];
  private config: PreProcConfig;
  constructor(state: PreProcStateStore, config: PreProcConfig) {
    this.state = state;
    this.config = config;
    const pre = config.predefined ?? {};
    for (const name in pre) {
      this.store(name, pre[name]);
    }
  }
  addFile(path: string): void {
    if (this._files.includes(path)) return;
    this._files.push(path);
  }
  store(name: string, value: string): void {
    if (!this.defFunction(name, value)) {
      this.state[name] = value;
    }
  }
  defFunction(func: string, body: string): boolean {
    if (!func.match(/^([A-z0-9_]+\([A-z, ]*\))$/)) return false;
    const parts = func.substring(0, func.length - 1).split("(");
    const argstr = parts[1];
    const args = argstr == "" ? [] : argstr.split(",").map((arg) => arg.trim());
    const name = parts[0];

    const tokes: string[] = [];
    const stream = new Tokenstream(body, this.config);
    let toke = stream.next();
    while (toke) {
      tokes.push(toke);
      toke = stream.next();
    }

    this.state[name] = (vals: string[]) => {
      if (vals.length != args.length) {
        throw `Invalid arg count for define func '${name}' expected ${args.length} got ${vals.length}`;
      }
      const pairs: { [k: string]: string } = {};
      for (const index in args) {
        pairs[args[index]] = vals[index];
      }
      return tokes.map((toke) => pairs[toke] ?? toke).join("");
    };

    return true;
  }
  read(name: string): string | DefFunc | null {
    return this.state[name] ?? null;
  }
  get files(): string[] {
    return [...this._files];
  }
  get defines(): string[] {
    return Object.keys(this.state);
  }
}
