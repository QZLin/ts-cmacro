import { Command } from "commander";
import fs from "fs";
import { build } from "./index.js";

const program = new Command();

program
    .name("ts-cmacro")
    .version("1.0.0")
    .argument("<entry>", "Entry TypeScript file")
    .option("-o, --output <file>", "Output file path")
    .option("-c, --compact", "Compact output by removing unnecessary whitespace")
    .action((entry: string, options: { output?: string; compact?: boolean }) => {
        const code = build({ entry, compact: options.compact });

        if (options.output) {
            fs.writeFileSync(options.output, code);
        } else {
            process.stdout.write(code);
        }
    });

program.parse(process.argv);