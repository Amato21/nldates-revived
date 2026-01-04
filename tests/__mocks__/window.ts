// Mock global pour window.moment
import * as moment from 'moment';

// Définir window.moment dès l'importation de ce fichier
if (typeof global !== 'undefined') {
  (global as any).window = (global as any).window || {};
  (global as any).window.moment = moment;
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.moment = moment;
}

