import { FileReader } from "./FileReader.ts";
import { LangStringDef, LanguageConfig } from "./PreProc.ts";

export class FileLineStream {
  private loaded: boolean = false;
  private lines: string[];
  private _line = -1;
  private added: number = 0;
  private constructor(text: string) {
    this.lines = text.split("\n");
  }

  static createFromString(txt: string): FileLineStream {
    return new FileLineStream(txt);
  }

  static async createFromFile(file: string): Promise<FileLineStream> {
    return FileLineStream.createFromString(await FileReader.read(file));
  }

  peekValid(n: number = 1): boolean {
    return this.peek(n) !== false;
  }

  peek(n: number = 1): string | false {
    return this.lines[this.line + n] ?? false;
  }

  next(): string | false {
    this._line++;
    return this.lines[this.line] ?? false;
  }

  push(lines: string[]): void {
    this.lines.splice(this.line + 1, 0, ...lines);
    this.added += lines.length;
  }

  get trueLine(): number {
    return this._line - this.added;
  }

  get line(): number {
    return this._line + 0;
  }

  private set line(line: number) {
    this._line = line;
  }

  getLines(): string[] {
    return [...this.lines];
  }
}

export class Tokenstream {
  private stream: CharStream;
  private marked: number = 0;
  private config: LanguageConfig;

  private cache: string[] = [];

  constructor(text: string, config: LanguageConfig) {
    this.stream = new CharStream(text);
    this.config = config;
  }

  peek(n: number = 1): string | false {
    this.mark();
    let toke: string | false = false;
    const cache = [...this.cache];
    while (n--) {
      toke = this.next();
    }
    this.recall();
    this.cache = cache;
    return toke;
  }

  next(): string | false {
    if (this.cache.length) {
      return this.cache.shift() as string;
    }
    let toke = this.stream.next();
    if (toke === false) return toke;

    const str = this.isStringStart(toke);
    if (str) {
      return this.readString(toke, str);
    }

    let next = this.stream.peek();

    while (
      next &&
      ((toke + next).match(this.config.validSymbol) ||
        (toke + next) == this.config.comments.single)
    ) {
      toke += this.stream.next();
      next = this.stream.peek();
    }
    return toke;
  }

  private isStringStart(char: string): LangStringDef | false {
    for (const str of this.config.string) {
      if (char == str.char) return str;
    }
    return false;
  }

  private readString(str: string, def: LangStringDef): string {
    let inside = true;
    const strs: string[] = [];
    let next = this.stream.peek();
    let escape = false;
    while (inside && next) {
      if (escape) {
        str += this.stream.next();
        escape = false;
      } else {
        if (next == def.escape) escape = true;
        else if (next == def.char) inside = false;
        str += this.stream.next();
      }
      next = this.stream.peek();
    }
    strs.push(str);
    this.cache = strs;
    return this.cache.shift() as string;
  }

  rewind() {
    this.stream.rewind();
  }

  private mark() {
    this.marked = this.stream.pos;
  }

  private recall() {
    this.stream.rewind(this.marked);
  }
}

class CharStream {
  private text: string;
  private _pos: number = -1;
  constructor(text: string) {
    this.text = text;
  }

  peek(n: number = 1): string | false {
    return this.valid(n) ? this.text.charAt(this.pos + n) : false;
  }

  next(): string | false {
    this.pos++;
    return this.valid() ? this.text.charAt(this.pos) : false;
  }

  rewind(pos: number = -1) {
    this.pos = pos;
  }

  valid(n: number = 0): boolean {
    return this.text.length > (this.pos + n);
  }

  get pos(): number {
    return this._pos;
  }

  private set pos(n: number) {
    this._pos = n;
  }
}
