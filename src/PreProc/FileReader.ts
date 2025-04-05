export class FileReader {
  private static cache: { [k: string]: string } = {};

  public static read(path: string): Promise<string> {
    if (path.startsWith("@")) {
      const colon = path.indexOf(":");
      const pre = path.substring(1, colon);
      path = path.substring(colon + 1);
      throw JSON.stringify([pre, path]);
    } else {
      return Deno.readTextFile(path);
    }
  }
}
