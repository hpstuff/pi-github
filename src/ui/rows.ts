import { truncateToWidth } from "@earendil-works/pi-tui";
import { relativeTime } from "../format.ts";
import type { CheckState, IssueSummary, PullRequestSummary } from "../types.ts";

export interface PrRowPlan {
	number: number;
	title: string;
	author: string;
	isDraft: boolean;
	checkState: CheckState | "none";
	approvals: number;
	changesRequested: number;
	updated: string;
}

export interface IssueRowPlan {
	number: number;
	title: string;
	author: string;
	commentCount: number;
	labels: string[];
	updated: string;
}

const CHECK_SYMBOL: Record<CheckState | "none", string> = {
	pass: "✓",
	fail: "✗",
	pending: "●",
	none: "·",
};

const CHECK_COLOR: Record<CheckState | "none", "success" | "error" | "warning" | "dim"> = {
	pass: "success",
	fail: "error",
	pending: "warning",
	none: "dim",
};

export function buildPrRowPlan(pr: PullRequestSummary, now: Date = new Date()): PrRowPlan {
	return {
		number: pr.number,
		title: pr.title,
		author: pr.author,
		isDraft: pr.isDraft,
		checkState: pr.checkState,
		approvals: pr.approvals,
		changesRequested: pr.changesRequested,
		updated: relativeTime(pr.updatedAt, now),
	};
}

export function buildIssueRowPlan(issue: IssueSummary, now: Date = new Date()): IssueRowPlan {
	return {
		number: issue.number,
		title: issue.title,
		author: issue.author,
		commentCount: issue.commentCount,
		labels: issue.labels,
		updated: relativeTime(issue.updatedAt, now),
	};
}

export function prStatusColor(plan: PrRowPlan): "success" | "error" | "warning" | "dim" {
	return CHECK_COLOR[plan.checkState];
}

/** Lays out a PR row as plain text: "#num check [draft] title  @author ✓a/✗c  updated". Never exceeds `width`. */
export function layoutPrRow(plan: PrRowPlan, width: number): string {
	const prefix = `#${plan.number} ${CHECK_SYMBOL[plan.checkState]}${plan.isDraft ? " [draft]" : ""} `;
	const suffix = ` @${plan.author}  ✓${plan.approvals}/✗${plan.changesRequested}  ${plan.updated}`;
	const titleWidth = Math.max(1, width - prefix.length - suffix.length);
	const title = truncateToWidth(plan.title, titleWidth);
	return truncateToWidth(`${prefix}${title}${suffix}`, width);
}

/** Lays out an Issue row as plain text: "#num title  @author 💬n labels  updated". Never exceeds `width`. */
export function layoutIssueRow(plan: IssueRowPlan, width: number): string {
	const prefix = `#${plan.number} `;
	const labels = plan.labels.length > 0 ? ` ${plan.labels.join(",")}` : "";
	const suffix = ` @${plan.author}  💬${plan.commentCount}${labels}  ${plan.updated}`;
	const titleWidth = Math.max(1, width - prefix.length - suffix.length);
	const title = truncateToWidth(plan.title, titleWidth);
	return truncateToWidth(`${prefix}${title}${suffix}`, width);
}
