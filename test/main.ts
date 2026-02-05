// 综合测试
import func1 from "./lib1";
import { ensureArray as ensure } from "./lib2";

function main(v1: any, v2?: string) {
  const old = ensure(v1.var1 as string[]);
  v1.var1 = func1(old);
  console.log(v2);
  return v1;
}

export default main;