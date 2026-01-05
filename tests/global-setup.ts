import * as moment from 'moment';

// Define window.moment IMMEDIATELY, not in the async function
// because the async function executes after module loading
if (typeof globalThis !== 'undefined') {
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.moment = moment;
}

if (typeof global !== 'undefined') {
  (global as any).window = (global as any).window || {};
  (global as any).window.moment = moment;
}

export default async () => {
  // This hook runs before all tests
  // Reassure that window.moment is available
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.moment = moment;
  }
  if (typeof global !== 'undefined') {
    (global as any).window = (global as any).window || {};
    (global as any).window.moment = moment;
  }
};


