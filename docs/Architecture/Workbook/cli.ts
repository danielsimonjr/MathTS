#!/usr/bin/env node
/**
 * MathTS Scientific Workbook CLI
 * 
 * Command-line interface for .mtsw workbook files
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, watchFile } from 'fs';
import { basename, extname } from 'path';
import chalk from 'chalk';

import {
  parseWorkbook,
  serializeWorkbook,
  stripOutputs,
  validateReferences,
  createExecutor,
  toMermaid,
  topologicalSort,
} from './index';
import type { Workbook, WorkbookEvent, Cell } from './types';

const program = new Command();

program
  .name('mtsw')
  .description('MathTS Scientific Workbook CLI')
  .version('1.0.0');

// ============================================================================
// Commands
// ============================================================================

/**
 * Run a workbook
 */
program
  .command('run <file>')
  .description('Execute a workbook file')
  .option('-c, --cell <id>', 'Run only a specific cell')
  .option('-v, --verbose', 'Show detailed output')
  .option('-q, --quiet', 'Suppress output')
  .action(async (file: string, options) => {
    try {
      const content = readFileSync(file, 'utf-8');
      const result = parseWorkbook(content);

      if (!result.success || !result.workbook) {
        console.error(chalk.red('Parse errors:'));
        result.errors?.forEach(e => console.error(`  - ${e.message}`));
        process.exit(1);
      }

      if (result.warnings) {
        result.warnings.forEach(w => console.warn(chalk.yellow(`Warning: ${w.message}`)));
      }

      const executor = createExecutor(result.workbook);

      // Event handler
      executor.on((event: WorkbookEvent) => {
        if (options.quiet) return;

        switch (event.type) {
          case 'cell:start':
            if (options.verbose) {
              console.log(chalk.blue(`▶ Running ${event.cellId}...`));
            }
            break;
          case 'cell:success':
            console.log(chalk.green(`✓ ${event.cellId}`) + 
              (options.verbose ? ` (${event.output.execution_time_ms}ms)` : ''));
            if (options.verbose && event.output.stdout) {
              console.log(chalk.gray(`  ${event.output.stdout}`));
            }
            break;
          case 'cell:error':
            console.error(chalk.red(`✗ ${event.cellId}: ${event.error.message}`));
            break;
          case 'workbook:ready':
            console.log(chalk.green('\n✓ Workbook execution complete'));
            break;
        }
      });

      if (options.cell) {
        await executor.runCell(options.cell);
      } else {
        await executor.runAll();
      }

    } catch (e) {
      console.error(chalk.red(`Error: ${e instanceof Error ? e.message : e}`));
      process.exit(1);
    }
  });

/**
 * Watch and re-run on changes
 */
program
  .command('watch <file>')
  .description('Watch workbook and re-run on changes')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (file: string, options) => {
    console.log(chalk.blue(`Watching ${file}...`));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

    const runFile = async () => {
      try {
        const content = readFileSync(file, 'utf-8');
        const result = parseWorkbook(content);

        if (!result.success || !result.workbook) {
          console.error(chalk.red('Parse error'));
          return;
        }

        const executor = createExecutor(result.workbook);
        
        executor.on((event: WorkbookEvent) => {
          if (event.type === 'cell:success') {
            console.log(chalk.green(`✓ ${event.cellId}`));
          } else if (event.type === 'cell:error') {
            console.error(chalk.red(`✗ ${event.cellId}`));
          }
        });

        await executor.runAll();
        console.log(chalk.gray(`\n[${new Date().toLocaleTimeString()}] Complete\n`));

      } catch (e) {
        console.error(chalk.red(`Error: ${e instanceof Error ? e.message : e}`));
      }
    };

    // Initial run
    await runFile();

    // Watch for changes
    watchFile(file, { interval: 500 }, async () => {
      console.log(chalk.blue(`\nFile changed, re-running...`));
      await runFile();
    });
  });

/**
 * Validate a workbook
 */
program
  .command('validate <file>')
  .description('Validate workbook structure and references')
  .action((file: string) => {
    try {
      const content = readFileSync(file, 'utf-8');
      const result = parseWorkbook(content);

      if (!result.success) {
        console.error(chalk.red('Parse errors:'));
        result.errors?.forEach(e => console.error(`  - ${e.message}`));
        process.exit(1);
      }

      if (!result.workbook) {
        console.error(chalk.red('No workbook parsed'));
        process.exit(1);
      }

      // Check references
      const refErrors = validateReferences(result.workbook);
      if (refErrors.length > 0) {
        console.error(chalk.red('Reference errors:'));
        refErrors.forEach(e => console.error(`  - ${e.message}`));
        process.exit(1);
      }

      if (result.warnings) {
        result.warnings.forEach(w => console.warn(chalk.yellow(`Warning: ${w.message}`)));
      }

      console.log(chalk.green('✓ Workbook is valid'));
      console.log(`  Cells: ${result.workbook.cells.length}`);
      console.log(`  Version: ${result.workbook.version}`);

    } catch (e) {
      console.error(chalk.red(`Error: ${e instanceof Error ? e.message : e}`));
      process.exit(1);
    }
  });

/**
 * Strip outputs from workbook
 */
program
  .command('strip <file>')
  .description('Remove outputs from workbook (for Git)')
  .option('-o, --output <file>', 'Output file (defaults to stdout)')
  .action((file: string, options) => {
    try {
      const content = readFileSync(file, 'utf-8');
      const result = parseWorkbook(content);

      if (!result.success || !result.workbook) {
        console.error(chalk.red('Parse error'));
        process.exit(1);
      }

      const stripped = stripOutputs(result.workbook);
      const output = serializeWorkbook(stripped, { includeOutputs: false });

      if (options.output) {
        writeFileSync(options.output, output, 'utf-8');
        console.log(chalk.green(`✓ Stripped outputs written to ${options.output}`));
      } else {
        console.log(output);
      }

    } catch (e) {
      console.error(chalk.red(`Error: ${e instanceof Error ? e.message : e}`));
      process.exit(1);
    }
  });

/**
 * Show dependency graph
 */
program
  .command('graph <file>')
  .description('Display cell dependency graph')
  .option('-f, --format <format>', 'Output format (mermaid|text)', 'text')
  .action((file: string, options) => {
    try {
      const content = readFileSync(file, 'utf-8');
      const result = parseWorkbook(content);

      if (!result.success || !result.workbook) {
        console.error(chalk.red('Parse error'));
        process.exit(1);
      }

      const executor = createExecutor(result.workbook);
      const graph = executor.getGraph();

      if (options.format === 'mermaid') {
        console.log(toMermaid(graph));
      } else {
        const order = topologicalSort(graph);
        console.log(chalk.bold('Execution Order:'));
        order.forEach((id, i) => {
          const node = graph.nodes.get(id)!;
          const deps = node.dependencies.length > 0 
            ? chalk.gray(` ← [${node.dependencies.join(', ')}]`)
            : '';
          console.log(`  ${i + 1}. ${chalk.cyan(id)} (${node.cell.type})${deps}`);
        });
      }

    } catch (e) {
      console.error(chalk.red(`Error: ${e instanceof Error ? e.message : e}`));
      process.exit(1);
    }
  });

/**
 * Create a new workbook from template
 */
program
  .command('new <name>')
  .description('Create a new workbook')
  .option('-t, --template <template>', 'Template (basic|tensor-physics|data-science)', 'basic')
  .action((name: string, options) => {
    const filename = name.endsWith('.mtsw') ? name : `${name}.mtsw`;
    
    if (existsSync(filename)) {
      console.error(chalk.red(`File already exists: ${filename}`));
      process.exit(1);
    }

    const workbook = createTemplate(options.template, basename(name, extname(name)));
    const content = serializeWorkbook(workbook);
    
    writeFileSync(filename, content, 'utf-8');
    console.log(chalk.green(`✓ Created ${filename}`));
  });

/**
 * Export workbook to other formats
 */
program
  .command('export <file>')
  .description('Export workbook to other formats')
  .option('-f, --format <format>', 'Output format (html|pdf|ipynb|latex)', 'html')
  .option('-o, --output <file>', 'Output file')
  .action(async (file: string, options) => {
    try {
      const content = readFileSync(file, 'utf-8');
      const result = parseWorkbook(content);

      if (!result.success || !result.workbook) {
        console.error(chalk.red('Parse error'));
        process.exit(1);
      }

      const format = options.format;
      const outputFile = options.output || 
        basename(file, extname(file)) + getExtension(format);

      switch (format) {
        case 'html':
          const html = exportToHTML(result.workbook);
          writeFileSync(outputFile, html, 'utf-8');
          break;
        
        case 'ipynb':
          const ipynb = exportToJupyter(result.workbook);
          writeFileSync(outputFile, JSON.stringify(ipynb, null, 2), 'utf-8');
          break;

        case 'latex':
          const latex = exportToLaTeX(result.workbook);
          writeFileSync(outputFile, latex, 'utf-8');
          break;

        case 'pdf':
          console.log(chalk.yellow('PDF export requires LaTeX. Generating .tex file...'));
          const tex = exportToLaTeX(result.workbook);
          const texFile = outputFile.replace('.pdf', '.tex');
          writeFileSync(texFile, tex, 'utf-8');
          console.log(chalk.gray(`Run: pdflatex ${texFile}`));
          break;

        default:
          console.error(chalk.red(`Unknown format: ${format}`));
          process.exit(1);
      }

      console.log(chalk.green(`✓ Exported to ${outputFile}`));

    } catch (e) {
      console.error(chalk.red(`Error: ${e instanceof Error ? e.message : e}`));
      process.exit(1);
    }
  });

/**
 * Start interactive server
 */
program
  .command('serve [file]')
  .description('Start interactive workbook server')
  .option('-p, --port <port>', 'Server port', '3000')
  .action(async (file: string | undefined, options) => {
    console.log(chalk.blue(`Starting MathTS Workbook Server on port ${options.port}...`));
    console.log(chalk.yellow('Note: Server implementation requires additional setup'));
    console.log(chalk.gray('\nThis will start a web UI with:'));
    console.log(chalk.gray('  - Monaco editor for cells'));
    console.log(chalk.gray('  - KaTeX/MathJax for equations'));
    console.log(chalk.gray('  - Three.js for 3D visualizations'));
    console.log(chalk.gray('  - Reactive execution'));
    
    // TODO: Implement server with express + socket.io
    console.log(chalk.red('\nServer not yet implemented'));
  });

// ============================================================================
// Templates
// ============================================================================

function createTemplate(template: string, title: string): Workbook {
  switch (template) {
    case 'tensor-physics':
      return {
        version: '1.0',
        metadata: {
          title,
          author: '',
          created: new Date().toISOString(),
          tags: ['tensor-physics', 'UPTF'],
        },
        runtime: {
          engine: 'mathts',
          packages: ['@mathts/tensor', '@mathts/symbolic', '@mathts/viz'],
          execution: 'reactive',
        },
        cells: [
          {
            type: 'markdown',
            id: 'intro',
            markdown: `# ${title}\n\nTensor physics workbook using the Universal Physics Tensor Framework.`,
          },
          {
            type: 'tensor',
            id: 'metric',
            tensor: `# Define metric tensor\ng_{μν} = diag(-1, 1, 1, 1)  # Minkowski metric`,
            notation: 'einstein',
          },
          {
            type: 'code',
            id: 'compute',
            code: `import { Metric, ChristoffelSymbols } from '@mathts/tensor';\n\n// Compute Christoffel symbols from metric\nconst christoffel = ChristoffelSymbols.fromMetric(g);\n\nexport { christoffel };`,
            language: 'typescript',
          },
          {
            type: 'visualization',
            id: 'viz',
            visualization: `import { Scene, TensorField } from '@mathts/viz';\n\nconst scene = new Scene({ renderer: 'threejs' });\n// Add tensor visualization\nscene.render();`,
            renderer: 'threejs',
          },
        ],
      };

    case 'data-science':
      return {
        version: '1.0',
        metadata: {
          title,
          author: '',
          created: new Date().toISOString(),
          tags: ['data-science', 'analysis'],
        },
        runtime: {
          engine: 'mathts',
          packages: ['@danielsimonjr/mathts-matrix', '@mathts/stats'],
          execution: 'reactive',
        },
        cells: [
          {
            type: 'markdown',
            id: 'intro',
            markdown: `# ${title}\n\nData analysis workbook.`,
          },
          {
            type: 'data',
            id: 'dataset',
            data: `# Sample data\nvalues:\n  - [1, 2, 3]\n  - [4, 5, 6]\n  - [7, 8, 9]`,
            format: 'yaml',
          },
          {
            type: 'code',
            id: 'analysis',
            code: `import { Matrix, stats } from '@danielsimonjr/mathts-core';\nimport { values } from '#dataset';\n\nconst m = Matrix.from(values);\nconst mean = stats.mean(m);\nconst std = stats.std(m);\n\nconsole.log('Mean:', mean);\nconsole.log('Std:', std);\n\nexport { m, mean, std };`,
            language: 'typescript',
          },
        ],
      };

    case 'basic':
    default:
      return {
        version: '1.0',
        metadata: {
          title,
          author: '',
          created: new Date().toISOString(),
        },
        runtime: {
          engine: 'mathts',
          execution: 'reactive',
        },
        cells: [
          {
            type: 'markdown',
            id: 'intro',
            markdown: `# ${title}\n\nA MathTS Scientific Workbook.`,
          },
          {
            type: 'code',
            id: 'example',
            code: `// Your code here\nconst x = 42;\nconsole.log('Hello, MathTS!', x);\n\nexport { x };`,
            language: 'typescript',
          },
        ],
      };
  }
}

// ============================================================================
// Export Functions
// ============================================================================

function getExtension(format: string): string {
  switch (format) {
    case 'html': return '.html';
    case 'pdf': return '.pdf';
    case 'ipynb': return '.ipynb';
    case 'latex': return '.tex';
    default: return '.txt';
  }
}

function exportToHTML(workbook: Workbook): string {
  const title = workbook.metadata?.title || 'MathTS Workbook';
  
  const cellsHTML = workbook.cells.map(cell => {
    switch (cell.type) {
      case 'markdown':
        return `<div class="cell cell-markdown">${escapeHtml(cell.markdown)}</div>`;
      case 'code':
        return `<div class="cell cell-code"><pre><code class="language-typescript">${escapeHtml(cell.code)}</code></pre></div>`;
      case 'tensor':
        return `<div class="cell cell-tensor"><pre>${escapeHtml(cell.tensor)}</pre></div>`;
      case 'equation':
        return `<div class="cell cell-equation">$$${cell.equation}$$</div>`;
      default:
        return `<div class="cell cell-${cell.type}"><!-- ${cell.type} cell --></div>`;
    }
  }).join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; }
    .cell { margin: 1.5rem 0; padding: 1rem; border-radius: 8px; }
    .cell-markdown { background: #f8f9fa; }
    .cell-code { background: #1e1e1e; color: #d4d4d4; }
    .cell-code pre { margin: 0; overflow-x: auto; }
    .cell-tensor { background: #f0f7ff; font-family: monospace; }
    .cell-equation { text-align: center; padding: 2rem; }
    h1, h2, h3 { margin-top: 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${cellsHTML}
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      renderMathInElement(document.body, { delimiters: [
        {left: "$$", right: "$$", display: true},
        {left: "$", right: "$", display: false}
      ]});
      hljs.highlightAll();
    });
  </script>
</body>
</html>`;
}

function exportToJupyter(workbook: Workbook): object {
  const cells = workbook.cells.map(cell => {
    switch (cell.type) {
      case 'markdown':
        return {
          cell_type: 'markdown',
          metadata: {},
          source: cell.markdown.split('\n'),
        };
      case 'code':
        return {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: cell.code.split('\n').map((l, i, arr) => 
            i < arr.length - 1 ? l + '\n' : l
          ),
        };
      case 'equation':
        return {
          cell_type: 'markdown',
          metadata: {},
          source: [`$$\n${cell.equation}\n$$`],
        };
      case 'tensor':
        return {
          cell_type: 'markdown',
          metadata: {},
          source: [`\`\`\`tensor\n${cell.tensor}\n\`\`\``],
        };
      default:
        return {
          cell_type: 'markdown',
          metadata: {},
          source: [`<!-- ${cell.type} cell: ${cell.id} -->`],
        };
    }
  });

  return {
    cells,
    metadata: {
      kernelspec: {
        display_name: 'TypeScript',
        language: 'typescript',
        name: 'typescript',
      },
      language_info: {
        name: 'typescript',
        version: '5.0.0',
      },
      title: workbook.metadata?.title,
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
}

function exportToLaTeX(workbook: Workbook): string {
  const title = workbook.metadata?.title || 'MathTS Workbook';
  const author = workbook.metadata?.author || '';

  const content = workbook.cells.map(cell => {
    switch (cell.type) {
      case 'markdown':
        // Simple markdown to LaTeX conversion
        return cell.markdown
          .replace(/^# (.+)$/gm, '\\section{$1}')
          .replace(/^## (.+)$/gm, '\\subsection{$1}')
          .replace(/^### (.+)$/gm, '\\subsubsection{$1}')
          .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
          .replace(/\*(.+?)\*/g, '\\textit{$1}')
          .replace(/\$\$([^$]+)\$\$/g, '\\begin{equation}\n$1\n\\end{equation}')
          .replace(/\$([^$]+)\$/g, '$$$1$$');
      
      case 'code':
        return `\\begin{lstlisting}[language=TypeScript]\n${cell.code}\n\\end{lstlisting}`;
      
      case 'equation':
        const label = cell.label ? `\\label{${cell.label}}` : '';
        return `\\begin{equation}${label}\n${cell.equation}\n\\end{equation}`;
      
      case 'tensor':
        return `\\begin{verbatim}\n${cell.tensor}\n\\end{verbatim}`;
      
      default:
        return `% ${cell.type} cell: ${cell.id}`;
    }
  }).join('\n\n');

  return `\\documentclass[11pt]{article}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{listings}
\\usepackage{hyperref}
\\usepackage[margin=1in]{geometry}

\\lstset{
  basicstyle=\\ttfamily\\small,
  breaklines=true,
  frame=single,
  numbers=left,
  numberstyle=\\tiny,
}

\\title{${title}}
\\author{${author}}
\\date{\\today}

\\begin{document}
\\maketitle

${content}

\\end{document}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Run CLI
// ============================================================================

program.parse();
