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

console.log("=== Testing AST Processing ===\n");

function processStatementWithAST(stmt: ts.Statement, sourceFile: ts.SourceFile): string {
    // 处理ExportDeclaration（export { ... } 或 export * from ...）
    if (ts.isExportDeclaration(stmt)) {
        console.log(`Processing ExportDeclaration: ${stmt.getText(sourceFile).substring(0, 30)}...`);
        // 对于命名导出声明，如果有exportClause，则转换为对应的声明
        if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
            // 创建变量声明语句
            const declarations = stmt.exportClause.elements.map(element => {
                return ts.factory.createVariableDeclaration(
                    ts.factory.createIdentifier(element.name.text),
                    undefined,
                    undefined,
                    element.propertyName ? ts.factory.createIdentifier(element.propertyName.text) : undefined
                );
            });

            const variableStatement = ts.factory.createVariableStatement(
                undefined,
                ts.factory.createVariableDeclarationList(declarations, ts.NodeFlags.Const)
            );

            const result = variableStatement.getText(sourceFile);
            console.log(`Result: ${result.substring(0, 30)}...`);
            return result;
        }
        // 对于export * from ...，直接跳过
        console.log(`Result: (skipped)`);
        return '';
    }

    // 处理ExportAssignment（export default）
    if (ts.isExportAssignment(stmt)) {
        console.log(`Processing ExportAssignment: ${stmt.getText(sourceFile).substring(0, 30)}...`);
        // 对于export default，返回表达式本身
        const result = stmt.expression.getText(sourceFile);
        console.log(`Result: ${result.substring(0, 30)}...`);
        return result;
    }

    // 处理有修饰符的声明（变量、函数、类等）
    // 使用更准确的AST检查方法
    if (ts.canHaveModifiers(stmt)) {
        const modifiers = ts.getModifiers(stmt);
        console.log(`Checking modifiers for: ${stmt.getText(sourceFile).substring(0, 30)}...`);
        console.log(`Can have modifiers: true`);
        console.log(`Modifiers: ${modifiers ? modifiers.map(m => ts.SyntaxKind[m.kind]).join(', ') : 'none'}`);
        
        if (modifiers && modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            console.log(`Found ExportKeyword, processing...`);
            // 过滤掉export修饰符
            const filteredModifiers = modifiers.filter(m => m.kind !== ts.SyntaxKind.ExportKeyword);
            console.log(`Filtered modifiers: ${filteredModifiers.map(m => ts.SyntaxKind[m.kind]).join(', ') || 'none'}`);

            // 根据语句类型创建新的语句
            if (ts.isVariableStatement(stmt)) {
                const newStmt = ts.factory.updateVariableStatement(stmt, filteredModifiers, stmt.declarationList);
                const result = newStmt.getText(sourceFile);
                console.log(`Result (VariableStatement): ${result.substring(0, 30)}...`);
                return result;
            } else if (ts.isFunctionDeclaration(stmt)) {
                const newStmt = ts.factory.updateFunctionDeclaration(stmt, filteredModifiers,
                    stmt.asteriskToken, stmt.name, stmt.typeParameters, stmt.parameters, stmt.type, stmt.body);
                const result = newStmt.getText(sourceFile);
                console.log(`Result (FunctionDeclaration): ${result.substring(0, 30)}...`);
                return result;
            } else if (ts.isClassDeclaration(stmt)) {
                const newStmt = ts.factory.updateClassDeclaration(stmt, filteredModifiers,
                    stmt.name, stmt.typeParameters, stmt.heritageClauses, stmt.members);
                const result = newStmt.getText(sourceFile);
                console.log(`Result (ClassDeclaration): ${result.substring(0, 30)}...`);
                return result;
            }
        }
    }

    // 对于没有export修饰符的语句，直接返回原文本
    console.log(`No export modifiers, returning original: ${stmt.getText(sourceFile).substring(0, 30)}...`);
    return stmt.getText(sourceFile);
}

sourceFile.statements.forEach((stmt, index) => {
    console.log(`\n--- Statement ${index} ---`);
    const result = processStatementWithAST(stmt, sourceFile);
    console.log(`Final result: ${result}`);
});