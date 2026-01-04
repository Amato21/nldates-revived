/**
 * Système de logging structuré pour Natural Language Dates
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
}

/**
 * Formate une entrée de log avec timestamp
 */
function formatLogEntry(level: LogLevel, message: string, context?: any): string {
  const timestamp = new Date().toISOString();
  const entry: LogEntry = {
    timestamp,
    level,
    message,
    context,
  };
  
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
  debug(message: string, context?: any): void {
    const formatted = formatLogEntry('debug', message, context);
    if (console.debug) {
      console.debug(formatted);
    } else {
      console.log(formatted);
    }
  },

  /**
   * Log de niveau info (informations générales)
   */
  info(message: string, context?: any): void {
    const formatted = formatLogEntry('info', message, context);
    if (console.info) {
      console.info(formatted);
    } else {
      console.log(formatted);
    }
  },

  /**
   * Log de niveau warn (avertissements)
   */
  warn(message: string, context?: any): void {
    const formatted = formatLogEntry('warn', message, context);
    console.warn(formatted);
  },

  /**
   * Log de niveau error (erreurs)
   */
  error(message: string, context?: any): void {
    const formatted = formatLogEntry('error', message, context);
    console.error(formatted);
  },
};

