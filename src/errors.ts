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

    // Maintient la stack trace pour le débogage (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NLDParseError);
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

