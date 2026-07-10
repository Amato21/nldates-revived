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

// Node's global setInterval/clearInterval aren't attached to the synthetic
// `window` object above, but plugin code (ContextAnalyzer, HistoryManager)
// calls window.setInterval/window.clearInterval for periodic cache cleanup.
(globalThis as any).window.setInterval = (globalThis as any).window.setInterval || setInterval;
(globalThis as any).window.clearInterval = (globalThis as any).window.clearInterval || clearInterval;

// Mock document for Node.js environment
if (typeof document === 'undefined') {
  (globalThis as any).document = {
    body: {
      classList: {
        contains: () => false,
        add: () => {},
        remove: () => {},
      },
    },
    head: {
      appendChild: () => {},
      removeChild: () => {},
    },
    getElementById: () => null,
    createElement: () => ({
      id: '',
      textContent: '',
      remove: () => {},
    }),
  };
}

// Mock KeyboardEvent for Node.js environment
if (typeof KeyboardEvent === 'undefined') {
  (globalThis as any).KeyboardEvent = class KeyboardEvent {
    type: string;
    key: string;
    preventDefault: () => void;
    target: any;

    constructor(type: string, options?: { key?: string }) {
      this.type = type;
      this.key = options?.key || '';
      this.preventDefault = () => {};
      this.target = null;
    }
  };
}

// Mock HTMLInputElement and HTMLSelectElement for Node.js environment
if (typeof HTMLInputElement === 'undefined') {
  (globalThis as any).HTMLInputElement = class HTMLInputElement {};
  (globalThis as any).HTMLSelectElement = class HTMLSelectElement {};
}