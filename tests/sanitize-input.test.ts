import { describe, it, expect } from "vitest";
import { sanitizeInput, validateUriParam } from "../src/utils";

describe("sanitizeInput", () => {
  it("accepts Japanese input", () => {
    expect(sanitizeInput("今日")).toBe("今日");
  });

  it("accepts Traditional Chinese input", () => {
    expect(sanitizeInput("下一個星期一")).toBe("下一個星期一");
  });

  it("accepts Russian input", () => {
    expect(sanitizeInput("следующая неделя")).toBe("следующая неделя");
  });

  it("accepts Ukrainian input with an apostrophe", () => {
    const input = "з Понеділка до П'ятниці";
    expect(sanitizeInput(input)).toBe(input);
  });

  it("accepts French input with an apostrophe", () => {
    expect(sanitizeInput("Aujourd'hui")).toBe("Aujourd'hui");
  });

  it("still accepts plain English input", () => {
    expect(sanitizeInput("tomorrow")).toBe("tomorrow");
  });

  it("rejects angle brackets", () => {
    expect(sanitizeInput("<script>alert(1)</script>")).toBeNull();
  });

  it("rejects backticks", () => {
    const backtick = String.fromCharCode(96);
    expect(sanitizeInput("today" + backtick + "evil" + backtick)).toBeNull();
  });

  it("rejects control characters", () => {
    const bell = String.fromCharCode(7);
    expect(sanitizeInput("today" + bell + "tomorrow")).toBeNull();
  });

  it("rejects null/undefined/empty input", () => {
    expect(sanitizeInput(null)).toBeNull();
    expect(sanitizeInput(undefined)).toBeNull();
    expect(sanitizeInput("   ")).toBeNull();
  });

  it("truncates to maxLength", () => {
    const long = "a".repeat(300);
    expect(sanitizeInput(long, 200)?.length).toBe(200);
  });
});

describe("validateUriParam", () => {
  it("accepts non-Latin scripts through the URI validation path used by main.ts", () => {
    expect(validateUriParam("今日")).toBe("今日");
    expect(validateUriParam("следующая неделя")).toBe("следующая неделя");
  });
});
