import { describe, expect, it } from "vitest";
import { relativeTime } from "../src/format.ts";

describe("relativeTime", () => {
	const now = new Date("2026-09-01T12:00:00Z");

	it("formats seconds", () => {
		expect(relativeTime("2026-09-01T11:59:30Z", now)).toBe("30s ago");
	});

	it("formats minutes", () => {
		expect(relativeTime("2026-09-01T11:45:00Z", now)).toBe("15m ago");
	});

	it("formats hours", () => {
		expect(relativeTime("2026-09-01T09:00:00Z", now)).toBe("3h ago");
	});

	it("formats days", () => {
		expect(relativeTime("2026-08-29T12:00:00Z", now)).toBe("3d ago");
	});

	it("formats months", () => {
		expect(relativeTime("2026-06-01T12:00:00Z", now)).toBe("3mo ago");
	});

	it("formats years", () => {
		expect(relativeTime("2024-09-01T12:00:00Z", now)).toBe("2y ago");
	});

	it("formats just now for sub-second differences", () => {
		expect(relativeTime("2026-09-01T12:00:00Z", now)).toBe("just now");
	});
});
