import { dirname } from "jsr:@std/path";
import { exists } from "jsr:@std/fs/exists";
import { FileLineStream, Tokenstream } from "./Streams.ts";

export default class PreProc {
  private _state: PreProcStateInterface;
  private file: string;
  private output: string[] = [];
  private config: PreProcConfig;
  private fileDepth: number;
  private iter: FileLineStream;
  private ifDepth: number = 0;
  constructor(
    file: string,
    state: PreProcStateInterface,
    config: PreProcConfig,
    depth: number,
    iterator: FileLineStream,
  ) {
    this.file = file;
    this._state = state;
    this.config = config;
    this.fileDepth = depth;
    this.iter = iterator;
  }

  static async createFromFile(
    file: string,
    state: PreProcStateInterface,
    config: PreProcConfig,
    depth: number,
  ): Promise<PreProc> {
    return new PreProc(
      file,
      state,
      config,
      depth,
      await FileLineStream.createFromFile(file),
    );
  }

  async run(): Promise<string> {
    this.state.addFile(this.file);
    while (this.iter.peekValid()) {
      const line = this.iter.next() as string;
      const res = await this.process(line);
      if (res !== false) {
        const filled = this.replaceDefines(res);
        const lines = filled.split("\n");
        this.output.push(lines.shift() as string);
        if (lines.length) {
          this.iter.push(lines);
        }
      }
    }

    this.clean();

    return this.output.join("\n").trim();
  }

  private clean(): void {
    if (this.cleanComments) {
      this.output = this.output.filter((line) =>
        !line.trimStart().startsWith(this.single)
      );
    }

    if (this.collapseEmpty) {
      this.output = this.output.filter((line, i) =>
        i < 1 || line != "" || line != this.output[i - 1]
      );
    }
  }

  get state(): PreProcStateInterface {
    return this._state;
  }

  private replaceDefines(line: string): string {
    const stream = new Tokenstream(line, this.config);

    const out: string[] = [];

    let next = stream.next();

    let commented = false;

    while (next) {
      const def = commented ? null : this.readState(next);
      if (def) {
        if (typeof def == "string") next = def;
        else {
          const args = [];
          let depth = 1;
          let arg = "";
          next = stream.next();
          if (next != "(") {
            this.error("Defined function call not followed by '(");
          }
          next = stream.next();
          while (next) {
            if (next == "(") {
              depth++;
            } else if (next == ")") {
              depth--;
              if (depth == 0) {
                if (arg) args.push(arg);
                break;
              }
            }
            if (depth == 1 && next == ",") {
              args.push(arg);
              arg = "";
            } else {
              arg += next;
            }
            next = stream.next();
          }
          next = def(args);
        }
      }
      if (next) {
        if (next == this.config.comments.single) commented = true;
        out.push(next);
      }
      next = stream.next();
    }

    return out.join("");
  }

  private get verbose(): boolean {
    return !!(this.config.options["verbose"] ?? false);
  }

  private get collapseEmpty(): boolean {
    return !!(this.config.options["collapse-empty-lines"] ?? false);
  }

  private get cleanComments(): boolean {
    return !!(this.config.options["clean-comments"] ?? false);
  }

  private readLineEndsWithEscape(line: string): string {
    line = line.trimEnd();
    if (line.charAt(line.length - 1) == "\\") {
      while (this.iter.peekValid()) {
        let nLine = this.iter.next() as string;
        line = line.substring(0, line.length - 1).trimEnd();
        if (this.config.leadCharCommented) {
          nLine = nLine.trimStart();
          if (!nLine.startsWith(this.single)) {
            throw `Trying to read multiline def without preceeding '${this.single}'`;
          }
          nLine = nLine.substring(2);
        }
        line += "\n" + nLine.trimEnd();
        if (line.charAt(line.length - 1) != "\\") {
          break;
        }
      }
    }
    return line;
  }

  private async process(line: string): Promise<string | false> {
    const res = this.getLineCmd(line);
    if (res === false) return line;
    const [cmd, arg] = res;
    switch (cmd) {
      case "define": {
        let sp = arg.indexOf(" ");
        if (sp < 0) sp = arg.length;
        const def = arg.substring(0, sp).trim();
        if (!def.match(/^[0-9A-z]+$/)) {
          if (!this.defFunction(def, arg.substring(sp).trim())) {
            this.error(`Define with non alpha numberic value: ${def}`);
          }
        } else {
          this.state.store(
            def,
            arg.substring(sp).trim(),
          );
        }
        break;
      }
      case "ifdef": {
        if (this.readState(arg) === null) {
          this.readLinesTillOutOfIf();
        } else this.ifDepth++;
        break;
      }
      case "ifndef": {
        if (this.readState(arg) !== null) {
          this.readLinesTillOutOfIf();
        } else this.ifDepth++;
        break;
      }
      case "includeonce":
      case "include": {
        const file = dirname(this.file) + "/" + this.cleanIncludeArd(arg);
        if (cmd == "includeonce") {
          if (this.state.files.includes(file)) {
            return this.verbose
              ? `${this.single} <${cmd} file="${file}" skipped/>`
              : false;
          }
        }
        const preproc = await PreProc.createFromFile(
          file,
          this.state,
          this.config,
          this.fileDepth + 1,
        );
        const str = await preproc.run();
        if (str) {
          this.output.push(
            this.verbose
              ? this.single + `<${cmd} file="${file}">\n${str}`
              : str,
          );
          return this.verbose ? `${this.single} </${cmd}>` : false;
        } else {
          return this.verbose
            ? `${this.single} <${cmd} file="${file}"/>`
            : false;
        }
      }
      case "else":
      case "elseif": {
        this.error(`Unmatched #${cmd}`);
        break;
      }
      case "endif": {
        if (this.ifDepth) this.ifDepth--;
        else this.error("Unmatched endif");
        break;
      }
      default: {
        console.log(`CMD: |${cmd}| = |${arg}|`);
        break;
      }
    }
    return false;
  }

  private cleanIncludeArd(inc: string): string {
    const frst = inc.charAt(0);
    const str = this.config.string.find((lang) => lang.char == frst);
    if (str) {
      let end = inc.length;
      if (inc.charAt(inc.length - 1) == str.char) {
        end -= 1;
      }
      inc = inc.substring(1, end);
    }
    return inc;
  }

  private readState(va: string): string | DefFunc | null {
    switch (va) {
      case "__FILE__":
        return `"${this.file}"`;
      case "__LINE__":
        return this.iter.trueLine.toString();
      case "__SHORT_FILE__":
        return `"${this.file.split("/").pop()}"`;
      case "__INCLUDE_LEVEL__":
        return (this.fileDepth - 1).toString();
      default:
        return this.state.read(va);
    }
  }

  private defFunction(func: string, body: string): boolean {
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

    this.state.store(name, (vals: string[]) => {
      if (vals.length != args.length) {
        throw `Invalid arg count for define func '${name}' expected ${args.length} got ${vals.length}`;
      }
      const pairs: { [k: string]: string } = {};
      for (const index in args) {
        pairs[args[index]] = vals[index];
      }
      return tokes.map((toke) => pairs[toke] ?? toke).join("");
    });

    return true;
  }

  private error(err: string) {
    //console.trace();
    throw `PreProc Error: ${this.file} [${this.iter.line + 1}]: ${err}`;
  }

  private getLineCmd(line: string): [string, string] | false {
    if (line.indexOf(this.lead) !== 0) return false;
    line = line.substring(this.lead.length);
    let idx = line.indexOf(" ");
    if (idx < 0) idx = line.length;
    return [
      line.substring(0, idx),
      this.readLineEndsWithEscape(line.substring(idx).trim()),
    ];
  }

  private get lead(): string {
    if (this.config.leadCharCommented) {
      return `${this.config.comments.single}${this.config.leadChar}`;
    } else {
      return this.config.leadChar;
    }
  }

  private readLinesTillOutOfIf() {
    const start = this.iter.line;
    let depth = 1;

    out: {
      while (this.iter.peekValid()) {
        const line = this.iter.next() as string;
        // console.log("Skipping", this.iter.line + 1, line);
        const res = this.getLineCmd(line);
        if (!res) continue;
        const [cmd, _arg] = res;
        switch (cmd) {
          case "if":
          case "ifdef":
          case "ifndef":
            depth++;
            break;
          case "else":
            if (depth == 0) break out;
            break;
          case "endif":
            depth--;
            if (depth == 0) {
              this.ifDepth--;
              break out;
            }
            break;
        }
      }
    }
    if (depth > 0) {
      this.error(`Hit end of file while in #if from [${start}]`);
    }
    // console.log("Exiting Skip");
  }

  private get single(): string {
    return this.config.comments.single;
  }
  private get char(): string {
    return this.config.leadChar;
  }
}

type IfStack = [boolean, number];

export interface PreProcStateInterface {
  store: (name: string, value: string | DefFunc) => void;
  read: (name: string) => string | DefFunc | null;
  defines: string[];
  addFile: (path: string) => void;
  files: string[];
}

export type DefFunc = (args: string[]) => string;

export type LangStringDef = {
  char: string;
  escape: string;
  interpolate?: {
    start: string;
    end: string;
  };
};

export type LangStringDefs = LangStringDef[];

export type PreProcConfig = {
  comments: {
    single: string;
    multi: {
      open: string;
      close: string;
    } | false;
  };
  string: LangStringDefs;
  leadChar: string;
  leadCharCommented: boolean;
  validSymbol: RegExp;
  options: { [k: string]: string | boolean };
};
