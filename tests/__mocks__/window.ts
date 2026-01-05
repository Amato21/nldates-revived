// Global mock for window.moment
import * as moment from 'moment';

// Define window.moment as soon as this file is imported
if (typeof global !== 'undefined') {
  (global as any).window = (global as any).window || {};
  (global as any).window.moment = moment;
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.moment = moment;
}


