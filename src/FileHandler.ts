export default class FileHandler {
  private filename: string;
  private closed: boolean = false;
  private handle: (() => void) | null = null;

  constructor(filename: string, handle: () => void) {
    this.filename = filename;
    this.handle = handle;
    this.start();
  }

  public async write(content: string) {
    return await Deno.writeTextFile(this.filename, content, { create: false });
  }

  private async start() {
    const watcher = Deno.watchFs(this.filename);
    for await (const event of watcher) {
      if (event.kind == "remove") break;
    }
    try {
      watcher.close();
    } catch (_e: any) {
    }
    if (this.handle) this.handle();
  }
}
