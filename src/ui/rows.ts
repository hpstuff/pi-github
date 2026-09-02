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

export interface PrRowLines {
  symbol: string;
  title: string;
  meta: string;
}

export interface IssueRowLines {
  title: string;
  meta: string;
}

const CHECK_SYMBOL: Record<CheckState | "none", string> = {
  pass: "✓",
  fail: "✗",
  pending: "●",
  none: "●",
};

const CHECK_COLOR: Record<CheckState | "none", "success" | "error" | "warning" | "dim"> = {
  pass: "success",
  fail: "error",
  pending: "warning",
  none: "warning",
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

/** Row indent used for the meta line, matching the "<symbol> " prefix width on the title line. */
const ROW_INDENT = 2;

/** Lays out a PR as two plain-text lines: title (with status symbol) and a dim meta line below it. Neither line exceeds `width`. */
export function layoutPrRowLines(plan: PrRowPlan, width: number): PrRowLines {
  const symbol = CHECK_SYMBOL[plan.checkState];
  const titleRaw = `${plan.title}${plan.isDraft ? "  [draft]" : ""}`;
  const title = truncateToWidth(titleRaw, Math.max(1, width - ROW_INDENT));
  const metaRaw = `#${plan.number} · @${plan.author} · ✓${plan.approvals}/✗${plan.changesRequested} · ${plan.updated}`;
  const meta = truncateToWidth(metaRaw, Math.max(1, width - ROW_INDENT));
  return { symbol, title, meta };
}

/** Lays out an Issue as two plain-text lines: title and a dim meta line below it. Neither line exceeds `width`. */
export function layoutIssueRowLines(plan: IssueRowPlan, width: number): IssueRowLines {
  const title = truncateToWidth(plan.title, width);
  const labels = plan.labels.length > 0 ? ` · ${plan.labels.join(",")}` : "";
  const metaRaw = `#${plan.number} · @${plan.author} · 💬${plan.commentCount}${labels} · ${plan.updated}`;
  const meta = truncateToWidth(metaRaw, width);
  return { title, meta };
}
