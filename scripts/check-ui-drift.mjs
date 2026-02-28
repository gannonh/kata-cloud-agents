import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SCAN_DIRS = ['apps/desktop/src', 'apps/web/src'];
const IMPORT_FILE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
]);

function parseArgs(argv) {
  let root = process.cwd();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--root') {
      const value = argv[index + 1];

      if (!value) {
        throw new Error('missing value for --root');
      }

      root = path.resolve(value);
      index += 1;
      continue;
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  return { root };
}

function normalizePath(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function isLocalUiFile(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  return normalizedPath.includes('/components/ui/');
}

function isLocalUiDirectory(relativePath) {
  const normalizedPath = normalizePath(relativePath);
  return normalizedPath.includes('/components/ui/');
}

function shouldScanImports(relativePath) {
  return IMPORT_FILE_EXTENSIONS.has(path.extname(relativePath));
}

function findImportViolations(contents) {
  const violations = [];
  const moduleReferences = extractModuleReferences(contents);

  for (const moduleReference of moduleReferences) {
    const violation = classifyImportViolation(moduleReference);

    if (violation) {
      violations.push(violation);
    }
  }

  return violations;
}

function classifyImportViolation(moduleReference) {
  const { kind, specifier } = moduleReference;

  if (specifier.startsWith('@kata/ui/components/ui/')) {
    return null;
  }

  if (specifier === '@/components/ui' || specifier.startsWith('@/components/ui/')) {
    return `forbidden alias ${kind} "${specifier}"`;
  }

  if (!specifier.startsWith('.')) {
    return null;
  }

  const normalizedSpecifier = specifier.replaceAll('\\', '/');

  if (
    normalizedSpecifier === './components/ui' ||
    normalizedSpecifier.endsWith('/components/ui') ||
    normalizedSpecifier.includes('/components/ui/')
  ) {
    return `forbidden relative ${kind} "${specifier}" targeting /components/ui`;
  }

  return null;
}

function extractModuleReferences(contents) {
  const moduleReferences = [];

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    const nextCharacter = contents[index + 1];

    if (character === '/' && nextCharacter === '/') {
      index = skipLineComment(contents, index + 2) - 1;
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      index = skipBlockComment(contents, index + 2) - 1;
      continue;
    }

    if (character === "'" || character === '"') {
      index = skipQuotedString(contents, index, character) - 1;
      continue;
    }

    if (character === '`') {
      const parsedTemplateLiteral = parseTemplateLiteral(contents, index);

      for (const expressionRange of parsedTemplateLiteral.expressionRanges) {
        moduleReferences.push(
          ...extractModuleReferences(contents.slice(expressionRange.start, expressionRange.end)),
        );
      }

      index = parsedTemplateLiteral.end - 1;
      continue;
    }

    if (isKeywordAt(contents, index, 'import')) {
      const parsedImport = parseImportSpecifier(contents, index);

      if (parsedImport) {
        moduleReferences.push(parsedImport);
        index = parsedImport.end - 1;
      }

      continue;
    }

    if (isKeywordAt(contents, index, 'export')) {
      const parsedExport = parseExportSpecifier(contents, index);

      if (parsedExport) {
        moduleReferences.push(parsedExport);
        index = parsedExport.end - 1;
      }

      continue;
    }

    if (isKeywordAt(contents, index, 'require')) {
      const parsedRequire = parseRequireSpecifier(contents, index);

      if (parsedRequire) {
        moduleReferences.push(parsedRequire);
        index = parsedRequire.end - 1;
      }
    }
  }

  return moduleReferences;
}

function parseImportSpecifier(contents, index) {
  let cursor = skipWhitespaceAndComments(contents, index + 'import'.length);

  if (contents[cursor] === '(') {
    cursor = skipWhitespaceAndComments(contents, cursor + 1);
    const parsedModuleLiteral = parseModuleLiteral(contents, cursor);

    if (parsedModuleLiteral) {
      return {
        kind: 'dynamic import',
        specifier: parsedModuleLiteral.value,
        end: parsedModuleLiteral.end,
      };
    }

    return null;
  }

  const directImport = parseStringLiteral(contents, cursor);

  if (directImport) {
    return {
      kind: 'import',
      specifier: directImport.value,
      end: directImport.end,
    };
  }

  const fromIndex = findKeyword(contents, 'from', cursor);

  if (fromIndex === -1) {
    return null;
  }

  cursor = skipWhitespaceAndComments(contents, fromIndex + 'from'.length);

  const parsedString = parseStringLiteral(contents, cursor);

  if (!parsedString) {
    return null;
  }

  return {
    kind: 'import',
    specifier: parsedString.value,
    end: parsedString.end,
  };
}

function parseExportSpecifier(contents, index) {
  const fromIndex = findKeyword(contents, 'from', index + 'export'.length);

  if (fromIndex === -1) {
    return null;
  }

  const cursor = skipWhitespaceAndComments(contents, fromIndex + 'from'.length);
  const parsedString = parseStringLiteral(contents, cursor);

  if (!parsedString) {
    return null;
  }

  return {
    kind: 'import',
    specifier: parsedString.value,
    end: parsedString.end,
  };
}

function parseRequireSpecifier(contents, index) {
  let cursor = skipWhitespaceAndComments(contents, index + 'require'.length);

  if (contents[cursor] !== '(') {
    return null;
  }

  cursor = skipWhitespaceAndComments(contents, cursor + 1);

  const parsedModuleLiteral = parseModuleLiteral(contents, cursor);

  if (!parsedModuleLiteral) {
    return null;
  }

  return {
    kind: 'require',
    specifier: parsedModuleLiteral.value,
    end: parsedModuleLiteral.end,
  };
}

function findKeyword(contents, keyword, startIndex) {
  for (let index = startIndex; index < contents.length; index += 1) {
    const character = contents[index];
    const nextCharacter = contents[index + 1];

    if (character === ';') {
      return -1;
    }

    if (character === '/' && nextCharacter === '/') {
      index = skipLineComment(contents, index + 2) - 1;
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      index = skipBlockComment(contents, index + 2) - 1;
      continue;
    }

    if (character === "'" || character === '"') {
      index = skipQuotedString(contents, index, character) - 1;
      continue;
    }

    if (character === '`') {
      index = parseTemplateLiteral(contents, index).end - 1;
      continue;
    }

    if (isKeywordAt(contents, index, keyword)) {
      return index;
    }
  }

  return -1;
}

function skipWhitespaceAndComments(contents, startIndex) {
  let index = startIndex;

  while (index < contents.length) {
    const character = contents[index];
    const nextCharacter = contents[index + 1];

    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }

    if (character === '/' && nextCharacter === '/') {
      index = skipLineComment(contents, index + 2);
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      index = skipBlockComment(contents, index + 2);
      continue;
    }

    break;
  }

  return index;
}

function parseStringLiteral(contents, startIndex) {
  const quote = contents[startIndex];

  if (quote !== "'" && quote !== '"') {
    return null;
  }

  let value = '';

  for (let index = startIndex + 1; index < contents.length; index += 1) {
    const character = contents[index];

    if (character === '\\') {
      const escapedCharacter = contents[index + 1];

      if (escapedCharacter === undefined) {
        return null;
      }

      value += character;
      value += escapedCharacter;
      index += 1;
      continue;
    }

    if (character === quote) {
      return {
        value,
        end: index + 1,
      };
    }

    value += character;
  }

  return null;
}

function parseModuleLiteral(contents, startIndex) {
  const parsedString = parseStringLiteral(contents, startIndex);

  if (parsedString) {
    return parsedString;
  }

  if (contents[startIndex] !== '`') {
    return null;
  }

  const parsedTemplateLiteral = parseTemplateLiteral(contents, startIndex);

  if (parsedTemplateLiteral.expressionRanges.length > 0) {
    return null;
  }

  return {
    value: parsedTemplateLiteral.value,
    end: parsedTemplateLiteral.end,
  };
}

function skipQuotedString(contents, startIndex, quote) {
  for (let index = startIndex + 1; index < contents.length; index += 1) {
    if (contents[index] === '\\') {
      index += 1;
      continue;
    }

    if (contents[index] === quote) {
      return index + 1;
    }
  }

  return contents.length;
}

function parseTemplateLiteral(contents, startIndex) {
  const expressionRanges = [];
  let value = '';

  for (let index = startIndex + 1; index < contents.length; index += 1) {
    if (contents[index] === '\\') {
      value += contents[index];
      value += contents[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (contents[index] === '`') {
      return {
        end: index + 1,
        expressionRanges,
        value,
      };
    }

    if (contents[index] === '$' && contents[index + 1] === '{') {
      const expressionStart = index + 2;
      const expressionEnd = findTemplateExpressionEnd(contents, expressionStart);

      expressionRanges.push({
        start: expressionStart,
        end: expressionEnd,
      });

      index = expressionEnd;
      continue;
    }

    value += contents[index];
  }

  return {
    end: contents.length,
    expressionRanges,
    value,
  };
}

function findTemplateExpressionEnd(contents, startIndex) {
  let depth = 1;

  for (let index = startIndex; index < contents.length; index += 1) {
    const character = contents[index];
    const nextCharacter = contents[index + 1];

    if (character === '/' && nextCharacter === '/') {
      index = skipLineComment(contents, index + 2) - 1;
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      index = skipBlockComment(contents, index + 2) - 1;
      continue;
    }

    if (character === "'" || character === '"') {
      index = skipQuotedString(contents, index, character) - 1;
      continue;
    }

    if (character === '`') {
      index = parseTemplateLiteral(contents, index).end - 1;
      continue;
    }

    if (character === '{') {
      depth += 1;
      continue;
    }

    if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return contents.length;
}

function skipLineComment(contents, startIndex) {
  let index = startIndex;

  while (index < contents.length && contents[index] !== '\n') {
    index += 1;
  }

  return index;
}

function skipBlockComment(contents, startIndex) {
  for (let index = startIndex; index < contents.length; index += 1) {
    if (contents[index] === '*' && contents[index + 1] === '/') {
      return index + 2;
    }
  }

  return contents.length;
}

function isKeywordAt(contents, index, keyword) {
  if (!contents.startsWith(keyword, index)) {
    return false;
  }

  const previousCharacter = contents[index - 1];
  const nextCharacter = contents[index + keyword.length];

  return !isIdentifierCharacter(previousCharacter) && !isIdentifierCharacter(nextCharacter);
}

function isIdentifierCharacter(character) {
  return character !== undefined && /[\p{L}\p{N}_$]/u.test(character);
}

function scanDirectory(root, relativeDir, violations) {
  const absoluteDir = path.join(root, relativeDir);

  if (!fs.existsSync(absoluteDir)) {
    return;
  }

  const entries = fs
    .readdirSync(absoluteDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.relative(root, absolutePath);

    if (entry.isDirectory()) {
      if (isLocalUiDirectory(relativePath)) {
        violations.push({
          file: relativePath,
          reason: 'local ui directory is not allowed',
        });
      }

      scanDirectory(root, relativePath, violations);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (isLocalUiFile(relativePath)) {
      violations.push({
        file: relativePath,
        reason: 'local ui file is not allowed',
      });
    }

    if (!shouldScanImports(relativePath)) {
      continue;
    }

    const contents = fs.readFileSync(absolutePath, 'utf8');

    for (const reason of findImportViolations(contents)) {
      violations.push({
        file: relativePath,
        reason,
      });
    }
  }
}

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const violations = [];

  for (const relativeDir of SCAN_DIRS) {
    scanDirectory(root, relativeDir, violations);
  }

  if (violations.length === 0) {
    process.exit(0);
  }

  violations.sort(
    (left, right) => left.file.localeCompare(right.file) || left.reason.localeCompare(right.reason),
  );

  for (const violation of violations) {
    process.stderr.write(`${violation.file}: ${violation.reason}\n`);
  }

  process.exit(1);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
