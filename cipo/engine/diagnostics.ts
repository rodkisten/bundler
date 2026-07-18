/** Stable severity levels used by compiler and build-tool diagnostics. */
export type CipoDiagnosticSeverity = 'info' | 'warning' | 'error'

/** Source location attached to a compiler diagnostic when known. */
export interface CipoSourceLocation {
  readonly filename?: string
  readonly start?: number
  readonly end?: number
  readonly line?: number
  readonly column?: number
}

/** Structured compiler diagnostic suitable for Vite, CI and editor integrations. */
export interface CipoCompilerDiagnostic extends CipoSourceLocation {
  readonly code: string
  readonly severity: CipoDiagnosticSeverity
  readonly message: string
  readonly hint?: string
  readonly cause?: unknown
}

/** Error thrown when semantic compilation cannot safely continue. */
export class CipoCompileError extends Error {
  readonly diagnostics: readonly CipoCompilerDiagnostic[]

  constructor(diagnostic: CipoCompilerDiagnostic | readonly CipoCompilerDiagnostic[]) {
    const diagnostics = Array.isArray(diagnostic) ? diagnostic : [diagnostic]
    super(diagnostics.map(formatCipoDiagnostic).join('\n'))
    this.name = 'CipoCompileError'
    this.diagnostics = diagnostics
  }
}

/** Creates a normalized error diagnostic without losing the original cause. */
export function createCompileDiagnostic(
  code: string,
  message: string,
  location: CipoSourceLocation = {},
  cause?: unknown,
  hint?: string,
): CipoCompilerDiagnostic {
  return {
    code,
    severity: 'error',
    message,
    ...location,
    ...(hint ? { hint } : {}),
    ...(cause === undefined ? {} : { cause }),
  }
}

/** Human-readable diagnostic formatting used by thrown build errors. */
export function formatCipoDiagnostic(diagnostic: CipoCompilerDiagnostic): string {
  const position = diagnostic.filename
    ? `${diagnostic.filename}${diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}` : ''}`
    : 'Cipó compiler'
  const hint = diagnostic.hint ? `\nHint: ${diagnostic.hint}` : ''
  return `${position} [${diagnostic.code}] ${diagnostic.message}${hint}`
}

/** Converts unknown failures into a structured compiler error and preserves typed failures. */
export function asCipoCompileError(
  error: unknown,
  code: string,
  message: string,
  location: CipoSourceLocation = {},
): CipoCompileError {
  if (error instanceof CipoCompileError) return error
  return new CipoCompileError(createCompileDiagnostic(code, message, location, error))
}
