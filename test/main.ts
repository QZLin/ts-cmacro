import func1 from "./lib1";
import { ensureArray as ensure } from "./lib2";

function main(config: any, profileName?: string) {
  const old = ensure(config.rules as string[]);
  config.rules = func1(old);
  return config;
}

export default main;