import { describe, expect, it, vi } from "vitest";
import {
	approvePullRequest,
	fetchIssueDetail,
	fetchIssues,
	fetchPullRequestDetail,
	fetchPullRequests,
	getAllowedMergeMethods,
	getCurrentAccount,
	mergePullRequest,
} from "../src/gh-data.ts";
import type { ExecFn, ExecResult } from "../src/types.ts";

function jsonExec(stdout: unknown): ExecFn {
	return async () => ({ stdout: JSON.stringify(stdout), stderr: "", code: 0, killed: false });
}

function failingExec(stderr: string, code = 1): ExecFn {
	return async () => ({ stdout: "", stderr, code, killed: false });
}

const ok = (over: Partial<ExecResult> = {}): ExecResult => ({ stdout: "", stderr: "", code: 0, killed: false, ...over });

describe("fetchPullRequests", () => {
	it("maps fields, computes check state, review counts, and sorts most-recently-updated first", async () => {
		const exec = jsonExec([
			{
				number: 1,
				title: "Older PR",
				author: { login: "alice" },
				isDraft: false,
				updatedAt: "2026-08-01T00:00:00Z",
				statusCheckRollup: [{ __typename: "CheckRun", status: "COMPLETED", conclusion: "SUCCESS", name: "build" }],
				latestReviews: [{ author: { login: "bob" }, state: "APPROVED" }],
			},
			{
				number: 2,
				title: "Newer PR",
				author: { login: "carol" },
				isDraft: true,
				updatedAt: "2026-08-15T00:00:00Z",
				statusCheckRollup: [{ __typename: "CheckRun", status: "IN_PROGRESS", name: "build" }],
				latestReviews: [{ author: { login: "dave" }, state: "CHANGES_REQUESTED" }],
			},
		]);

		const result = await fetchPullRequests(exec, { repo: "owner/repo", cwd: "/repo", limit: 20 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.data.map((pr) => pr.number)).toEqual([2, 1]);
		expect(result.data[0]).toMatchObject({
			number: 2,
			title: "Newer PR",
			author: "carol",
			isDraft: true,
			checkState: "pending",
			changesRequested: 1,
			approvals: 0,
		});
		expect(result.data[1]).toMatchObject({
			checkState: "pass",
			approvals: 1,
			changesRequested: 0,
		});
	});

	it("reports checkState 'none' when there are no checks", async () => {
		const exec = jsonExec([
			{ number: 1, title: "PR", author: { login: "a" }, updatedAt: "2026-08-01T00:00:00Z", statusCheckRollup: [] },
		]);
		const result = await fetchPullRequests(exec, { repo: "owner/repo", cwd: "/repo", limit: 20 });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data[0]?.checkState).toBe("none");
	});

	it("reports checkState 'fail' when any check failed", async () => {
		const exec = jsonExec([
			{
				number: 1,
				title: "PR",
				author: { login: "a" },
				updatedAt: "2026-08-01T00:00:00Z",
				statusCheckRollup: [
					{ __typename: "CheckRun", status: "COMPLETED", conclusion: "SUCCESS", name: "lint" },
					{ __typename: "CheckRun", status: "COMPLETED", conclusion: "FAILURE", name: "test" },
				],
			},
		]);
		const result = await fetchPullRequests(exec, { repo: "owner/repo", cwd: "/repo", limit: 20 });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data[0]?.checkState).toBe("fail");
	});

	it("returns an error when gh fails", async () => {
		const result = await fetchPullRequests(failingExec("boom"), { repo: "owner/repo", cwd: "/repo", limit: 20 });
		expect(result).toEqual({ ok: false, error: "boom" });
	});

	it("returns an empty list for a repo with zero open PRs", async () => {
		const result = await fetchPullRequests(jsonExec([]), { repo: "owner/repo", cwd: "/repo", limit: 20 });
		expect(result).toEqual({ ok: true, data: [] });
	});
});

describe("fetchIssues", () => {
	it("maps fields including comment count and labels", async () => {
		const exec = jsonExec([
			{
				number: 5,
				title: "Bug",
				author: { login: "eve" },
				updatedAt: "2026-08-20T00:00:00Z",
				comments: [{ author: { login: "x" }, body: "hi", createdAt: "2026-08-20T01:00:00Z" }],
				labels: [{ name: "bug" }, { name: "p1" }],
			},
		]);
		const result = await fetchIssues(exec, { repo: "owner/repo", cwd: "/repo", limit: 20 });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data[0]).toMatchObject({
				number: 5,
				title: "Bug",
				author: "eve",
				commentCount: 1,
				labels: ["bug", "p1"],
			});
		}
	});
});

describe("fetchPullRequestDetail", () => {
	it("maps full detail including checks, reviews, files, and comments", async () => {
		const exec = jsonExec({
			number: 9,
			title: "Fix login bug",
			author: { login: "alice" },
			state: "OPEN",
			isDraft: false,
			labels: [{ name: "bug" }],
			assignees: [{ login: "bob" }],
			createdAt: "2026-08-01T00:00:00Z",
			updatedAt: "2026-08-02T00:00:00Z",
			body: "Fixes the thing.",
			comments: [{ author: { login: "carol" }, body: "LGTM", createdAt: "2026-08-02T01:00:00Z" }],
			baseRefName: "main",
			headRefName: "fix-login",
			statusCheckRollup: [{ __typename: "CheckRun", status: "COMPLETED", conclusion: "SUCCESS", name: "ci" }],
			latestReviews: [{ author: { login: "dave" }, state: "APPROVED" }],
			files: [{ path: "src/login.ts", additions: 10, deletions: 2 }],
		});

		const result = await fetchPullRequestDetail(exec, { repo: "owner/repo", cwd: "/repo", number: 9 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.data).toMatchObject({
			number: 9,
			title: "Fix login bug",
			author: "alice",
			baseRefName: "main",
			headRefName: "fix-login",
			checks: [{ name: "ci", state: "pass" }],
			reviews: [{ author: "dave", state: "APPROVED" }],
			files: [{ path: "src/login.ts", additions: 10, deletions: 2 }],
			comments: [{ author: "carol", body: "LGTM", createdAt: "2026-08-02T01:00:00Z" }],
		});
	});
});

describe("fetchIssueDetail", () => {
	it("maps full detail without PR-specific fields", async () => {
		const exec = jsonExec({
			number: 3,
			title: "Crash on start",
			author: { login: "alice" },
			state: "OPEN",
			labels: [{ name: "bug" }],
			assignees: [],
			createdAt: "2026-08-01T00:00:00Z",
			updatedAt: "2026-08-02T00:00:00Z",
			body: "It crashes.",
			comments: [{ author: { login: "bob" }, body: "Repro?", createdAt: "2026-08-02T01:00:00Z" }],
		});

		const result = await fetchIssueDetail(exec, { repo: "owner/repo", cwd: "/repo", number: 3 });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data.title).toBe("Crash on start");
			expect(result.data.comments).toEqual([{ author: "bob", body: "Repro?", createdAt: "2026-08-02T01:00:00Z" }]);
		}
	});
});

describe("getAllowedMergeMethods", () => {
	it("returns only the allowed methods, in squash/merge/rebase order", async () => {
		const exec = jsonExec({ squashMergeAllowed: true, mergeCommitAllowed: false, rebaseMergeAllowed: true });
		const result = await getAllowedMergeMethods(exec, { repo: "owner/repo", cwd: "/repo" });
		expect(result).toEqual({ ok: true, data: ["squash", "rebase"] });
	});
});

describe("approvePullRequest", () => {
	it("calls gh pr review --approve and succeeds", async () => {
		const exec = vi.fn(async () => ok());
		const result = await approvePullRequest(exec, { repo: "owner/repo", cwd: "/repo", number: 42 });
		expect(result).toEqual({ ok: true, data: true });
		expect(exec).toHaveBeenCalledWith(
			"gh",
			["pr", "review", "42", "--repo", "owner/repo", "--approve"],
			expect.objectContaining({ cwd: "/repo" }),
		);
	});

	it("surfaces gh's error on failure", async () => {
		const result = await approvePullRequest(failingExec("review required"), { repo: "owner/repo", cwd: "/repo", number: 42 });
		expect(result).toEqual({ ok: false, error: "review required" });
	});
});

describe("mergePullRequest", () => {
	it("passes the correct flag for each merge method", async () => {
		const exec = vi.fn(async () => ok());
		await mergePullRequest(exec, { repo: "owner/repo", cwd: "/repo", number: 7, method: "squash" });
		expect(exec).toHaveBeenLastCalledWith(
			"gh",
			["pr", "merge", "7", "--repo", "owner/repo", "--squash"],
			expect.objectContaining({ cwd: "/repo" }),
		);

		await mergePullRequest(exec, { repo: "owner/repo", cwd: "/repo", number: 7, method: "rebase" });
		expect(exec).toHaveBeenLastCalledWith(
			"gh",
			["pr", "merge", "7", "--repo", "owner/repo", "--rebase"],
			expect.objectContaining({ cwd: "/repo" }),
		);
	});

	it("surfaces gh's error on a blocked merge", async () => {
		const result = await mergePullRequest(failingExec("required checks pending"), {
			repo: "owner/repo",
			cwd: "/repo",
			number: 7,
			method: "merge",
		});
		expect(result).toEqual({ ok: false, error: "required checks pending" });
	});
});

describe("getCurrentAccount", () => {
	it("returns the trimmed login on success", async () => {
		const exec: ExecFn = async () => ({ stdout: "octocat\n", stderr: "", code: 0, killed: false });
		expect(await getCurrentAccount(exec, "/repo")).toBe("octocat");
	});

	it("returns undefined on failure", async () => {
		expect(await getCurrentAccount(failingExec("not logged in"), "/repo")).toBeUndefined();
	});
});
