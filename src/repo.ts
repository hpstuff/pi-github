import type { ExecFn } from "./types.ts";

export type RepoResolution = { ok: true; repo: string } | { ok: false; error: string };

export function parseGitHubRemote(remoteUrl: string): string | undefined {
	const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
	if (sshMatch) return sshMatch[1];

	const sshProtoMatch = remoteUrl.match(/^ssh:\/\/git@github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
	if (sshProtoMatch) return sshProtoMatch[1];

	const httpsMatch = remoteUrl.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
	if (httpsMatch) return httpsMatch[1];

	return undefined;
}

/** Picks the URL to check from `git remote -v` output: prefers "origin", else the first remote listed. */
export function pickRemoteUrl(remoteVOutput: string): string | undefined {
	let firstUrl: string | undefined;
	let originUrl: string | undefined;

	for (const line of remoteVOutput.split("\n")) {
		const columns = line.trim().split(/\s+/);
		const name = columns[0];
		const url = columns[1];
		if (!name || !url) continue;
		firstUrl ??= url;
		if (name === "origin") {
			originUrl ??= url;
		}
	}

	return originUrl ?? firstUrl;
}

export async function detectRepo(exec: ExecFn, cwd: string): Promise<RepoResolution> {
	const result = await exec("git", ["remote", "-v"], { cwd, timeout: 5_000 });
	if (result.code !== 0) {
		return { ok: false, error: "Not a git repository (or no remotes configured)." };
	}

	const remoteUrl = pickRemoteUrl(result.stdout);
	if (!remoteUrl) {
		return { ok: false, error: "This repository has no git remote configured." };
	}

	const repo = parseGitHubRemote(remoteUrl);
	if (!repo) {
		return { ok: false, error: "This repository's remote is not a GitHub repository." };
	}

	return { ok: true, repo };
}
