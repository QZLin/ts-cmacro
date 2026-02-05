// 测试export的各种情况

// 1. 没有alias的export
export const testConst = "test";

export function testFunction() {
    return "test";
}

export class TestClass {
    method() {
        return "test";
    }
}

// 2. 有alias的export
export { TestClass as TestClass1, testFunction as testFunction1 };

// 3. export default
export default function defaultFunction() {
    return "default";
}

// 4. 非export语句
const regularConst = "regular";

function regularFunction() {
    return "regular";
}