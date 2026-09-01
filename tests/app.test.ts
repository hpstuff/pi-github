import { describe, expect, it, vi } from "vitest";
import { GithubApp, type AppOptions, type AppUI } from "../src/ui/app.ts";
import type { ExecFn } from "../src/types.ts";

function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

const fakeTheme = {
	fg: (_c: string, t: string) => t,
	bg: (_c: string, t: string) => t,
	bold: (t: string) => t,
	italic: (t: string) => t,
	underline: (t: string) => t,
	inverse: (t: string) => t,
	strikethrough: (t: string) => t,
} as unknown as AppOptions["theme"];

function makeApp(overrides: {
	exec?: ExecFn;
	ui?: Partial<AppUI>;
} = {}) {
	const done = vi.fn();
	const requestRender = vi.fn();
	const tui = { requestRender, terminal: { rows: 40, columns: 100 } } as unknown as AppOptions["tui"];

	const prList = [
		{
			number: 1,
			title: "Fix the login bug",
			author: { login: "alice" },
			isDraft: false,
			updatedAt: "2026-08-01T00:00:00Z",
			statusCheckRollup: [],
			latestReviews: [],
		},
	];
	const issueList = [
		{
			number: 5,
			title: "Crash on startup",
			author: { login: "bob" },
			updatedAt: "2026-08-01T00:00:00Z",
			comments: [],
			labels: [],
		},
	];
	const prDetail = {
		number: 1,
		title: "Fix the login bug",
		author: { login: "alice" },
		state: "OPEN",
		isDraft: false,
		labels: [],
		assignees: [],
		createdAt: "2026-08-01T00:00:00Z",
		updatedAt: "2026-08-01T00:00:00Z",
		body: "This fixes login.",
		comments: [],
		baseRefName: "main",
		headRefName: "fix-login",
		statusCheckRollup: [],
		latestReviews: [],
		files: [],
	};

	const defaultExec: ExecFn = async (command, args) => {
		if (command === "gh" && args[0] === "pr" && args[1] === "list") {
			return { stdout: JSON.stringify(prList), stderr: "", code: 0, killed: false };
		}
		if (command === "gh" && args[0] === "issue" && args[1] === "list") {
			return { stdout: JSON.stringify(issueList), stderr: "", code: 0, killed: false };
		}
		if (command === "gh" && args[0] === "pr" && args[1] === "view") {
			return { stdout: JSON.stringify(prDetail), stderr: "", code: 0, killed: false };
		}
		if (command === "gh" && args[0] === "pr" && args[1] === "review") {
			return { stdout: "", stderr: "", code: 0, killed: false };
		}
		if (command === "gh" && args[0] === "api") {
			return { stdout: "octocat\n", stderr: "", code: 0, killed: false };
		}
		return { stdout: "", stderr: `unexpected command: ${command} ${args.join(" ")}`, code: 1, killed: false };
	};

	const ui: AppUI = {
		confirm: vi.fn(async () => true),
		select: vi.fn(async () => undefined),
		notify: vi.fn(),
		...overrides.ui,
	};

	const app = new GithubApp({
		repo: "owner/repo",
		cwd: "/repo",
		exec: overrides.exec ?? defaultExec,
		limit: 20,
		ui,
		theme: fakeTheme,
		tui,
		done,
	});

	return { app, done, ui, tui };
}

describe("GithubApp", () => {
	it("renders without throwing before data has loaded", () => {
		const { app } = makeApp();
		const lines = app.render(80);
		expect(lines.length).toBeGreaterThan(0);
		for (const line of lines) {
			expect(line.length).toBeLessThanOrEqual(80 + 20); // allow for ANSI codes in fake theme (no-ops here, so exact)
		}
	});

	it("shows PR rows after the list loads", async () => {
		const { app } = makeApp();
		await flush();
		const text = app.render(120).join("\n");
		expect(text).toContain("owner/repo");
		expect(text).toContain("#1");
		expect(text).toContain("Fix the login bug");
	});

	it("switches to Issues on Tab and loads issue rows", async () => {
		const { app } = makeApp();
		await flush();
		app.handleInput("\t");
		await flush();
		const text = app.render(120).join("\n");
		expect(text).toContain("#5");
		expect(text).toContain("Crash on startup");
	});

	it("filters the list by typing, and clearing with escape restores it", async () => {
		const { app } = makeApp();
		await flush();
		app.handleInput("z");
		app.handleInput("z");
		app.handleInput("z");
		let text = app.render(120).join("\n");
		expect(text).toContain('No matches for "zzz"');

		app.handleInput("\x1b"); // escape clears the filter
		text = app.render(120).join("\n");
		expect(text).toContain("Fix the login bug");
	});

	it("closes on escape when the list is not filtered", async () => {
		const { app, done } = makeApp();
		await flush();
		app.handleInput("\x1b");
		expect(done).toHaveBeenCalled();
	});

	it("opens PR detail on enter and shows the body", async () => {
		const { app } = makeApp();
		await flush();
		app.render(120);
		app.handleInput("\r");
		await flush();
		const text = app.render(120).join("\n");
		expect(text).toContain("Fix the login bug");
		expect(text).toContain("This fixes login.");
		expect(text).toContain("approve");
	});

	it("returns to the list from detail on escape", async () => {
		const { app } = makeApp();
		await flush();
		app.render(120);
		app.handleInput("\r");
		await flush();
		app.handleInput("\x1b");
		const text = app.render(120).join("\n");
		expect(text).toContain("owner/repo");
	});

	it("approves the PR after confirmation", async () => {
		const exec = vi.fn(async (command: string, args: string[]) => {
			if (command === "gh" && args[0] === "pr" && args[1] === "list") {
				return {
					stdout: JSON.stringify([
						{ number: 1, title: "Fix the login bug", author: { login: "alice" }, isDraft: false, updatedAt: "2026-08-01T00:00:00Z" },
					]),
					stderr: "",
					code: 0,
					killed: false,
				};
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "view") {
				return {
					stdout: JSON.stringify({
						number: 1,
						title: "Fix the login bug",
						author: { login: "alice" },
						state: "OPEN",
						createdAt: "2026-08-01T00:00:00Z",
						updatedAt: "2026-08-01T00:00:00Z",
						body: "Body",
						baseRefName: "main",
						headRefName: "fix-login",
					}),
					stderr: "",
					code: 0,
					killed: false,
				};
			}
			if (command === "gh" && args[0] === "api") {
				return { stdout: "octocat\n", stderr: "", code: 0, killed: false };
			}
			if (command === "gh" && args[0] === "pr" && args[1] === "review") {
				return { stdout: "", stderr: "", code: 0, killed: false };
			}
			return { stdout: "", stderr: "unexpected", code: 1, killed: false };
		});

		const confirm = vi.fn(async () => true);
		const { app } = makeApp({ exec, ui: { confirm } });
		await flush();
		app.render(120);
		app.handleInput("\r"); // open PR detail
		await flush();
		app.handleInput("a"); // approve
		await flush();

		expect(confirm).toHaveBeenCalledWith("Approve Pull Request", "Approve #1 'Fix the login bug' as @octocat?");
		expect(exec).toHaveBeenCalledWith(
			"gh",
			["pr", "review", "1", "--repo", "owner/repo", "--approve"],
			expect.objectContaining({ cwd: "/repo" }),
		);
	});
});
