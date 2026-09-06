import dotenv from "dotenv";
import { resolve } from "node:path";
/** Root is explicit so dev and compiled startup read the same file. */
export function loadEnv(root: string) {
  dotenv.config({ path: resolve(root, ".env"), quiet: true });
}
