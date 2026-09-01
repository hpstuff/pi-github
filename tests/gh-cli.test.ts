import { describe, expect, it } from "vitest";
import { checkGhAuthenticated, checkGhInstalled } from "../src/gh-cli.ts";
import type { ExecFn } from "../src/types.ts";

describe("checkGhInstalled", () => {
	it("returns ok when gh --version succeeds", async () => {
		const exec: ExecFn = async () => ({ stdout: "gh version 2.98.0", stderr: "", code: 0, killed: false });
		expect(await checkGhInstalled(exec)).toEqual({ ok: true });
	});

	it("returns an error when gh is not found", async () => {
		const exec: ExecFn = async () => {
			throw new Error("spawn gh ENOENT");
		};
		const result = await checkGhInstalled(exec);
		expect(result.ok).toBe(false);
	});
});

describe("checkGhAuthenticated", () => {
	it("returns ok when gh auth status exits 0", async () => {
		const exec: ExecFn = async () => ({ stdout: "Logged in", stderr: "", code: 0, killed: false });
		expect(await checkGhAuthenticated(exec, "/cwd")).toEqual({ ok: true });
	});

	it("returns an error when gh auth status exits non-zero", async () => {
		const exec: ExecFn = async () => ({ stdout: "", stderr: "not logged in", code: 1, killed: false });
		const result = await checkGhAuthenticated(exec, "/cwd");
		expect(result.ok).toBe(false);
	});
});
