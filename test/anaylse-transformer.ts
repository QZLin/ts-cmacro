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

console.log("=== Testing Transformer Method ===\n");

const transformerFactory: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
        if (ts.canHaveModifiers(node)) {
            const modifiers = ts.getModifiers(node);
            if (modifiers && modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                console.log(`Found export in: ${node.getText(sourceFile).substring(0, 30)}...`);
                // 过滤掉export修饰符
                const filteredModifiers = modifiers.filter(m => m.kind !== ts.SyntaxKind.ExportKeyword);
                console.log(`Filtered modifiers: ${filteredModifiers.map(m => ts.SyntaxKind[m.kind]).join(', ') || 'none'}`);

                // 根据节点类型创建新的节点
                if (ts.isVariableStatement(node)) {
                    const newNode = ts.factory.updateVariableStatement(node, filteredModifiers, node.declarationList);
                    console.log(`Result: ${newNode.getText(sourceFile).substring(0, 30)}...`);
                    return newNode;
                } else if (ts.isFunctionDeclaration(node)) {
                    const newNode = ts.factory.updateFunctionDeclaration(node, filteredModifiers,
                        node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, node.body);
                    console.log(`Result: ${newNode.getText(sourceFile).substring(0, 30)}...`);
                    return newNode;
                } else if (ts.isClassDeclaration(node)) {
                    const newNode = ts.factory.updateClassDeclaration(node, filteredModifiers,
                        node.name, node.typeParameters, node.heritageClauses, node.members);
                    console.log(`Result: ${newNode.getText(sourceFile).substring(0, 30)}...`);
                    return newNode;
                }
            }
        }
        return ts.visitEachChild(node, visit, context);
    };
    return (node) => ts.visitNode(node, visit) as ts.SourceFile;
};

const result = ts.transform(sourceFile, [transformerFactory]);
const transformedSourceFile = result.transformed[0] as ts.SourceFile;

console.log("\n=== Transformed Source File ===");
console.log(transformedSourceFile.getText());