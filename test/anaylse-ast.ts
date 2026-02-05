import ts from "typescript";

const testCode = `
export const testConst = "test";
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
const regularConst = "regular";
function regularFunction() {
    return "regular";
}
`;

const sourceFile = ts.createSourceFile(
    "test.ts",
    testCode,
    ts.ScriptTarget.Latest,
    true
);

console.log("=== AST Node Analysis ===\n");

sourceFile.statements.forEach((stmt, index) => {
    console.log(`Statement ${index}:`);
    console.log(`  Kind: ${ts.SyntaxKind[stmt.kind]}`);
    console.log(`  Text: ${stmt.getText(sourceFile).substring(0, 50)}...`);
    
    // 检查修饰符
    if (ts.canHaveModifiers(stmt)) {
        const modifiers = ts.getModifiers(stmt);
        console.log(`  Can have modifiers: true`);
        console.log(`  Modifiers: ${modifiers ? modifiers.map(m => ts.SyntaxKind[m.kind]).join(', ') : 'none'}`);
    } else {
        console.log(`  Can have modifiers: false`);
    }
    
    // 检查特定类型
    if (ts.isExportDeclaration(stmt)) {
        console.log(`  Is ExportDeclaration: true`);
    } else if (ts.isExportAssignment(stmt)) {
        console.log(`  Is ExportAssignment: true`);
    } else if (ts.isVariableStatement(stmt)) {
        console.log(`  Is VariableStatement: true`);
    } else if (ts.isFunctionDeclaration(stmt)) {
        console.log(`  Is FunctionDeclaration: true`);
    } else if (ts.isClassDeclaration(stmt)) {
        console.log(`  Is ClassDeclaration: true`);
    }
    
    console.log('');
});