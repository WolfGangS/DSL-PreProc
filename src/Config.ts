import { ensureDir } from "jsr:@std/fs/ensure-dir";
import { Args, parseArgs } from "jsr:@std/cli/parse-args";

export default class Config {
  private static _instance: Config | null = null;

  private readonly config_file: string;

  private _project_dir: string;
  private _port: number = 22623;
  private _cmd: string = "code $project";

  private _args: Args | null = null;

  private constructor() {
    let home = Deno.env.get("HOME");
    if (!home) home = Deno.env.get("HOMEPATH");
    if (!home) home = Deno.env.get("USERPROFILE");
    this.config_file = home + "/.config/deno_preproc";
    this._project_dir = home + "/projects";
  }

  public static get(): Config {
    if (this._instance == null) {
      this._instance = new Config();
    }
    return this._instance;
  }

  async setup() {
    try {
      const text = await Deno.readTextFile(this.config_file);
      const json = JSON.parse(text);
      if (typeof json != "object" || json == null || json instanceof Array) {
        return;
      }
      if (Object.hasOwn(json, "port")) this.port = parseInt(json.port);
      if (Object.hasOwn(json, "project_dir")) {
        this.project_dir = String(json.project_dir);
      }
      await ensureDir(this._project_dir);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        console.log("Couldn't read config file", e.name);
      }
    }
    console.log("Writing config file", this.config_file);
    await Deno.writeTextFile(this.config_file, JSON.stringify(this, null, 2));
    this.parseArguments();
  }

  private parseArguments() {
    const args = parseArgs(
      Deno.args,
      {
        string: ["projectsdir", "cmd", "port"],
        boolean: ["client", "server"],
        default: {
          client: false,
          server: false,
        },
      },
    );
    this._args = args;
    if (args.projectsdir) this.project_dir = args.projectsdir;
    if (args.cmd) this.cmd = args.cmd;
    if (args.port) this.port = parseInt(args.port);
  }

  public get port(): number {
    return this._port;
  }

  private set port(port: number) {
    if (port < 1000) port = 22623;
    this._port = port;
  }

  public get cmd(): string {
    return this._cmd;
  }

  private set cmd(cmd: string) {
    this._cmd = cmd;
  }

  public get project_dir(): string {
    return this._project_dir;
  }

  public set project_dir(project_dir: string) {
    this._project_dir = project_dir;
  }

  public get args(): Args {
    if (this._args) return this._args;
    throw "asked for args before parsed";
  }

  public get client(): boolean {
    return this.args.client;
  }

  public get server(): boolean {
    return this.args.server;
  }

  public get file(): string {
    const file = this.args._[0] ?? null;
    if (file && typeof file == "string") return file;
    throw `Didn't get file as expected '${file}'`;
  }
}
