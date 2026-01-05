import * as momentNS from 'moment';
import moment from 'moment';

// Initialize window.moment for tests
// Try different ways to access moment according to import format
let momentFn: any = moment;
if (typeof moment !== 'function' && (momentNS as any).default) {
  momentFn = (momentNS as any).default;
}

(globalThis as any).window = (globalThis as any).window || {};
(globalThis as any).window.moment = momentFn;
