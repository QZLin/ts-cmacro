import path from "path";
import ts, { SyntaxKind } from "typescript";

export interface BuildOptions {
    entry: string;
    tsconfig?: string;
    compact?: boolean;
}

class BundleContext {
    private printer = ts.createPrinter({ removeComments: false });
    private visitedFiles = new Set<string>();
    private output: string[] = [];

    constructor(
        private program: ts.Program,
        private compilerOptions: ts.CompilerOptions,
        private host: ts.CompilerHost
    ) { }

    /**
     * 主入口：递归访问文件
     */
    public visit(file: ts.SourceFile) {
        if (this.visitedFiles.has(file.fileName)) return;
        this.visitedFiles.add(file.fileName);

        for (const stmt of file.statements) {
            if (ts.isImportDeclaration(stmt)) {
                this.handleImport(stmt, file);
            } else {
                this.handleStatement(stmt, file);
            }
        }
    }

    // --- 导入处理模块 ---

    private handleImport(stmt: ts.ImportDeclaration, file: ts.SourceFile) {
        const importClause = stmt.importClause;
        if (!importClause) return;

        // 1. 静态检查
        this.validateImportClause(importClause, file, stmt);

        // 2. 解析并递归子文件
        const depFile = this.resolveDependency(stmt, file);
        if (depFile) {
            this.visit(depFile);
        }

        // 3. 处理导入别名 (import { a as b })
        this.processImportAliases(importClause);
    }

    private validateImportClause(clause: ts.ImportClause, file: ts.SourceFile, node: ts.Node) {
        if (clause.phaseModifier === SyntaxKind.TypeKeyword || clause.phaseModifier == SyntaxKind.DeferKeyword)
            throw this.error(file, node, "type imports are not supported");
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
            throw this.error(file, node, "namespace imports are not supported");
        }
    }

    private resolveDependency(stmt: ts.ImportDeclaration, file: ts.SourceFile): ts.SourceFile | undefined {
        const spec = (stmt.moduleSpecifier as ts.StringLiteral).text;
        const resolved = ts.resolveModuleName(spec, file.fileName, this.compilerOptions, this.host).resolvedModule;

        if (!resolved) throw new Error(`Cannot resolve ${spec} from ${file.fileName}`);
        const depFile = this.program.getSourceFile(resolved.resolvedFileName);
        if (!depFile) throw new Error(`Missing source file: ${resolved.resolvedFileName}`);

        return depFile;
    }

    private processImportAliases(clause: ts.ImportClause) {
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const el of clause.namedBindings.elements) {
                if (el.propertyName) {
                    // 别名转换: import { origin as alias } -> const alias = origin;
                    this.output.push(`const ${el.name.text} = ${el.propertyName.text};`);
                }
            }
        }
    }

    // --- 语句转换模块 ---

    private handleStatement(stmt: ts.Statement, file: ts.SourceFile) {
        let transformedText = "";

        if (ts.isExportDeclaration(stmt)) {
            transformedText = this.transformExportDeclaration(stmt, file);
        } else if (ts.isExportAssignment(stmt)) {
            transformedText = this.transformExportAssignment(stmt, file);
        } else {
            transformedText = this.transformGeneralStatement(stmt, file);
        }

        if (transformedText.trim()) {
            this.output.push(transformedText);
        }
    }

    /**
     * 处理 export { a as b }
     */
    private transformExportDeclaration(stmt: ts.ExportDeclaration, file: ts.SourceFile): string {
        if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
            return stmt.exportClause.elements
                .filter(el => el.propertyName)
                .map(el => `const ${el.name.text} = ${el.propertyName!.text};`)
                .join('\n');
        }
        return '';
    }

    /**
     * 处理 export default foo
     */
    private transformExportAssignment(stmt: ts.ExportAssignment, file: ts.SourceFile): string {
        // 如果是标识符则忽略，如果是表达式则转为普通语句
        if (ts.isIdentifier(stmt.expression)) return '';
        return this.printer.printNode(ts.EmitHint.Expression, stmt.expression, file) + ';';
    }

    /**
     * 处理普通声明，移除 export 关键字
     */
    private transformGeneralStatement(stmt: ts.Statement, file: ts.SourceFile): string {
        if (!ts.canHaveModifiers(stmt)) {
            return this.printer.printNode(ts.EmitHint.Unspecified, stmt, file);
        }

        const modifiers = ts.getModifiers(stmt);
        const hasExport = modifiers?.some(m =>
            m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DefaultKeyword
        );

        if (!hasExport) {
            return this.printer.printNode(ts.EmitHint.Unspecified, stmt, file);
        }

        // 移除关键字并克隆节点
        const filteredModifiers = modifiers?.filter(m =>
            m.kind !== ts.SyntaxKind.ExportKeyword && m.kind !== ts.SyntaxKind.DefaultKeyword
        );

        const newNode = this.stripExportFromNode(stmt, filteredModifiers);
        return this.printer.printNode(ts.EmitHint.Unspecified, newNode, file);
    }

    /**
     * 具体的节点修饰符剥离逻辑
     */
    private stripExportFromNode(node: ts.Node, modifiers: ts.Modifier[] | undefined): ts.Node {
        const mods = modifiers && modifiers.length > 0 ? ts.factory.createNodeArray(modifiers) : undefined;

        // 针对不同类型的声明进行更新
        if (ts.isVariableStatement(node)) return ts.factory.updateVariableStatement(node, mods, node.declarationList);
        if (ts.isFunctionDeclaration(node)) return ts.factory.updateFunctionDeclaration(node, mods, node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, node.body);
        if (ts.isClassDeclaration(node)) return ts.factory.updateClassDeclaration(node, mods, node.name, node.typeParameters, node.heritageClauses, node.members);
        if (ts.isInterfaceDeclaration(node)) return ts.factory.updateInterfaceDeclaration(node, mods, node.name, node.typeParameters, node.heritageClauses, node.members);
        if (ts.isEnumDeclaration(node)) return ts.factory.updateEnumDeclaration(node, mods, node.name, node.members);
        if (ts.isTypeAliasDeclaration(node)) return ts.factory.updateTypeAliasDeclaration(node, mods, node.name, node.typeParameters, node.type);

        return node;
    }

    // --- 辅助方法 ---

    private error(file: ts.SourceFile, node: ts.Node, msg: string) {
        const { line, character } = ts.getLineAndCharacterOfPosition(file, node.getStart());
        return new Error(`${file.fileName}:${line + 1}:${character + 1} - ${msg}`);
    }

    public getResult(compact?: boolean): string {
        let res = this.output.join("\n\n");
        if (compact) {
            res = res.replace(/\n{3,}/g, '\n\n').replace(/\s+$/gm, '').replace(/\n\s+\n/g, '\n\n');
        }
        return res;
    }
}

// 主导出函数保持简洁
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

    const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => !d.file?.fileName.includes('node_modules'));
    if (diagnostics.length) {
        throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
    }

    const entryFile = program.getSourceFile(entry);
    if (!entryFile) throw new Error("Entry file not found");

    const context = new BundleContext(program, compilerOptions, host);
    context.visit(entryFile);

    return context.getResult(options.compact);
}