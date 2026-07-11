import "./setup";
import { describe, it, expect } from "vitest";
import * as chrono from "chrono-node";
import { TimeDetector, TimeDetectorDependencies } from "../src/time-detector";

function makeDetector(overrides: Partial<TimeDetectorDependencies> = {}): TimeDetector {
  const deps: TimeDetectorDependencies = {
    languages: ["en"],
    chronos: [chrono.en.casual.clone()],
    immediateKeywords: new Set(["now"]),
    regexRelative: /^in (\d+) (\w+)$/i,
    regexRelativeCombined: /^in (\d+) (\w+) and (\d+) (\w+)$/i,
    regexWeekday: /^(next|last|this) (\w+)$/i,
    regexWeekdayWithTime: /^(next|last|this) (\w+) at (.+)$/i,
    ...overrides,
  };
  return new TimeDetector(deps);
}

describe("TimeDetector.hasTimeComponent", () => {
  it("returns true for 'now' in the configured language", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("now")).toBe(true);
  });

  it("returns true for a combined relative expression with an hour/minute unit", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("in 2 hours and 3 min")).toBe(true);
  });

  it("returns false for a combined relative expression with only day/week units", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("in 2 days and 3 weeks")).toBe(false);
  });

  it("returns true for a simple relative expression in hours or minutes", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("in 5 hours")).toBe(true);
    expect(detector.hasTimeComponent("in 5 min")).toBe(true);
  });

  it("returns false for a simple relative expression in days/weeks/months/years", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("in 5 days")).toBe(false);
  });

  it("returns true for a specific weekday with an explicit time", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("next monday at 3pm")).toBe(true);
  });

  it("returns false for a specific weekday without a time", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("next monday")).toBe(false);
  });

  it("returns false for today/tomorrow/yesterday keywords", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("tomorrow")).toBe(false);
    expect(detector.hasTimeComponent("today")).toBe(false);
    expect(detector.hasTimeComponent("yesterday")).toBe(false);
  });

  it("asks chrono-node for unmatched text, returning true when it's certain about hour/minute", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("March 15th 2027 at 5pm")).toBe(true);
  });

  it("returns false when chrono-node parses the text but isn't certain about hour/minute", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("March 15th 2027")).toBe(false);
  });

  it("returns false when chrono-node finds nothing at all", () => {
    const detector = makeDetector();
    expect(detector.hasTimeComponent("completely unrelated gibberish text")).toBe(false);
  });

  it("returns false when there are no chronos configured", () => {
    const detector = makeDetector({ chronos: undefined as unknown as chrono.Chrono[] });
    expect(detector.hasTimeComponent("completely unrelated gibberish text")).toBe(false);
  });

  it("swallows a chrono-node parsing error and keeps checking the remaining chronos", () => {
    const throwingChrono = { parse: () => { throw new Error("boom"); } } as unknown as chrono.Chrono;
    const workingChrono = chrono.en.casual.clone();
    const detector = makeDetector({ chronos: [throwingChrono, workingChrono] });
    expect(detector.hasTimeComponent("March 15th 2027 at 5pm")).toBe(true);
  });
});
