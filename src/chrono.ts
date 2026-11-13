// CHANGEMENT ICI : On utilise "import * as chrono" car la version 2.x n'a plus d'export par défaut
import * as chrono from "chrono-node";
import { Chrono, Parser, ParsingContext, Refiner } from "chrono-node";
import { ORDINAL_NUMBER_PATTERN, parseOrdinalNumberPattern, describeError } from "./utils";
import { logger } from "./logger";
import moment from "./window-moment";

// Local type definition matching chrono-node's Configuration interface
// Configuration is not exported from the main module, so we define it locally
interface ChronoConfiguration {
  parsers: Parser[];
  refiners: Refiner[];
}

function getOrdinalDateParser() {
  return ({
    // Guarded on both sides so this never matches a piece of a longer
    // all-numeric date like German "9.10.2026" (day.month.year):
    //  - (?<!\d): not directly preceded by a digit -- excludes e.g. "26"/"6"
    //    matching as a bare ordinal inside the trailing "2026".
    //  - (?![/.\-]?\d): not followed by an optional separator then a digit --
    //    excludes "9" (even backtracked to not swallow its own trailing ".")
    //    or "10" matching when more digits of the same date follow.
    // Without these, "9." alone satisfies ORDINAL_NUMBER_PATTERN (a 1-2 digit
    // number with an optional trailing separator/suffix), creating extra
    // overlapping candidate matches ("9.", "10.", "20", "26" for this exact
    // string) that chrono-node's refiner pipeline merges into the
    // correctly-parsed native date before discarding them as redundant --
    // overwriting its day/month with digits read from the wrong position in
    // the string. A standalone ordinal ("15th", "9. Oktober") is never
    // directly adjacent to another digit, so this doesn't affect the
    // bare-ordinal-day case this parser exists for.
    pattern: () => new RegExp(`(?<!\\d)${ORDINAL_NUMBER_PATTERN}(?![/.\\-]?\\d)`),
    extract: (context: ParsingContext, match: RegExpMatchArray) => {
      return {
        day: parseOrdinalNumberPattern(match[0]),
        // moment(...).month() is 0-indexed (Jan=0), but chrono-node's
        // ParsingComponents.month is 1-indexed (Jan=1) -- verified against
        // chrono-node's own locale constants. Without the +1 this always
        // resolved to the wrong month (and, via forwardDate, sometimes the
        // wrong year too).
        // Must use context.refDate (the date chrono was asked to parse
        // relative to), not moment() (the real current wall-clock time):
        // callers can and do pass an explicit reference date, e.g. tests, or
        // getParsedDateResult()'s callers in parser.ts.
        month: moment(context.refDate).month() + 1,
      };
    },
  } as Parser);
}

export default function getChronos(languages: string[]): Chrono[] {
  const locale = moment.locale();
  const isGB = locale === 'en-gb';

  const chronos: Chrono[] = [];
  const ordinalDateParser = getOrdinalDateParser();
  // Builds a Chrono instance for a locale module, supporting both chrono-node
  // API shapes: older locales still expose createCasualConfiguration(isGB),
  // but as of chrono-node 2.x every locale we support also exports pre-built
  // Chrono instances (casual/GB/strict) -- English, uniquely, now ONLY
  // exposes those, with no config factory at all. A locale missing both
  // would previously be silently treated as unsupported (logged at "warn"
  // only) and every match for that language would fall through to today/now
  // with no visible error -- this happened for English specifically, for
  // every user who enabled it, since createCasualConfiguration is exactly
  // what disappeared from that module.
  //
  // .casual is checked FIRST (not createCasualConfiguration, despite every
  // locale but English and Italian still exposing both): confirmed by
  // direct comparison that createCasualConfiguration(false) assembles a
  // buggy refiner pipeline for German, where SlashDateFormatParser's
  // correct day/month for "9.10.2026" gets silently overwritten with
  // fields merged in from DETimeExpressionParser's overlapping (but
  // ultimately discarded) "9.10" time-of-day candidate -- while .casual,
  // for the exact same input and locale, parses it correctly. Since every
  // locale we ship exposes .casual, createCasualConfiguration is now only
  // ever reached as a fallback for some future/third-party locale module
  // that doesn't.
  const buildChronoForModule = (langModule: {
    createCasualConfiguration?: (isGB: boolean) => unknown;
    casual?: Chrono;
    GB?: Chrono;
  } | undefined): Chrono | null => {
    if (!langModule) return null;
    if (langModule.casual) {
      // Clone so we don't mutate chrono-node's shared singleton instance
      // (multiple NLDParser instances would otherwise all push their own
      // ordinalDateParser onto the same shared object).
      const base = (isGB && langModule.GB) ? langModule.GB : langModule.casual;
      return base.clone();
    }
    if (langModule.createCasualConfiguration) {
      const config = langModule.createCasualConfiguration(isGB);
      // Chrono constructor accepts Configuration type - cast needed because createCasualConfiguration returns unknown
      return new Chrono(config as ChronoConfiguration);
    }
    return null;
  };

  languages.forEach(l => {
    try {
      // On accède aux langues dynamiquement via Record
      const langModule = (chrono as Record<string, unknown>)[l] as {
        createCasualConfiguration?: (isGB: boolean) => unknown;
        casual?: Chrono;
        GB?: Chrono;
      } | undefined;
      const c = buildChronoForModule(langModule);
      if (!c) {
        logger.warn(`Language is not supported by chrono-node`, { language: l });
        return;
      }
      c.parsers.push(ordinalDateParser);
      chronos.push(c);
      logger.debug("Chrono initialized for language", { language: l });
    } catch (error) {
      logger.error(`Failed to initialize chrono for language`, {
        language: l,
        error: describeError(error),
      });
    }
  });

  // Si aucune langue n'a pu être initialisée, utiliser l'anglais par défaut
  if (chronos.length === 0) {
    logger.warn('No languages could be initialized, attempting English fallback');
    try {
      const enModule = (chrono as Record<string, unknown>).en as {
        createCasualConfiguration?: (isGB: boolean) => unknown;
        casual?: Chrono;
        GB?: Chrono;
      } | undefined;
      const c = buildChronoForModule(enModule);
      if (c) {
        c.parsers.push(ordinalDateParser);
        chronos.push(c);
        logger.info('Default English chrono initialized successfully');
      } else {
        logger.error('English chrono module not available');
      }
    } catch (error) {
      logger.error('Failed to initialize default English chrono', {
        error: describeError(error),
      });
    }
  }

  return chronos;
}