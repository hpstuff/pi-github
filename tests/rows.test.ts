import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import {
	buildIssueRowPlan,
	buildPrRowPlan,
	layoutIssueRowLines,
	layoutPrRowLines,
	prStatusColor,
} from "../src/ui/rows.ts";
import type { IssueSummary, PullRequestSummary } from "../src/types.ts";

const now = new Date("2026-09-01T12:00:00Z");

const basePr: PullRequestSummary = {
	number: 42,
	title: "Fix the login bug that was very very long indeed",
	author: "alice",
	isDraft: false,
	checkState: "pass",
	approvals: 2,
	changesRequested: 0,
	updatedAt: "2026-09-01T09:00:00Z",
};

const baseIssue: IssueSummary = {
	number: 7,
	title: "Crash on startup when config is missing entirely somehow",
	author: "bob",
	commentCount: 3,
	labels: ["bug", "p1"],
	updatedAt: "2026-09-01T10:00:00Z",
};

describe("buildPrRowPlan / layoutPrRowLines", () => {
	it("puts the check symbol and title on the first line, and number/author/time on the second", () => {
		const plan = buildPrRowPlan(basePr, now);
		const { symbol, title, meta } = layoutPrRowLines(plan, 100);
		expect(symbol).toBe("✓");
		expect(title).toContain("Fix the login bug");
		expect(meta).toContain("#42");
		expect(meta).toContain("@alice");
		expect(meta).toContain("3h ago");
	});

	it("shows a draft indicator on the title only when the PR is a draft", () => {
		const draft = layoutPrRowLines(buildPrRowPlan({ ...basePr, isDraft: true }, now), 100);
		expect(draft.title).toContain("draft");

		const ready = layoutPrRowLines(buildPrRowPlan({ ...basePr, isDraft: false }, now), 100);
		expect(ready.title).not.toContain("draft");
	});

	it("shows review counts in the meta line", () => {
		const { meta } = layoutPrRowLines(buildPrRowPlan({ ...basePr, approvals: 2, changesRequested: 1 }, now), 100);
		expect(meta).toContain("2");
		expect(meta).toContain("1");
	});

	it("never lets the title or meta line exceed the requested width", () => {
		const { title, meta } = layoutPrRowLines(buildPrRowPlan(basePr, now), 40);
		expect(visibleWidth(title)).toBeLessThanOrEqual(40);
		expect(visibleWidth(meta)).toBeLessThanOrEqual(40);
	});

	it("maps check state to a status color key", () => {
		expect(prStatusColor(buildPrRowPlan({ ...basePr, checkState: "fail" }, now))).toBe("error");
		expect(prStatusColor(buildPrRowPlan({ ...basePr, checkState: "pending" }, now))).toBe("warning");
		expect(prStatusColor(buildPrRowPlan({ ...basePr, checkState: "pass" }, now))).toBe("success");
		expect(prStatusColor(buildPrRowPlan({ ...basePr, checkState: "none" }, now))).toBe("warning");
	});
});

describe("buildIssueRowPlan / layoutIssueRowLines", () => {
	it("puts the title on the first line, and number/author/comments/labels/time on the second", () => {
		const { title, meta } = layoutIssueRowLines(buildIssueRowPlan(baseIssue, now), 100);
		expect(title).toContain("Crash on startup");
		expect(meta).toContain("#7");
		expect(meta).toContain("@bob");
		expect(meta).toContain("3");
		expect(meta).toContain("bug");
		expect(meta).toContain("p1");
		expect(meta).toContain("2h ago");
	});

	it("never lets the title or meta line exceed the requested width", () => {
		const { title, meta } = layoutIssueRowLines(buildIssueRowPlan(baseIssue, now), 30);
		expect(visibleWidth(title)).toBeLessThanOrEqual(30);
		expect(visibleWidth(meta)).toBeLessThanOrEqual(30);
	});
});
