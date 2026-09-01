export interface ExecResult {
	stdout: string;
	stderr: string;
	code: number;
	killed: boolean;
}

export interface ExecOptions {
	signal?: AbortSignal;
	timeout?: number;
	cwd?: string;
}

export type ExecFn = (command: string, args: string[], options?: ExecOptions) => Promise<ExecResult>;

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export interface Actor {
	login: string;
	name?: string;
}

export interface Label {
	name: string;
	color?: string;
}

export interface Comment {
	author: string;
	body: string;
	createdAt: string;
}

export type CheckState = "pass" | "fail" | "pending";

export interface CheckRun {
	name: string;
	state: CheckState;
}

export type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";

export interface Review {
	author: string;
	state: ReviewState;
}

export interface FileChange {
	path: string;
	additions: number;
	deletions: number;
}

export interface PullRequestSummary {
	number: number;
	title: string;
	author: string;
	isDraft: boolean;
	checkState: CheckState | "none";
	approvals: number;
	changesRequested: number;
	updatedAt: string;
}

export interface IssueSummary {
	number: number;
	title: string;
	author: string;
	commentCount: number;
	labels: string[];
	updatedAt: string;
}

export interface PullRequestDetail {
	number: number;
	title: string;
	author: string;
	state: string;
	isDraft: boolean;
	labels: string[];
	assignees: string[];
	createdAt: string;
	updatedAt: string;
	body: string;
	comments: Comment[];
	baseRefName: string;
	headRefName: string;
	checks: CheckRun[];
	reviews: Review[];
	files: FileChange[];
}

export interface IssueDetail {
	number: number;
	title: string;
	author: string;
	state: string;
	labels: string[];
	assignees: string[];
	createdAt: string;
	updatedAt: string;
	body: string;
	comments: Comment[];
}

export type MergeMethod = "squash" | "merge" | "rebase";
