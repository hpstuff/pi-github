import { describe, expect, it } from "vitest";
import { DEFAULT_FETCH_LIMIT, getFetchLimit } from "../src/settings.ts";

function readFileFrom(files: Record<string, string>) {
	return async (path: string) => {
		const content = files[path];
		if (content === undefined) {
			const error = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException;
			error.code = "ENOENT";
			throw error;
		}
		return content;
	};
}

describe("getFetchLimit", () => {
	it("falls back to the default when no settings files exist", async () => {
		const limit = await getFetchLimit({ cwd: "/repo", home: "/home/user", readFile: readFileFrom({}) });
		expect(limit).toBe(DEFAULT_FETCH_LIMIT);
	});

	it("reads the fetch limit from global settings", async () => {
		const readFile = readFileFrom({
			"/home/user/.pi/agent/settings.json": JSON.stringify({ "pi-github": { fetchLimit: 50 } }),
		});
		const limit = await getFetchLimit({ cwd: "/repo", home: "/home/user", readFile });
		expect(limit).toBe(50);
	});

	it("prefers project settings over global settings", async () => {
		const readFile = readFileFrom({
			"/home/user/.pi/agent/settings.json": JSON.stringify({ "pi-github": { fetchLimit: 50 } }),
			"/repo/.pi/settings.json": JSON.stringify({ "pi-github": { fetchLimit: 5 } }),
		});
		const limit = await getFetchLimit({ cwd: "/repo", home: "/home/user", readFile });
		expect(limit).toBe(5);
	});

	it("ignores malformed JSON and falls back to the default", async () => {
		const readFile = readFileFrom({
			"/repo/.pi/settings.json": "{ not json",
		});
		const limit = await getFetchLimit({ cwd: "/repo", home: "/home/user", readFile });
		expect(limit).toBe(DEFAULT_FETCH_LIMIT);
	});

	it("ignores a non-positive-integer fetchLimit and falls back to the default", async () => {
		const readFile = readFileFrom({
			"/repo/.pi/settings.json": JSON.stringify({ "pi-github": { fetchLimit: -3 } }),
		});
		const limit = await getFetchLimit({ cwd: "/repo", home: "/home/user", readFile });
		expect(limit).toBe(DEFAULT_FETCH_LIMIT);
	});
});
