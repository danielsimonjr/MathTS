#!/usr/bin/env node
/**
 * MathTS Workbook CLI
 */

import { parseWorkbook, createExecutor } from './index';

const HELP = `
mtsw - MathTS Workbook CLI

Usage:
  mtsw run <file>              Execute a workbook
  mtsw run <file> -c <cell>    Run specific cell
  mtsw run <file> -v           Verbose output
  mtsw watch <file>            Watch and re-run on changes
  mtsw validate <file>         Validate workbook structure
  mtsw graph <file>            Show dependency graph
  mtsw graph <file> -f mermaid Export as Mermaid diagram
  mtsw strip <file>            Strip outputs (for git)
  mtsw new <name>              Create new workbook
  mtsw new <name> -t <template> Use template (basic|tensor-physics|data-science)
  mtsw export <file> -f <fmt>  Export to format (html|pdf|ipynb|latex)

Options:
  -h, --help     Show this help
  -v, --verbose  Verbose output
  -V, --version  Show version
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(HELP);
    process.exit(0);
  }

  if (args.includes('-V') || args.includes('--version')) {
    console.log('mtsw version 0.1.0');
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case 'run':
      await runCommand(args.slice(1));
      break;
    case 'validate':
      await validateCommand(args.slice(1));
      break;
    case 'graph':
      await graphCommand(args.slice(1));
      break;
    case 'new':
      await newCommand(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

async function runCommand(args: string[]) {
  const file = args[0];
  if (!file) {
    console.error('Usage: mtsw run <file>');
    process.exit(1);
  }

  console.log(`Running workbook: ${file}`);

  // TODO: Read file and execute
  const content = ''; // fs.readFileSync(file, 'utf-8')
  const result = parseWorkbook(content);

  if (!result.success) {
    console.error('Parse errors:', result.errors);
    process.exit(1);
  }

  if (result.workbook) {
    const executor = createExecutor(result.workbook);

    executor.on((event) => {
      console.log(`[${event.type}] ${event.cellId ?? ''}`);
    });

    await executor.runAll();
  }
}

async function validateCommand(args: string[]) {
  const file = args[0];
  if (!file) {
    console.error('Usage: mtsw validate <file>');
    process.exit(1);
  }

  console.log(`Validating: ${file}`);
  // TODO: Implement validation
}

async function graphCommand(args: string[]) {
  const file = args[0];
  if (!file) {
    console.error('Usage: mtsw graph <file>');
    process.exit(1);
  }

  console.log(`Dependency graph for: ${file}`);
  // TODO: Implement graph visualization
}

async function newCommand(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error('Usage: mtsw new <name>');
    process.exit(1);
  }

  console.log(`Creating new workbook: ${name}.mtsw`);
  // TODO: Implement template creation
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
