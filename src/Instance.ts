import Config from "./Config.ts";
import FileHandler from "./FileHandler.ts";
import { PreProcConfig } from "./PreProc/PreProc.ts";
import PreProcHandler from "./PreProcHandler.ts";
import Languages from "./Language.ts";
import { exists } from "jsr:@std/fs/exists";
import { encodeHex } from "jsr:@std/encoding/hex";

export default class Instance {
  private filename: string;
  private fileHandler: FileHandler;
  private closed: boolean = true;
  private params: InstanceParams;
  private preProcHandler: PreProcHandler | null = null;
  private langParams: PreProcConfig | null = null;
  private config: Config;
  private closeHandler: ((e: string) => void) | null;

  constructor(
    filename: string,
    config: Config,
    closeHandler: (e: string) => void,
  ) {
    this.filename = filename;
    this.fileHandler = new FileHandler(filename, () => this.close());
    this.params = new InstanceParams();
    this.config = config;
    this.closeHandler = closeHandler;
    console.log("New Instance", filename);
  }

  private async loadParams() {
    const text = await Deno.readTextFile(this.filename);
    const langIndex = text.indexOf("@language");
    if (langIndex > 0) {
      const nl = text.substring(langIndex).indexOf("\n");
      const lang = text.substring(langIndex + 10, langIndex + nl).trim();
      this.langParams = this.getLangParams(lang);
    } else {
      this.langParams = this.getLangParams();
    }
    const lines = text.split("\n");
    for (let line of lines) {
      line = line.trim();
      if (!line.startsWith(this.langParams.comments.single)) continue;
      line = line.substring(this.langParams.comments.single.length);
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
            this.langParams.options[cmd.substring(4)] = ar;
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

  async start() {
    try {
      await this.loadParams();
      if (this.langParams) {
        this.preProcHandler = new PreProcHandler(
          this.rootProjectFile,
          (content) => this.output(content),
          this.langParams,
        );
        await this.preProcHandler.run();
      } else throw "No Lang Params";
    } catch (e: any) {
      this.close(e);
    }
    this.close();
  }

  private getLangParams(fileExt: string | null = null): PreProcConfig {
    fileExt = fileExt ? fileExt : this.getFileExtension();
    this.params.language = fileExt;
    console.log(`Loading file with language '${fileExt}'`);
    let config = Languages[fileExt];
    while (typeof config == "string") {
      config = Languages[config];
    }
    if (typeof config == "object" && config != null) return config;
    throw `Unable to get language config for '${fileExt}'`;
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

  async output(content: string) {
    const buff = new TextEncoder().encode(content);
    const hashBuff = await crypto.subtle.digest("SHA-256", buff);
    const hash = encodeHex(hashBuff);
    if (this.params.hash == hash) return;
    console.log("Pushing Change");
    this.params.hash = hash;
    await this.fileHandler.write(
      this.header + "\n" + content +
        (content.charAt(content.length - 1) != "\n" ? "\n" : ""),
    );
  }

  get header(): string {
    const prefix = `${this.langParams?.comments.single} @`;
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
      `${this.langParams?.comments.single} Proproced through WGPreproc v0.0.1\n`;
    const footer =
      `\n${this.langParams?.comments.single} =============================`;
    return header +
      lines.map((line) =>
        line ? `${prefix}${line}` : this.langParams?.comments.single
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
  file: string | null = null;
  hash: string | null = null;
  options: { [k: string]: string | boolean } = {};
}
