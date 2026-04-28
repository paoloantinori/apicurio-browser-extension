/**
 * SpecValidator — detects OpenAPI/Swagger specification files.
 * Optimised for sub-millisecond validation.
 */

export interface ValidationResult {
  valid: boolean;
  version?: string; // e.g. "openapi-3.0.0", "swagger-2.0"
}

const SPEC_EXTENSIONS = /\.(json|ya?ml)$/i;

const SPEC_FILENAMES: ReadonlySet<string> = new Set([
  'openapi.json',
  'openapi.yaml',
  'openapi.yml',
  'swagger.json',
  'swagger.yaml',
  'swagger.yml',
  'api-spec.json',
  'api-spec.yaml',
  'api-spec.yml',
]);

// Pre-compiled patterns — each entry is [pattern, versionPrefix, isYamlVersion]
const PATTERNS: ReadonlyArray<{
  re: RegExp;
  prefix: string;
  captureVersion: boolean;
}> = [
  // YAML OpenAPI 3.x
  { re: /^openapi:\s*["']?(\d+\.\d+\.\d+)/m, prefix: 'openapi', captureVersion: true },
  // JSON OpenAPI 3.x
  { re: /^"openapi"\s*:\s*"(\d+\.\d+\.\d+)"/m, prefix: 'openapi', captureVersion: true },
  // YAML Swagger 2.0
  { re: /^swagger:\s*["']?(2\.0)/m, prefix: 'swagger', captureVersion: true },
  // JSON Swagger 2.0
  { re: /^"swagger"\s*:\s*"(2\.0)"/m, prefix: 'swagger', captureVersion: true },
];

// Limit scanning to the first 50 lines to bound cost
const MAX_LINES = 50;

function firstNLines(content: string, n: number): string {
  let count = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      count++;
      if (count >= n) {
        return content.slice(0, i);
      }
    }
  }
  return content;
}

export class SpecValidator {
  /**
   * Returns true if the filename looks like a potential spec file
   * based on extension or well-known naming conventions.
   */
  static isCandidateFile(filename: string): boolean {
    if (SPEC_EXTENSIONS.test(filename)) {
      return true;
    }
    // Extract just the basename (handle both / and \ separators)
    const base = filename.slice(Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\')) + 1);
    return SPEC_FILENAMES.has(base.toLowerCase());
  }

  /**
   * Fast regex-based scan of the first 50 lines for known OpenAPI/Swagger markers.
   */
  static isOpenApiSpec(content: string): boolean {
    const head = firstNLines(content, MAX_LINES);
    for (let i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i].re.test(head)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Performs a quick validation:
   *  - JSON content is parsed first and checked for root `openapi` / `swagger` keys.
   *  - Otherwise falls back to regex scanning.
   * Returns a ValidationResult indicating whether the content is a recognised spec
   * and, if so, which version (e.g. "openapi-3.1.0" or "swagger-2.0").
   */
  static quickValidate(content: string): ValidationResult {
    const trimmed = content.trimStart();

    // Attempt fast JSON path when the content starts with '{'
    if (trimmed.charCodeAt(0) === 0x7b /* '{' */) {
      try {
        const obj = JSON.parse(content) as Record<string, unknown>;
        if (typeof obj.openapi === 'string') {
          return { valid: true, version: `openapi-${obj.openapi}` };
        }
        if (typeof obj.swagger === 'string') {
          return { valid: true, version: `swagger-${obj.swagger}` };
        }
        return { valid: false };
      } catch {
        // Not valid JSON — fall through to regex scan
      }
    }

    // Regex scan (YAML or unparseable content)
    const head = firstNLines(content, MAX_LINES);
    for (let i = 0; i < PATTERNS.length; i++) {
      const { re, prefix, captureVersion } = PATTERNS[i];
      const m = re.exec(head);
      if (m) {
        return {
          valid: true,
          version: captureVersion && m[1] ? `${prefix}-${m[1]}` : `${prefix}-unknown`,
        };
      }
    }

    return { valid: false };
  }
}
