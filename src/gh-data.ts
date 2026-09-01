import type {
	CheckRun,
	CheckState,
	Comment,
	ExecFn,
	FileChange,
	IssueDetail,
	IssueSummary,
	MergeMethod,
	PullRequestDetail,
	PullRequestSummary,
	Result,
	Review,
	ReviewState,
} from "./types.ts";

export type GhResult<T> = Result<T>;

interface RawActor {
	login?: string;
	name?: string;
}

interface RawLabel {
	name: string;
}

interface RawComment {
	author?: RawActor;
	body?: string;
	createdAt?: string;
}

interface RawCheckRun {
	__typename?: string;
	name?: string;
	context?: string;
	status?: string;
	conclusion?: string | null;
	state?: string;
}

interface RawReview {
	author?: RawActor;
	state?: string;
}

interface RawFile {
	path: string;
	additions: number;
	deletions: number;
}

interface RawPrListItem {
	number: number;
	title: string;
	author?: RawActor;
	isDraft?: boolean;
	updatedAt: string;
	statusCheckRollup?: RawCheckRun[];
	latestReviews?: RawReview[];
}

interface RawIssueListItem {
	number: number;
	title: string;
	author?: RawActor;
	updatedAt: string;
	comments?: RawComment[];
	labels?: RawLabel[];
}

interface RawPrDetail {
	number: number;
	title: string;
	author?: RawActor;
	state: string;
	isDraft?: boolean;
	labels?: RawLabel[];
	assignees?: RawActor[];
	createdAt: string;
	updatedAt: string;
	body?: string;
	comments?: RawComment[];
	baseRefName: string;
	headRefName: string;
	statusCheckRollup?: RawCheckRun[];
	latestReviews?: RawReview[];
	files?: RawFile[];
}

interface RawIssueDetail {
	number: number;
	title: string;
	author?: RawActor;
	state: string;
	labels?: RawLabel[];
	assignees?: RawActor[];
	createdAt: string;
	updatedAt: string;
	body?: string;
	comments?: RawComment[];
}

interface RawRepoView {
	squashMergeAllowed?: boolean;
	mergeCommitAllowed?: boolean;
	rebaseMergeAllowed?: boolean;
}

function actorLogin(actor: RawActor | undefined): string {
	return actor?.login ?? "unknown";
}

function mapCheck(check: RawCheckRun): CheckRun {
	const name = check.name ?? check.context ?? "check";
	if (check.status !== undefined) {
		// CheckRun: status is QUEUED | IN_PROGRESS | COMPLETED; conclusion set once COMPLETED.
		if (check.status !== "COMPLETED") return { name, state: "pending" };
		const conclusion = (check.conclusion ?? "").toUpperCase();
		if (conclusion === "SUCCESS" || conclusion === "NEUTRAL" || conclusion === "SKIPPED") {
			return { name, state: "pass" };
		}
		return { name, state: "fail" };
	}
	// StatusContext: state is SUCCESS | PENDING | FAILURE | ERROR.
	const state = (check.state ?? "").toUpperCase();
	if (state === "SUCCESS") return { name, state: "pass" };
	if (state === "PENDING" || state === "EXPECTED") return { name, state: "pending" };
	return { name, state: "fail" };
}

function overallCheckState(rollup: RawCheckRun[] | undefined): CheckState | "none" {
	if (!rollup || rollup.length === 0) return "none";
	const mapped = rollup.map(mapCheck);
	if (mapped.some((c) => c.state === "fail")) return "fail";
	if (mapped.some((c) => c.state === "pending")) return "pending";
	return "pass";
}

function reviewCounts(reviews: RawReview[] | undefined): { approvals: number; changesRequested: number } {
	const list = reviews ?? [];
	return {
		approvals: list.filter((r) => r.state === "APPROVED").length,
		changesRequested: list.filter((r) => r.state === "CHANGES_REQUESTED").length,
	};
}

async function runGhJson<T>(exec: ExecFn, args: string[], cwd: string): Promise<GhResult<T>> {
	const result = await exec("gh", args, { cwd, timeout: 15_000 });
	if (result.code !== 0) {
		return { ok: false, error: result.stderr.trim() || `gh exited with code ${result.code}` };
	}
	try {
		return { ok: true, data: JSON.parse(result.stdout) as T };
	} catch {
		return { ok: false, error: "Failed to parse gh output as JSON." };
	}
}

export async function fetchPullRequests(
	exec: ExecFn,
	options: { repo: string; cwd: string; limit: number },
): Promise<GhResult<PullRequestSummary[]>> {
	const result = await runGhJson<RawPrListItem[]>(
		exec,
		[
			"pr",
			"list",
			"--repo",
			options.repo,
			"--state",
			"open",
			"--search",
			"sort:updated-desc",
			"--limit",
			String(options.limit),
			"--json",
			"number,title,author,updatedAt,isDraft,statusCheckRollup,latestReviews",
		],
		options.cwd,
	);
	if (!result.ok) return result;

	const items: PullRequestSummary[] = result.data
		.map((pr) => {
			const { approvals, changesRequested } = reviewCounts(pr.latestReviews);
			return {
				number: pr.number,
				title: pr.title,
				author: actorLogin(pr.author),
				isDraft: pr.isDraft ?? false,
				checkState: overallCheckState(pr.statusCheckRollup),
				approvals,
				changesRequested,
				updatedAt: pr.updatedAt,
			};
		})
		.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

	return { ok: true, data: items };
}

export async function fetchIssues(
	exec: ExecFn,
	options: { repo: string; cwd: string; limit: number },
): Promise<GhResult<IssueSummary[]>> {
	const result = await runGhJson<RawIssueListItem[]>(
		exec,
		[
			"issue",
			"list",
			"--repo",
			options.repo,
			"--state",
			"open",
			"--search",
			"sort:updated-desc",
			"--limit",
			String(options.limit),
			"--json",
			"number,title,author,updatedAt,comments,labels",
		],
		options.cwd,
	);
	if (!result.ok) return result;

	const items: IssueSummary[] = result.data
		.map((issue) => ({
			number: issue.number,
			title: issue.title,
			author: actorLogin(issue.author),
			commentCount: issue.comments?.length ?? 0,
			labels: (issue.labels ?? []).map((l) => l.name),
			updatedAt: issue.updatedAt,
		}))
		.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

	return { ok: true, data: items };
}

function mapComment(comment: RawComment): Comment {
	return {
		author: actorLogin(comment.author),
		body: comment.body ?? "",
		createdAt: comment.createdAt ?? "",
	};
}

export async function fetchPullRequestDetail(
	exec: ExecFn,
	options: { repo: string; cwd: string; number: number },
): Promise<GhResult<PullRequestDetail>> {
	const result = await runGhJson<RawPrDetail>(
		exec,
		[
			"pr",
			"view",
			String(options.number),
			"--repo",
			options.repo,
			"--json",
			"number,title,author,state,isDraft,labels,assignees,createdAt,updatedAt,body,comments,baseRefName,headRefName,statusCheckRollup,latestReviews,files",
		],
		options.cwd,
	);
	if (!result.ok) return result;

	const pr = result.data;
	const reviews: Review[] = (pr.latestReviews ?? [])
		.filter((r) => r.state && r.state !== "PENDING" && r.state !== "COMMENTED")
		.map((r) => ({ author: actorLogin(r.author), state: (r.state as ReviewState) ?? "PENDING" }));

	return {
		ok: true,
		data: {
			number: pr.number,
			title: pr.title,
			author: actorLogin(pr.author),
			state: pr.state,
			isDraft: pr.isDraft ?? false,
			labels: (pr.labels ?? []).map((l) => l.name),
			assignees: (pr.assignees ?? []).map(actorLogin),
			createdAt: pr.createdAt,
			updatedAt: pr.updatedAt,
			body: pr.body ?? "",
			comments: (pr.comments ?? []).map(mapComment),
			baseRefName: pr.baseRefName,
			headRefName: pr.headRefName,
			checks: (pr.statusCheckRollup ?? []).map(mapCheck),
			reviews,
			files: (pr.files ?? []).map((f: FileChange) => ({ path: f.path, additions: f.additions, deletions: f.deletions })),
		},
	};
}

export async function fetchIssueDetail(
	exec: ExecFn,
	options: { repo: string; cwd: string; number: number },
): Promise<GhResult<IssueDetail>> {
	const result = await runGhJson<RawIssueDetail>(
		exec,
		[
			"issue",
			"view",
			String(options.number),
			"--repo",
			options.repo,
			"--json",
			"number,title,author,state,labels,assignees,createdAt,updatedAt,body,comments",
		],
		options.cwd,
	);
	if (!result.ok) return result;

	const issue = result.data;
	return {
		ok: true,
		data: {
			number: issue.number,
			title: issue.title,
			author: actorLogin(issue.author),
			state: issue.state,
			labels: (issue.labels ?? []).map((l) => l.name),
			assignees: (issue.assignees ?? []).map(actorLogin),
			createdAt: issue.createdAt,
			updatedAt: issue.updatedAt,
			body: issue.body ?? "",
			comments: (issue.comments ?? []).map(mapComment),
		},
	};
}

export async function getAllowedMergeMethods(
	exec: ExecFn,
	options: { repo: string; cwd: string },
): Promise<GhResult<MergeMethod[]>> {
	const result = await runGhJson<RawRepoView>(
		exec,
		["repo", "view", options.repo, "--json", "squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed"],
		options.cwd,
	);
	if (!result.ok) return result;

	const methods: MergeMethod[] = [];
	if (result.data.squashMergeAllowed) methods.push("squash");
	if (result.data.mergeCommitAllowed) methods.push("merge");
	if (result.data.rebaseMergeAllowed) methods.push("rebase");

	return { ok: true, data: methods };
}

export async function getCurrentAccount(exec: ExecFn, cwd: string): Promise<string | undefined> {
	const result = await exec("gh", ["api", "user", "--jq", ".login"], { cwd, timeout: 10_000 });
	if (result.code !== 0) return undefined;
	const login = result.stdout.trim();
	return login.length > 0 ? login : undefined;
}

export async function approvePullRequest(
	exec: ExecFn,
	options: { repo: string; cwd: string; number: number },
): Promise<GhResult<true>> {
	const result = await exec("gh", ["pr", "review", String(options.number), "--repo", options.repo, "--approve"], {
		cwd: options.cwd,
		timeout: 15_000,
	});
	if (result.code !== 0) {
		return { ok: false, error: result.stderr.trim() || `gh exited with code ${result.code}` };
	}
	return { ok: true, data: true };
}

const MERGE_FLAG: Record<MergeMethod, string> = {
	squash: "--squash",
	merge: "--merge",
	rebase: "--rebase",
};

export async function mergePullRequest(
	exec: ExecFn,
	options: { repo: string; cwd: string; number: number; method: MergeMethod },
): Promise<GhResult<true>> {
	const result = await exec(
		"gh",
		["pr", "merge", String(options.number), "--repo", options.repo, MERGE_FLAG[options.method]],
		{ cwd: options.cwd, timeout: 30_000 },
	);
	if (result.code !== 0) {
		return { ok: false, error: result.stderr.trim() || `gh exited with code ${result.code}` };
	}
	return { ok: true, data: true };
}
