import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import {
	buildIssueRowPlan,
	buildPrRowPlan,
	layoutIssueRow,
	layoutPrRow,
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

describe("buildPrRowPlan / layoutPrRow", () => {
	it("includes number, title, author, check state, and updated time", () => {
		const plan = buildPrRowPlan(basePr, now);
		const line = layoutPrRow(plan, 100);
		expect(line).toContain("#42");
		expect(line).toContain("@alice");
		expect(line).toContain("3h ago");
		expect(line).toContain("✓");
	});

	it("shows a draft indicator only when the PR is a draft", () => {
		const draftLine = layoutPrRow(buildPrRowPlan({ ...basePr, isDraft: true }, now), 100);
		expect(draftLine).toContain("draft");

		const readyLine = layoutPrRow(buildPrRowPlan({ ...basePr, isDraft: false }, now), 100);
		expect(readyLine).not.toContain("draft");
	});

	it("shows review counts", () => {
		const line = layoutPrRow(buildPrRowPlan({ ...basePr, approvals: 2, changesRequested: 1 }, now), 100);
		expect(line).toContain("2");
		expect(line).toContain("1");
	});

	it("never exceeds the requested width, truncating the title", () => {
		const line = layoutPrRow(buildPrRowPlan(basePr, now), 40);
		expect(visibleWidth(line)).toBeLessThanOrEqual(40);
	});

	it("maps check state to a status color key", () => {
		expect(prStatusColor(buildPrRowPlan({ ...basePr, checkState: "fail" }, now))).toBe("error");
		expect(prStatusColor(buildPrRowPlan({ ...basePr, checkState: "pending" }, now))).toBe("warning");
		expect(prStatusColor(buildPrRowPlan({ ...basePr, checkState: "pass" }, now))).toBe("success");
		expect(prStatusColor(buildPrRowPlan({ ...basePr, checkState: "none" }, now))).toBe("dim");
	});
});

describe("buildIssueRowPlan / layoutIssueRow", () => {
	it("includes number, title, author, comment count, labels, and updated time", () => {
		const line = layoutIssueRow(buildIssueRowPlan(baseIssue, now), 100);
		expect(line).toContain("#7");
		expect(line).toContain("@bob");
		expect(line).toContain("3");
		expect(line).toContain("bug");
		expect(line).toContain("p1");
		expect(line).toContain("2h ago");
	});

	it("never exceeds the requested width", () => {
		const line = layoutIssueRow(buildIssueRowPlan(baseIssue, now), 30);
		expect(visibleWidth(line)).toBeLessThanOrEqual(30);
	});
});
