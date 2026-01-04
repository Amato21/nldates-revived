import * as moment from 'moment';

// Définir window.moment IMMÉDIATEMENT, pas dans la fonction async
// car la fonction async s'exécute après le chargement des modules
if (typeof globalThis !== 'undefined') {
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.moment = moment;
}

if (typeof global !== 'undefined') {
  (global as any).window = (global as any).window || {};
  (global as any).window.moment = moment;
}

export default async () => {
  // Ce hook s'exécute avant tous les tests
  // Réassurer que window.moment est disponible
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).window = (globalThis as any).window || {};
    (globalThis as any).window.moment = moment;
  }
  if (typeof global !== 'undefined') {
    (global as any).window = (global as any).window || {};
    (global as any).window.moment = moment;
  }
};


