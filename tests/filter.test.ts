import { describe, expect, it } from "vitest";
import { filterIssues, filterPullRequests } from "../src/ui/filter.ts";
import type { IssueSummary, PullRequestSummary } from "../src/types.ts";

const prs: PullRequestSummary[] = [
	{ number: 1, title: "Fix login bug", author: "a", isDraft: false, checkState: "pass", approvals: 0, changesRequested: 0, updatedAt: "2026-08-01T00:00:00Z" },
	{ number: 2, title: "Add dark mode toggle", author: "b", isDraft: false, checkState: "pass", approvals: 0, changesRequested: 0, updatedAt: "2026-08-01T00:00:00Z" },
];

const issues: IssueSummary[] = [
	{ number: 10, title: "Crash on startup", author: "a", commentCount: 0, labels: [], updatedAt: "2026-08-01T00:00:00Z" },
	{ number: 20, title: "Typo in README", author: "b", commentCount: 0, labels: [], updatedAt: "2026-08-01T00:00:00Z" },
];

describe("filterPullRequests", () => {
	it("returns everything for an empty query", () => {
		expect(filterPullRequests(prs, "")).toEqual(prs);
	});

	it("fuzzy-matches by title", () => {
		expect(filterPullRequests(prs, "dark").map((p) => p.number)).toEqual([2]);
	});

	it("matches by number", () => {
		expect(filterPullRequests(prs, "1").map((p) => p.number)).toEqual([1]);
	});

	it("returns nothing when nothing matches", () => {
		expect(filterPullRequests(prs, "zzzzz")).toEqual([]);
	});
});

describe("filterIssues", () => {
	it("fuzzy-matches by title", () => {
		expect(filterIssues(issues, "readme").map((i) => i.number)).toEqual([20]);
	});

	it("matches by number", () => {
		expect(filterIssues(issues, "10").map((i) => i.number)).toEqual([10]);
	});
});
