import Config from "./Config.ts";
import FileHandler from "./FileHandler.ts";
import { LanguageConfig, PreProcConfig } from "./PreProc/PreProc.ts";
import { getLangParams } from "./PreProcConfigBuilder.ts";
import PreProcHandler, { PreProcResult } from "./PreProcHandler.ts";
import { exists } from "jsr:@std/fs/exists";

export default class Instance {
  private filename: string;
  private fileHandler: FileHandler;
  private closed: boolean = true;
  private params: InstanceParams;
  private preProcHandler: PreProcHandler | null = null;
  private preProcConfig: PreProcConfig | null = null;
  private config: Config;
  private closeHandler: ((e: string) => void) | null;
  private output: ((result: PreProcResult) => Promise<void>) | null = null;

  constructor(
    filename: string,
    config: Config,
    closeHandler: (e: string) => void,
    output: ((result: PreProcResult) => Promise<void>) | null = null,
  ) {
    this.filename = filename;
    this.fileHandler = new FileHandler(filename, () => this.close());
    this.params = new InstanceParams();
    this.config = config;
    this.closeHandler = closeHandler;
    console.log("New Instance", filename);
    this.output = output;
  }

  private async loadParams() {
    const text = await Deno.readTextFile(this.filename);
    const langIndex = text.indexOf("@language");
    if (langIndex > 0) {
      const nl = text.substring(langIndex).indexOf("\n");
      const lang = text.substring(langIndex + 10, langIndex + nl).trim();
      this.preProcConfig = this.createPreProcConfig(lang);
    } else {
      this.preProcConfig = this.createPreProcConfig();
    }
    const lines = text.split("\n");
    for (let line of lines) {
      line = line.trim();
      if (!line.startsWith(this.preProcConfig.language.comments.single)) {
        continue;
      }
      line = line.substring(this.preProcConfig.language.comments.single.length);
      line = line.trim();
      if (!line.startsWith("@")) continue;
      line = line.substring(1);
      let spc = line.indexOf(" ");
      if (spc < 0) spc = line.length;
      const cmd = line.substring(0, spc).trim().toLowerCase();
      const arg = line.substring(spc + 1).trim();
      switch (cmd) {
        case "project":
          this.params.project = arg;
          break;
        case "file":
          this.params.file = arg;
          break;
        case "hash":
          this.params.hash = arg;
          break;
        default:
          if (cmd.startsWith("opt-")) {
            const ar = arg == "true"
              ? true
              : (arg == "false" ? false : (arg ? arg : true));
            this.params.options[cmd.substring(4)] = ar;
            this.preProcConfig.options[cmd.substring(4)] = ar;
          }
          break;
      }
    }
    if (!(await exists(this.rootProjectFolder, { isFile: false }))) {
      throw `Cannot get root project folder '${this.rootProjectFolder}'`;
    }
    if (!(await exists(this.rootProjectFile, { isFile: false }))) {
      throw `Cannot get root project file '${this.rootProjectFile}'`;
    }
  }

  private createPreProcConfig(fileExt: string | null = null): PreProcConfig {
    fileExt = fileExt ? fileExt : this.getFileExtension();
    this.params.language = fileExt;
    return {
      root: "",
      options: {},
      language: getLangParams(fileExt),
    };
  }

  async start() {
    try {
      await this.loadParams();
      if (this.preProcConfig) {
        this.preProcHandler = new PreProcHandler(
          this.rootProjectFile,
          (content) => this.write(content),
          this.preProcConfig,
        );
        await this.preProcHandler.run();
      } else throw "No Lang Params";
    } catch (e: unknown) {
      this.close(`${e}`);
    }
    this.close();
  }

  private getFileExtension(): string {
    const parts = this.filename.split("/");
    const last = parts.pop();
    if (last) {
      const sections = last.split(".");
      const ext = sections.pop();
      if (ext) return ext;
    }
    throw "Unable to get file extension";
  }

  close(e: string = "") {
    this.preProcHandler?.close();
    if (this.closeHandler) this.closeHandler(e);
    this.closeHandler = null;
  }

  async write(content: PreProcResult) {
    if (this.output) {
      this.output(content);
      return;
    }
    if (this.params.hash == content.hash) return;
    console.log("Pushing Change");
    this.params.hash = content.hash;
    await this.fileHandler.write(
      this.header + "\n" + content.text +
        (content.text.charAt(content.text.length - 1) != "\n" ? "\n" : ""),
    );
  }

  get language(): LanguageConfig | null {
    return this.preProcConfig?.language || null;
  }

  get header(): string {
    const prefix = `${this.language?.comments.single} @`;
    const lines = [
      `language ${this.params.language}`,
      `project ${this.params.project}`,
      `file ${this.params.file}`,
      `hash ${this.params.hash}`,
      `date ${(new Date()).toISOString()}`,
    ];
    if (Object.keys(this.params.options).length) lines.push("");
    for (const opt in this.params.options) {
      lines.push(`opt-${opt} ${this.params.options[opt]}`);
    }
    const header =
      `${this.language?.comments.single} Proproced through WGPreproc v0.0.1\n`;
    const footer =
      `\n${this.language?.comments.single} =============================`;
    return header +
      lines.map((line) =>
        line ? `${prefix}${line}` : this.language?.comments.single
      ).join("\n") + footer;
  }

  get rootProjectFile(): string {
    return `${this.rootProjectFolder}/${this.params.file}`;
  }

  get rootProjectFolder(): string {
    return `${this.config.project_dir}/${this.params.project}/`;
  }
}

export class InstanceParams {
  language: string = "lsl";
  project: string | null = null;
  file: string | null = "main.luau";
  hash: string | null = null;
  options: { [k: string]: string | boolean } = {};
}
