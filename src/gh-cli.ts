import type { ExecFn } from "./types.ts";

export type CheckResult = { ok: true } | { ok: false; error: string };

export async function checkGhInstalled(exec: ExecFn): Promise<CheckResult> {
	try {
		const result = await exec("gh", ["--version"], { timeout: 5_000 });
		if (result.code !== 0) {
			return { ok: false, error: "The `gh` CLI is installed but `gh --version` failed. Install it from https://cli.github.com." };
		}
		return { ok: true };
	} catch {
		return { ok: false, error: "The `gh` CLI is not installed. Install it from https://cli.github.com." };
	}
}

export async function checkGhAuthenticated(exec: ExecFn, cwd: string): Promise<CheckResult> {
	const result = await exec("gh", ["auth", "status"], { cwd, timeout: 5_000 });
	if (result.code !== 0) {
		return { ok: false, error: "The `gh` CLI is not authenticated. Run `gh auth login` and try again." };
	}
	return { ok: true };
}
