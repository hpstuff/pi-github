import { describe, expect, it } from "vitest";
import { approveConfirmMessage, mergeConfirmMessage, mergeMethodLabel } from "../src/ui/messages.ts";

describe("approveConfirmMessage", () => {
	it("names the PR number, title, and acting account", () => {
		const message = approveConfirmMessage({ number: 123, title: "Fix login bug" }, "octocat");
		expect(message).toBe("Approve #123 'Fix login bug' as @octocat?");
	});
});

describe("mergeMethodLabel", () => {
	it("labels each merge method", () => {
		expect(mergeMethodLabel("squash")).toBe("Squash and merge");
		expect(mergeMethodLabel("merge")).toBe("Merge");
		expect(mergeMethodLabel("rebase")).toBe("Rebase and merge");
	});
});

describe("mergeConfirmMessage", () => {
	it("names the PR number, title, method, base branch, and acting account", () => {
		const message = mergeConfirmMessage({ number: 123, title: "Fix login bug", baseRefName: "main" }, "squash", "octocat");
		expect(message).toBe("Squash and merge #123 'Fix login bug' into main as @octocat?");
	});
});
