import PreProc, {
  DefFunc,
  PreProcConfig,
  PreProcStateInterface,
} from "./PreProc/PreProc.ts";

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
  constructor(state: PreProcStateStore = {}) {
    this.state = state;
  }
  addFile(path: string): void {
    if (this._files.includes(path)) return;
    this._files.push(path);
  }
  store(name: string, value: string | DefFunc): void {
    this.state[name] = value;
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
