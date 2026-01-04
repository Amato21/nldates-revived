import * as momentNS from 'moment';
import moment from 'moment';

// Initialiser window.moment pour les tests
// Essayer différentes façons d'accéder à moment selon le format d'import
let momentFn: any = moment;
if (typeof moment !== 'function' && (momentNS as any).default) {
  momentFn = (momentNS as any).default;
}

(globalThis as any).window = (globalThis as any).window || {};
(globalThis as any).window.moment = momentFn;
