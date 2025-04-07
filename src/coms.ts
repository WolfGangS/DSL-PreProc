export enum ComCommand {
  NEW = "NEW",
  PING = "PING",
}

export class ComHandler {
  private port: number;
  private cb: (args: string[]) => Promise<void>;
  private listener: Deno.Listener | null = null;
  private static instance: ComHandler;

  private constructor(port: number, cb: (args: string[]) => Promise<void>) {
    this.port = port;
    this.cb = cb;
  }

  public static setup(
    port: number,
    cb: (args: string[]) => Promise<void>,
  ): ComHandler {
    if (this.instance) {
      throw "Cannot setup ComHandler Twice";
    }
    this.instance = new this(port, cb);
    return this.instance;
  }

  public static get(): ComHandler {
    return this.instance;
  }

  close(): void {
    this.listener?.close();
  }

  async connect(cmd: ComCommand, args: string[] = []): Promise<boolean> {
    try {
      const con = await Deno.connect({ port: this.port });
      const msg = JSON.stringify({
        ver: "1",
        req: cmd,
        args: args,
      });
      con.write((new TextEncoder()).encode(msg));

      let b = new Uint8Array(100);
      const l = (await con.read(b)) || 0;
      b = b.slice(0, l);
      const d = new TextDecoder();
      const rsp = d.decode(b);
      con.close();
      const json = JSON.parse(rsp);
      if (json.status === "ok") {
        console.log("Task handed to host.");
        return true;
      } else {
        console.error(rsp);
      }
    } catch (e) {
      if (!(e instanceof Deno.errors.ConnectionRefused)) {
        console.error("\nConnection Error...\n", e);
      }
    }
    return false;
  }

  async listen() {
    this.listener = Deno.listen({ port: this.port });
    console.log("Listenting for connections");
    for await (const conn of this.listener) {
      let b = new Uint8Array(1000);
      const n = (await conn.read(b)) || 0;
      const d = new TextDecoder();
      b = b.slice(0, n);
      const msg = d.decode(b);
      let success: false | string = false;
      let error = "";
      try {
        const data = JSON.parse(msg);
        if (
          typeof data === "object" && data !== null && !(data instanceof Array)
        ) {
          switch (data.req) {
            case ComCommand.PING:
              success = "pong";
              break;
            case ComCommand.NEW:
              if (data.args instanceof Array && data.args.length > 0) {
                try {
                  await this.cb(data.args);
                  success = "started";
                } catch (e) {
                  error = "failed to start\n" + String(e);
                }
              } else {
                error = "args not array or empty";
              }
              break;
            default:
              error = "unknown request";
              break;
          }
        }
      } catch (e) {
        console.log(e);
      } finally {
        if (success === false) {
          conn.write((new TextEncoder()).encode(
            JSON.stringify({
              "status": "fail",
              "error": error,
            }),
          ));
        } else {
          conn.write((new TextEncoder()).encode(
            JSON.stringify({
              "status": "ok",
              "msg": success,
            }),
          ));
        }
        conn.close();
      }
    }
  }
}
