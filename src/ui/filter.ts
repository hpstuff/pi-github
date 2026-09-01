import { fuzzyFilter } from "@earendil-works/pi-tui";
import type { IssueSummary, PullRequestSummary } from "../types.ts";

export function filterPullRequests(items: PullRequestSummary[], query: string): PullRequestSummary[] {
	if (!query.trim()) return items;
	return fuzzyFilter(items, query, (pr) => `${pr.number} ${pr.title}`);
}

export function filterIssues(items: IssueSummary[], query: string): IssueSummary[] {
	if (!query.trim()) return items;
	return fuzzyFilter(items, query, (issue) => `${issue.number} ${issue.title}`);
}
