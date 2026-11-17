/**
 * Classe d'erreur personnalisée pour Natural Language Dates
 */
export class NLDParseError extends Error {
  public readonly code: string;
  public readonly context?: unknown;
  public readonly severity: 'debug' | 'warn' | 'error';

  constructor(
    message: string,
    code: string,
    severity: 'debug' | 'warn' | 'error' = 'error',
    context?: unknown
  ) {
    super(message);
    this.name = 'NLDParseError';
    this.code = code;
    this.severity = severity;
    this.context = context;

    // Maintient la stack trace pour le débogage (V8 only). Error.captureStackTrace
    // is a non-standard V8 extension: @types/node declares it (which is why
    // this type-checks cleanly in this project's own tsconfig), but a
    // type-checking setup without the Node.js ambient types loaded sees an
    // untyped property access here instead -- typed explicitly so the call
    // is safe either way.
    const ErrorWithCaptureStackTrace = Error as typeof Error & {
      captureStackTrace?: (targetObject: object, constructorOpt?: unknown) => void;
    };
    if (ErrorWithCaptureStackTrace.captureStackTrace) {
      ErrorWithCaptureStackTrace.captureStackTrace(this, NLDParseError);
    }
  }
}

/**
 * Codes d'erreur constants
 */
export const ErrorCodes = {
  // Initialisation
  PARSER_INIT_FAILED: 'PARSER_INIT_FAILED',
  CHRONO_INIT_FAILED: 'CHRONO_INIT_FAILED',
  
  // Parsing
  PARSE_FAILED: 'PARSE_FAILED',
  CHRONO_PARSE_ERROR: 'CHRONO_PARSE_ERROR',
  
  // Configuration
  SETTINGS_LOAD_FAILED: 'SETTINGS_LOAD_FAILED',
  INVALID_LANGUAGE: 'INVALID_LANGUAGE',
} as const;

