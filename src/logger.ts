/**
 * Système de logging structuré pour Natural Language Dates
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Formate une entrée de log avec timestamp
 */
function formatLogEntry(level: LogLevel, message: string, context?: unknown): string {
  const timestamp = new Date().toISOString();
  
  if (context) {
    return `[${timestamp}] [${level.toUpperCase()}] ${message} | Context: ${JSON.stringify(context)}`;
  }
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

/**
 * Système de logging structuré
 */
export const logger = {
  /**
   * Log de niveau debug (pour le développement)
   */
  debug(message: string, context?: unknown): void {
    const formatted = formatLogEntry('debug', message, context);
    console.debug(formatted);
  },

  /**
   * Log de niveau info (informations générales)
   */
  info(message: string, context?: unknown): void {
    const formatted = formatLogEntry('info', message, context);
    console.debug(formatted);
  },

  /**
   * Log de niveau warn (avertissements)
   */
  warn(message: string, context?: unknown): void {
    const formatted = formatLogEntry('warn', message, context);
    console.warn(formatted);
  },

  /**
   * Log de niveau error (erreurs)
   */
  error(message: string, context?: unknown): void {
    const formatted = formatLogEntry('error', message, context);
    console.error(formatted);
  },
};

