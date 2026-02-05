// Test file with various export statements

export const testConst = "test";

export interface TestInterface {
}

export enum TestEnum {
}

export function testFunction() {
    return "test";
}

export class TestClass {
    method() {
        return "test";
    }
}

export default function defaultFunction() {
    return "default";
}

function test_export_func1() { }

// Non-export statement
const regularConst = "regular";

function regularFunction() {
    return "regular";
}

// Export with alias (should be converted to const)
export { TestClass as TestClass1, test_export_func1 };