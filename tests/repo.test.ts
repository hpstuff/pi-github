import { describe, expect, it } from "vitest";
import { detectRepo, parseGitHubRemote, pickRemoteUrl } from "../src/repo.ts";
import type { ExecFn } from "../src/types.ts";

describe("parseGitHubRemote", () => {
	it("parses an https remote", () => {
		expect(parseGitHubRemote("https://github.com/owner/repo.git")).toBe("owner/repo");
	});

	it("parses an https remote without .git suffix", () => {
		expect(parseGitHubRemote("https://github.com/owner/repo")).toBe("owner/repo");
	});

	it("parses an ssh remote", () => {
		expect(parseGitHubRemote("git@github.com:owner/repo.git")).toBe("owner/repo");
	});

	it("parses an ssh:// remote", () => {
		expect(parseGitHubRemote("ssh://git@github.com/owner/repo.git")).toBe("owner/repo");
	});

	it("returns undefined for a non-GitHub remote", () => {
		expect(parseGitHubRemote("https://gitlab.com/owner/repo.git")).toBeUndefined();
	});
});

describe("pickRemoteUrl", () => {
	it("prefers origin when multiple remotes are present", () => {
		const output = [
			"upstream\thttps://github.com/upstream-owner/repo.git (fetch)",
			"upstream\thttps://github.com/upstream-owner/repo.git (push)",
			"origin\thttps://github.com/owner/repo.git (fetch)",
			"origin\thttps://github.com/owner/repo.git (push)",
		].join("\n");
		expect(pickRemoteUrl(output)).toBe("https://github.com/owner/repo.git");
	});

	it("falls back to the first remote when there is no origin", () => {
		const output = ["upstream\thttps://github.com/owner/repo.git (fetch)"].join("\n");
		expect(pickRemoteUrl(output)).toBe("https://github.com/owner/repo.git");
	});

	it("returns undefined for empty output", () => {
		expect(pickRemoteUrl("")).toBeUndefined();
	});
});

describe("detectRepo", () => {
	it("returns the repo when git remote resolves to GitHub", async () => {
		const exec: ExecFn = async () => ({
			stdout: "origin\thttps://github.com/owner/repo.git (fetch)\norigin\thttps://github.com/owner/repo.git (push)\n",
			stderr: "",
			code: 0,
			killed: false,
		});
		const result = await detectRepo(exec, "/some/dir");
		expect(result).toEqual({ ok: true, repo: "owner/repo" });
	});

	it("fails when cwd is not a git repository", async () => {
		const exec: ExecFn = async () => ({ stdout: "", stderr: "not a git repository", code: 128, killed: false });
		const result = await detectRepo(exec, "/some/dir");
		expect(result.ok).toBe(false);
	});

	it("fails when there is no GitHub remote", async () => {
		const exec: ExecFn = async () => ({
			stdout: "origin\thttps://gitlab.com/owner/repo.git (fetch)\n",
			stderr: "",
			code: 0,
			killed: false,
		});
		const result = await detectRepo(exec, "/some/dir");
		expect(result.ok).toBe(false);
	});
});
