import type { MergeMethod } from "../types.ts";

export function approveConfirmMessage(pr: { number: number; title: string }, account: string): string {
	return `Approve #${pr.number} '${pr.title}' as @${account}?`;
}

export function mergeMethodLabel(method: MergeMethod): string {
	switch (method) {
		case "squash":
			return "Squash and merge";
		case "merge":
			return "Merge";
		case "rebase":
			return "Rebase and merge";
	}
}

export function mergeConfirmMessage(
	pr: { number: number; title: string; baseRefName: string },
	method: MergeMethod,
	account: string,
): string {
	return `${mergeMethodLabel(method)} #${pr.number} '${pr.title}' into ${pr.baseRefName} as @${account}?`;
}
