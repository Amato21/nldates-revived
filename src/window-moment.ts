// Obsidian bundles moment.js and exposes it as window.moment at runtime.
// Its type is declared globally via "declare global" in types.d.ts, which
// works fine for whole-project type-checking (this project's own tsconfig,
// tests, build) but not for tools that type-check files in isolation --
// those never see the ambient augmentation from that separate file, so
// every window.moment usage silently resolves to `any` there, cascading
// into unsafe-* lint warnings on every line that touches its return value.
//
// Re-exporting through a real ES import sidesteps that: a module import's
// type is resolved from this file's own declared type regardless of ambient
// declaration visibility elsewhere.
//
// Uses a Proxy instead of capturing window.moment directly at module-load
// time, so later mutations of window.moment are still reflected -- some
// tests intentionally monkey-patch window.moment mid-test (to exercise
// error-handling branches around a throwing .format()), and a plain
// captured reference would keep pointing at the pre-mock function.
const moment: typeof import("moment") = new Proxy(
  ((): undefined => undefined) as unknown as typeof import("moment"),
  {
    apply: (_target, thisArg, args: unknown[]) =>
      Reflect.apply(window.moment as unknown as (...a: unknown[]) => unknown, thisArg, args),
    get: (_target, prop, receiver): unknown => Reflect.get(window.moment, prop, receiver),
  }
);

export default moment;
