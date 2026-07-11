import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "../src/logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("debug() logs via console.debug with level DEBUG, no context", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logger.debug("hello");
    expect(spy).toHaveBeenCalledTimes(1);
    const message = spy.mock.calls[0][0] as string;
    expect(message).toContain("[DEBUG]");
    expect(message).toContain("hello");
    expect(message).not.toContain("Context:");
  });

  it("debug() includes JSON-serialized context when provided", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logger.debug("hello", { foo: "bar" });
    const message = spy.mock.calls[0][0] as string;
    expect(message).toContain('Context: {"foo":"bar"}');
  });

  it("info() logs via console.debug with level INFO", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logger.info("informational");
    const message = spy.mock.calls[0][0] as string;
    expect(message).toContain("[INFO]");
    expect(message).toContain("informational");
  });

  it("info() includes context when provided", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logger.info("informational", { language: "en" });
    const message = spy.mock.calls[0][0] as string;
    expect(message).toContain('Context: {"language":"en"}');
  });

  it("warn() logs via console.warn with level WARN", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("careful");
    expect(spy).toHaveBeenCalledTimes(1);
    const message = spy.mock.calls[0][0] as string;
    expect(message).toContain("[WARN]");
    expect(message).toContain("careful");
  });

  it("warn() includes context when provided", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("careful", { language: "zh" });
    const message = spy.mock.calls[0][0] as string;
    expect(message).toContain('Context: {"language":"zh"}');
  });

  it("error() logs via console.error with level ERROR", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("boom");
    expect(spy).toHaveBeenCalledTimes(1);
    const message = spy.mock.calls[0][0] as string;
    expect(message).toContain("[ERROR]");
    expect(message).toContain("boom");
  });

  it("error() includes context when provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("boom", { code: 500 });
    const message = spy.mock.calls[0][0] as string;
    expect(message).toContain('Context: {"code":500}');
  });

  it("each log entry starts with an ISO timestamp", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logger.debug("timed");
    const message = spy.mock.calls[0][0] as string;
    expect(message).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });
});
