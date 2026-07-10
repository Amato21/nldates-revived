import { describe, it, expect } from "vitest";
import { DateFormatter } from "../src/date-formatter";

describe("DateFormatter", () => {
  const sampleDate = new Date(2025, 0, 6, 15, 30); // Jan 6, 2025, 15:30

  it("format() formats a date according to a Moment.js format string", () => {
    expect(DateFormatter.format(sampleDate, "YYYY-MM-DD")).toBe("2025-01-06");
  });

  it("format() supports different format strings", () => {
    expect(DateFormatter.format(sampleDate, "DD/MM/YYYY")).toBe("06/01/2025");
    expect(DateFormatter.format(sampleDate, "MMMM Do, YYYY")).toBe("January 6th, 2025");
  });

  it("formatWithTime() joins date and time with the default separator", () => {
    expect(DateFormatter.formatWithTime(sampleDate, "YYYY-MM-DD", "HH:mm")).toBe("2025-01-06 15:30");
  });

  it("formatWithTime() supports a custom separator", () => {
    expect(DateFormatter.formatWithTime(sampleDate, "YYYY-MM-DD", "HH:mm", " | ")).toBe("2025-01-06 | 15:30");
  });

  it("formatWithTime() supports an empty separator", () => {
    expect(DateFormatter.formatWithTime(sampleDate, "YYYY-MM-DD", "HH:mm", "")).toBe("2025-01-0615:30");
  });
});
