import path from "path";
import ts from "typescript";


export interface BuildOptions {
    entry: string;
    tsconfig?: string;
    compact?: boolean;
}

/**
 * 使用AST方法处理语句，移除export相关关键字
 */
function processStatementWithAST(stmt: ts.Statement, sourceFile: ts.SourceFile): string {
    // 创建printer用于生成代码
    const printer = ts.createPrinter();

    // 处理ExportDeclaration（export { ... } 或 export * from ...）
    if (ts.isExportDeclaration(stmt)) {
        // 对于命名导出声明，如果有exportClause，则转换为对应的声明
        if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
            // 只处理有alias的export（即有propertyName的）
            const elementsWithAlias = stmt.exportClause.elements.filter(element => element.propertyName);

            if (elementsWithAlias.length === 0) {
                // 没有alias，直接丢弃
                return '';
            }

            // 创建变量声明语句
            const declarations = elementsWithAlias.map(element => {
                return ts.factory.createVariableDeclaration(
                    ts.factory.createIdentifier(element.name.text),
                    undefined,
                    undefined,
                    ts.factory.createIdentifier(element.propertyName!.text)
                );
            });

            const variableStatement = ts.factory.createVariableStatement(
                undefined,
                ts.factory.createVariableDeclarationList(declarations, ts.NodeFlags.Const)
            );

            return printer.printNode(ts.EmitHint.Unspecified, variableStatement, sourceFile);
        }
        // 对于export * from ...，直接跳过
        return '';
    }

    // 处理ExportAssignment（export default）
    if (ts.isExportAssignment(stmt)) {
        // 对于export default identifier，直接跳过（因为标识符已经在前面声明）
        if (ts.isIdentifier(stmt.expression)) {
            return '';
        }
        // 对于其他export default表达式，返回表达式本身
        return stmt.expression.getText(sourceFile);
    }

    // 处理有修饰符的声明（变量、函数、类等）
    // 使用transformer来正确移除export修饰符
    const transformerFactory: ts.TransformerFactory<ts.SourceFile> = (context) => {
        const visit: ts.Visitor = (node) => {
            if (ts.canHaveModifiers(node)) {
                const modifiers = ts.getModifiers(node);
                if (modifiers && modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                    // 过滤掉export修饰符，同时也要移除default修饰符（对于export default）
                    const filteredModifiers = modifiers.filter(m =>
                        m.kind !== ts.SyntaxKind.ExportKeyword && m.kind !== ts.SyntaxKind.DefaultKeyword
                    );

                    // 根据节点类型创建新的节点
                    if (ts.isVariableStatement(node)) {
                        const newNode = ts.factory.updateVariableStatement(node, filteredModifiers, node.declarationList);
                        return newNode;
                    } else if (ts.isFunctionDeclaration(node)) {
                        const newNode = ts.factory.updateFunctionDeclaration(node, filteredModifiers,
                            node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, node.body);
                        return newNode;
                    } else if (ts.isClassDeclaration(node)) {
                        const newNode = ts.factory.updateClassDeclaration(node, filteredModifiers,
                            node.name, node.typeParameters, node.heritageClauses, node.members);
                        return newNode;
                    } else if (ts.isInterfaceDeclaration(node)) {
                        const newNode = ts.factory.updateInterfaceDeclaration(node, filteredModifiers,
                            node.name, node.typeParameters, node.heritageClauses, node.members);
                        return newNode;
                    } else if (ts.isEnumDeclaration(node)) {
                        const newNode = ts.factory.updateEnumDeclaration(node, filteredModifiers,
                            node.name, node.members);
                        return newNode;
                    }
                }
            }
            return ts.visitEachChild(node, visit, context);
        };
        return (node) => ts.visitNode(node, visit) as ts.SourceFile;
    };

    // 应用transformer到整个源文件
    const result = ts.transform(sourceFile, [transformerFactory]);
    const transformedSourceFile = result.transformed[0] as ts.SourceFile;

    // 找到对应的语句并返回其文本
    const transformedStmt = transformedSourceFile.statements.find(s =>
        s.pos === stmt.pos && s.end === stmt.end
    );

    if (transformedStmt) {
        return printer.printNode(ts.EmitHint.Unspecified, transformedStmt, sourceFile);
    }

    // 如果找不到对应的语句，返回原文本
    return stmt.getText(sourceFile);
}


export function build(options: BuildOptions): string {
    const entry = path.resolve(options.entry);


    const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2018,
        module: ts.ModuleKind.ESNext,
        strict: true,
        noEmitOnError: true,
    };


    const host = ts.createCompilerHost(compilerOptions);
    const program = ts.createProgram([entry], compilerOptions, host);


    const diagnostics = ts.getPreEmitDiagnostics(program).filter(diag => {
        if (diag.file) {
            return !diag.file.fileName.includes('node_modules');
        }
        return true;
    });
    if (diagnostics.length) {
        const msg = ts.formatDiagnosticsWithColorAndContext(diagnostics, host);
        throw new Error(msg);
    }


    const checker = program.getTypeChecker();
    const visited = new Set<string>();
    const output: string[] = [];

    function visit(file: ts.SourceFile) {
        if (visited.has(file.fileName)) return;
        visited.add(file.fileName);

        for (const stmt of file.statements) {
            if (ts.isImportDeclaration(stmt)) {
                // 检查import改写的前提条件
                if (!stmt.importClause) {
                    continue;
                }

                // 检查是否是TypeOnlyImport
                if (stmt.importClause.isTypeOnly) {
                    const { line, character } = ts.getLineAndCharacterOfPosition(file, stmt.getStart(file));
                    const location = `${file.fileName}:${line + 1}:${character + 1}`;
                    throw new Error(`${location} - type imports are not supported in ts-cmacro scripts`);
                }

                // 检查是否是namespace import
                if (stmt.importClause.namedBindings && ts.isNamespaceImport(stmt.importClause.namedBindings)) {
                    const { line, character } = ts.getLineAndCharacterOfPosition(file, stmt.getStart(file));
                    const location = `${file.fileName}:${line + 1}:${character + 1}`;
                    throw new Error(`${location} - namespace imports are not supported in ts-cmacro scripts`);
                }
                const spec = stmt.moduleSpecifier as ts.StringLiteral;
                const resolved = ts.resolveModuleName(
                    spec.text,
                    file.fileName,
                    compilerOptions,
                    host
                ).resolvedModule;

                if (!resolved) throw new Error(`Cannot resolve ${spec.text}`);
                const dep = program.getSourceFile(resolved.resolvedFileName);
                if (!dep) throw new Error(`Missing source ${resolved.resolvedFileName}`);

                // 检查是否有alias（即有propertyName）
                let hasAlias = false;
                if (stmt.importClause && stmt.importClause.namedBindings) {
                    const namedBindings = stmt.importClause.namedBindings;
                    if (ts.isNamedImports(namedBindings)) {
                        hasAlias = namedBindings.elements.some(element => element.propertyName);
                    }
                }

                visit(dep);

                // 如果有alias，添加const声明来创建alias
                if (hasAlias && stmt.importClause && stmt.importClause.namedBindings) {
                    const namedBindings = stmt.importClause.namedBindings;
                    if (ts.isNamedImports(namedBindings)) {
                        const aliasDeclarations = namedBindings.elements
                            .filter(element => element.propertyName)
                            .map(element => {
                                return `const ${element.name.text} = ${element.propertyName!.text};`;
                            });

                        output.push(...aliasDeclarations);
                    }
                }

                continue;
            }

            // 使用AST方法处理所有语句，移除export修饰符
            const processedText = processStatementWithAST(stmt, file);

            // 如果处理后的文本不为空，则添加到输出
            if (processedText.trim()) {
                output.push(processedText);
            }
        }
    }


    const entryFile = program.getSourceFile(entry);
    if (!entryFile) throw new Error("Entry file not found");


    visit(entryFile);

    // 使用AST处理后，所有export关键字已被移除，直接拼接输出
    let finalOutput = output.join("\n\n");

    // Apply compact formatting if requested
    if (options.compact) {
        // Remove multiple consecutive empty lines
        finalOutput = finalOutput.replace(/\n{3,}/g, '\n\n');
        // Remove trailing whitespace from each line
        finalOutput = finalOutput.replace(/\s+$/gm, '');
        // Ensure only one space after statements
        finalOutput = finalOutput.replace(/\n\s+\n/g, '\n\n');
    }

    return finalOutput;
}