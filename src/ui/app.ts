import { getMarkdownTheme, type Theme } from "@earendil-works/pi-coding-agent";
import {
	decodeKittyPrintable,
	Markdown,
	matchesKey,
	SelectList,
	truncateToWidth,
	type Component,
	type TUI,
} from "@earendil-works/pi-tui";
import { relativeTime } from "../format.ts";
import {
	approvePullRequest,
	fetchIssueDetail,
	fetchIssues,
	fetchPullRequestDetail,
	fetchPullRequests,
	getAllowedMergeMethods,
	getCurrentAccount,
	mergePullRequest,
} from "../gh-data.ts";
import type {
	ExecFn,
	IssueDetail,
	IssueSummary,
	MergeMethod,
	PullRequestDetail,
	PullRequestSummary,
} from "../types.ts";
import { filterIssues, filterPullRequests } from "./filter.ts";
import { approveConfirmMessage, mergeConfirmMessage, mergeMethodLabel } from "./messages.ts";
import { buildIssueRowPlan, buildPrRowPlan, layoutIssueRow, layoutPrRow } from "./rows.ts";

export interface AppUI {
	confirm(title: string, message: string): Promise<boolean>;
	select(title: string, options: string[]): Promise<string | undefined>;
	notify(message: string, type?: "info" | "warning" | "error"): void;
}

export interface AppOptions {
	repo: string;
	cwd: string;
	exec: ExecFn;
	limit: number;
	ui: AppUI;
	theme: Theme;
	tui: TUI;
	done: (value: void) => void;
}

type Section = "pr" | "issue";

interface SectionState<TSummary> {
	items: TSummary[] | null;
	error: string | null;
	filterQuery: string;
	selectedNumber: number | null;
}

type Screen =
	| { kind: "list" }
	| { kind: "pr-detail"; number: number; data: PullRequestDetail | null; loading: boolean; error: string | null }
	| { kind: "issue-detail"; number: number; data: IssueDetail | null; loading: boolean; error: string | null };

const LIST_OVERHEAD_LINES = 4; // header + blank + footer + margin
const MIN_VISIBLE_ROWS = 3;

/** Decodes a single typed printable character from raw terminal input, or undefined for control/navigation keys. */
function decodePrintable(data: string): string | undefined {
	if (data.length === 0) return undefined;
	const kitty = decodeKittyPrintable(data);
	if (kitty !== undefined) return kitty;
	if (data.startsWith("\x1b")) return undefined;
	const code = data.codePointAt(0) ?? 0;
	if (code < 32 || code === 127) return undefined;
	return data;
}

export class GithubApp implements Component {
	private closed = false;
	private section: Section = "pr";
	private pr: SectionState<PullRequestSummary> = { items: null, error: null, filterQuery: "", selectedNumber: null };
	private issue: SectionState<IssueSummary> = { items: null, error: null, filterQuery: "", selectedNumber: null };
	private screen: Screen = { kind: "list" };
	private selectList: SelectList | null = null;
	private account: string | undefined;
	private scrollPos = 0;

	constructor(private readonly opts: AppOptions) {
		void this.loadSection("pr");
	}

	dispose(): void {
		this.closed = true;
	}

	invalidate(): void {
		this.selectList?.invalidate();
	}

	// --- Data loading -------------------------------------------------------

	private async loadSection(section: Section): Promise<void> {
		const state = section === "pr" ? this.pr : this.issue;
		state.error = null;
		state.items = null;
		this.requestRender();

		if (section === "pr") {
			const result = await fetchPullRequests(this.opts.exec, { repo: this.opts.repo, cwd: this.opts.cwd, limit: this.opts.limit });
			if (this.closed) return;
			if (result.ok) {
				this.pr.items = result.data;
			} else {
				this.pr.error = result.error;
			}
		} else {
			const result = await fetchIssues(this.opts.exec, { repo: this.opts.repo, cwd: this.opts.cwd, limit: this.opts.limit });
			if (this.closed) return;
			if (result.ok) {
				this.issue.items = result.data;
			} else {
				this.issue.error = result.error;
			}
		}
		this.selectList = null;
		this.requestRender();
	}

	private async ensureAccount(): Promise<string> {
		if (this.account) return this.account;
		const login = await getCurrentAccount(this.opts.exec, this.opts.cwd);
		this.account = login ?? "unknown";
		return this.account;
	}

	private async openPrDetail(number: number): Promise<void> {
		this.screen = { kind: "pr-detail", number, data: null, loading: true, error: null };
		this.scrollPos = 0;
		this.requestRender();
		await this.reloadPrDetail();
	}

	private async reloadPrDetail(): Promise<void> {
		if (this.screen.kind !== "pr-detail") return;
		const number = this.screen.number;
		const result = await fetchPullRequestDetail(this.opts.exec, { repo: this.opts.repo, cwd: this.opts.cwd, number });
		if (this.closed || this.screen.kind !== "pr-detail" || this.screen.number !== number) return;
		if (result.ok) {
			this.screen = { kind: "pr-detail", number, data: result.data, loading: false, error: null };
		} else {
			this.screen = { kind: "pr-detail", number, data: this.screen.data, loading: false, error: result.error };
		}
		this.requestRender();
	}

	private async openIssueDetail(number: number): Promise<void> {
		this.screen = { kind: "issue-detail", number, data: null, loading: true, error: null };
		this.scrollPos = 0;
		this.requestRender();
		await this.reloadIssueDetail();
	}

	private async reloadIssueDetail(): Promise<void> {
		if (this.screen.kind !== "issue-detail") return;
		const number = this.screen.number;
		const result = await fetchIssueDetail(this.opts.exec, { repo: this.opts.repo, cwd: this.opts.cwd, number });
		if (this.closed || this.screen.kind !== "issue-detail" || this.screen.number !== number) return;
		if (result.ok) {
			this.screen = { kind: "issue-detail", number, data: result.data, loading: false, error: null };
		} else {
			this.screen = { kind: "issue-detail", number, data: this.screen.data, loading: false, error: result.error };
		}
		this.requestRender();
	}

	private async approveCurrentPr(): Promise<void> {
		if (this.screen.kind !== "pr-detail" || !this.screen.data) return;
		const pr = this.screen.data;
		const account = await this.ensureAccount();
		const confirmed = await this.opts.ui.confirm("Approve Pull Request", approveConfirmMessage(pr, account));
		if (!confirmed) return;

		const result = await approvePullRequest(this.opts.exec, { repo: this.opts.repo, cwd: this.opts.cwd, number: pr.number });
		if (result.ok) {
			this.opts.ui.notify(`Approved #${pr.number}.`, "info");
			await this.reloadPrDetail();
		} else {
			this.opts.ui.notify(`Approve failed: ${result.error}`, "error");
		}
	}

	private async mergeCurrentPr(): Promise<void> {
		if (this.screen.kind !== "pr-detail" || !this.screen.data) return;
		const pr = this.screen.data;

		const methodsResult = await getAllowedMergeMethods(this.opts.exec, { repo: this.opts.repo, cwd: this.opts.cwd });
		if (!methodsResult.ok) {
			this.opts.ui.notify(`Could not determine merge methods: ${methodsResult.error}`, "error");
			return;
		}
		if (methodsResult.data.length === 0) {
			this.opts.ui.notify("This repository has no merge methods enabled.", "error");
			return;
		}

		let method: MergeMethod;
		if (methodsResult.data.length === 1) {
			const first = methodsResult.data[0];
			if (!first) return;
			method = first;
		} else {
			const labels = methodsResult.data.map(mergeMethodLabel);
			const chosenLabel = await this.opts.ui.select("Merge method", labels);
			if (!chosenLabel) return;
			const index = labels.indexOf(chosenLabel);
			const chosen = methodsResult.data[index];
			if (!chosen) return;
			method = chosen;
		}

		const account = await this.ensureAccount();
		const confirmed = await this.opts.ui.confirm(mergeMethodLabel(method), mergeConfirmMessage(pr, method, account));
		if (!confirmed) return;

		const result = await mergePullRequest(this.opts.exec, { repo: this.opts.repo, cwd: this.opts.cwd, number: pr.number, method });
		if (result.ok) {
			this.opts.ui.notify(`Merged #${pr.number}.`, "info");
			await this.reloadPrDetail();
		} else {
			this.opts.ui.notify(`Merge failed: ${result.error}`, "error");
		}
	}

	private requestRender(): void {
		if (this.closed) return;
		this.opts.tui.requestRender();
	}

	// --- Input ---------------------------------------------------------------

	handleInput(data: string): void {
		if (this.screen.kind === "list") {
			this.handleListInput(data);
		} else {
			this.handleDetailInput(data);
		}
	}

	private currentSectionState(): SectionState<PullRequestSummary | IssueSummary> {
		return this.section === "pr" ? this.pr : this.issue;
	}

	private handleListInput(data: string): void {
		if (matchesKey(data, "escape")) {
			const state = this.currentSectionState();
			if (state.filterQuery !== "") {
				state.filterQuery = "";
				this.selectList = null;
				this.requestRender();
			} else {
				this.closed = true;
				this.opts.done(undefined);
			}
			return;
		}

		if (matchesKey(data, "tab")) {
			this.section = this.section === "pr" ? "issue" : "pr";
			this.selectList = null;
			if (this.currentSectionState().items === null) {
				void this.loadSection(this.section);
			}
			this.requestRender();
			return;
		}

		const printable = decodePrintable(data);

		if (printable === "r") {
			void this.loadSection(this.section);
			return;
		}

		if (matchesKey(data, "backspace")) {
			const state = this.currentSectionState();
			if (state.filterQuery.length > 0) {
				state.filterQuery = state.filterQuery.slice(0, -1);
				this.selectList = null;
				this.requestRender();
			}
			return;
		}

		if (printable && printable.length === 1) {
			const state = this.currentSectionState();
			state.filterQuery += printable;
			this.selectList = null;
			this.requestRender();
			return;
		}

		if (matchesKey(data, "enter")) {
			const item = this.selectList?.getSelectedItem();
			if (item) {
				const number = Number(item.value);
				if (this.section === "pr") void this.openPrDetail(number);
				else void this.openIssueDetail(number);
			}
			return;
		}

		this.selectList?.handleInput(data);
		this.requestRender();
	}

	private handleDetailInput(data: string): void {
		if (matchesKey(data, "escape")) {
			this.screen = { kind: "list" };
			this.requestRender();
			return;
		}

		const printable = decodePrintable(data);

		if (printable === "r") {
			if (this.screen.kind === "pr-detail") void this.reloadPrDetail();
			else void this.reloadIssueDetail();
			return;
		}

		if (this.screen.kind === "pr-detail") {
			if (printable === "a") {
				void this.approveCurrentPr();
				return;
			}
			if (printable === "m") {
				void this.mergeCurrentPr();
				return;
			}
		}

		if (matchesKey(data, "up")) {
			this.scrollPos = Math.max(0, this.scrollPos - 1);
			this.requestRender();
			return;
		}
		if (matchesKey(data, "down")) {
			this.scrollPos += 1;
			this.requestRender();
			return;
		}
		if (matchesKey(data, "pageUp")) {
			this.scrollPos = Math.max(0, this.scrollPos - this.visibleRows());
			this.requestRender();
			return;
		}
		if (matchesKey(data, "pageDown")) {
			this.scrollPos += this.visibleRows();
			this.requestRender();
			return;
		}
	}

	private visibleRows(): number {
		return Math.max(MIN_VISIBLE_ROWS, (this.opts.tui.terminal.rows || 24) - LIST_OVERHEAD_LINES);
	}

	// --- Rendering -------------------------------------------------------------

	render(width: number): string[] {
		const lines: string[] = [];

		if (this.screen.kind === "list") {
			lines.push(this.renderListHeader(width));
			lines.push("");
			lines.push(...this.renderListBody(width));
			lines.push("");
			lines.push(this.renderListFooter());
		} else if (this.screen.kind === "pr-detail") {
			lines.push(...this.renderPrDetail(width));
		} else {
			lines.push(...this.renderIssueDetail(width));
		}

		return lines.map((line) => truncateToWidth(line, width, "", false));
	}

	private renderListHeader(width: number): string {
		const theme = this.opts.theme;
		const prTab = this.section === "pr" ? theme.bold(theme.fg("accent", "[Pull Requests]")) : theme.fg("dim", "Pull Requests");
		const issueTab = this.section === "issue" ? theme.bold(theme.fg("accent", "[Issues]")) : theme.fg("dim", "Issues");
		return truncateToWidth(`${theme.fg("text", this.opts.repo)}   ${prTab}  ${issueTab}`, width);
	}

	private renderListFooter(): string {
		const theme = this.opts.theme;
		const state = this.currentSectionState();
		const escHint = state.filterQuery !== "" ? "esc clear filter" : "esc close";
		return theme.fg("dim", `↑/↓ move · enter open · tab switch · type to filter · r refresh · ${escHint}`);
	}

	private renderListBody(width: number): string[] {
		const theme = this.opts.theme;
		const state = this.currentSectionState();

		if (state.error) {
			return [theme.fg("error", `Failed to load: ${state.error}`), theme.fg("dim", "Press r to retry.")];
		}
		if (state.items === null) {
			return [theme.fg("dim", "Loading…")];
		}
		if (state.items.length === 0) {
			return [theme.fg("dim", this.section === "pr" ? "No open pull requests." : "No open issues.")];
		}

		const filtered = this.section === "pr" ? filterPullRequests(this.pr.items as PullRequestSummary[], state.filterQuery) : filterIssues(this.issue.items as IssueSummary[], state.filterQuery);

		const lines: string[] = [];
		if (state.filterQuery !== "") {
			lines.push(theme.fg("accent", `Filter: ${state.filterQuery}`));
		}

		if (filtered.length === 0) {
			lines.push(theme.fg("warning", `No matches for "${state.filterQuery}".`));
			this.selectList = null;
			return lines;
		}

		if (!this.selectList) {
			this.selectList = this.buildSelectList(filtered);
		}

		lines.push(...this.selectList.render(width));
		return lines;
	}

	private buildSelectList(items: (PullRequestSummary | IssueSummary)[]): SelectList {
		const now = new Date();
		const listItems = items.map((item) => {
			const label =
				this.section === "pr"
					? layoutPrRow(buildPrRowPlan(item as PullRequestSummary, now), 200)
					: layoutIssueRow(buildIssueRowPlan(item as IssueSummary, now), 200);
			return { value: String(item.number), label };
		});

		const visible = Math.min(listItems.length, this.visibleRows());
		const selectList = new SelectList(listItems, Math.max(1, visible), {
			selectedPrefix: (t) => this.opts.theme.fg("accent", t),
			selectedText: (t) => this.opts.theme.bg("selectedBg", t),
			description: (t) => this.opts.theme.fg("dim", t),
			scrollInfo: (t) => this.opts.theme.fg("dim", t),
			noMatch: (t) => this.opts.theme.fg("warning", t),
		});

		const state = this.currentSectionState();
		if (state.selectedNumber !== null) {
			const index = listItems.findIndex((item) => item.value === String(state.selectedNumber));
			if (index >= 0) selectList.setSelectedIndex(index);
		}
		selectList.onSelectionChange = (item) => {
			state.selectedNumber = Number(item.value);
		};
		const initial = selectList.getSelectedItem();
		if (initial) state.selectedNumber = Number(initial.value);

		return selectList;
	}

	private renderPrDetail(width: number): string[] {
		if (this.screen.kind !== "pr-detail") return [];
		const theme = this.opts.theme;
		const { number, data, loading, error } = this.screen;

		const status = this.detailStatusLines(number, data, loading, error);
		if (status.done) return this.withDetailChrome(status.lines, "");
		if (!data) return this.withDetailChrome(status.lines, "");

		const content: string[] = [
			...status.lines,
			...this.renderDetailHeader(data, data.isDraft ? "draft" : undefined),
			theme.fg("dim", `${data.baseRefName} ← ${data.headRefName}`),
		];

		if (data.checks.length > 0) {
			content.push("");
			content.push(theme.bold("Checks"));
			for (const check of data.checks) {
				const color = check.state === "pass" ? "success" : check.state === "fail" ? "error" : "warning";
				const symbol = check.state === "pass" ? "✓" : check.state === "fail" ? "✗" : "●";
				content.push(theme.fg(color, `  ${symbol} ${check.name}`));
			}
		}

		if (data.reviews.length > 0) {
			content.push("");
			content.push(theme.bold("Reviews"));
			for (const review of data.reviews) {
				const approved = review.state === "APPROVED";
				content.push(theme.fg(approved ? "success" : "warning", `  ${approved ? "✓" : "✗"} @${review.author} ${review.state}`));
			}
		}

		if (data.files.length > 0) {
			content.push("");
			content.push(theme.bold(`Files changed (${data.files.length})`));
			for (const file of data.files) {
				content.push(`  ${file.path} ${theme.fg("success", `+${file.additions}`)} ${theme.fg("error", `-${file.deletions}`)}`);
			}
		}

		content.push(...this.renderBodyAndComments(data.body, data.comments, width));

		const footer = theme.fg("dim", "↑/↓ scroll · a approve · m merge · r refresh · esc back");
		return this.withDetailChrome(content, footer);
	}

	private renderIssueDetail(width: number): string[] {
		if (this.screen.kind !== "issue-detail") return [];
		const theme = this.opts.theme;
		const { number, data, loading, error } = this.screen;

		const status = this.detailStatusLines(number, data, loading, error);
		if (status.done) return this.withDetailChrome(status.lines, "");
		if (!data) return this.withDetailChrome(status.lines, "");

		const content: string[] = [...status.lines, ...this.renderDetailHeader(data), ...this.renderBodyAndComments(data.body, data.comments, width)];

		const footer = theme.fg("dim", "↑/↓ scroll · r refresh · esc back");
		return this.withDetailChrome(content, footer);
	}

	/** Loading/error preamble shared by both detail screens. `done: true` means the caller should return immediately with just `lines`. */
	private detailStatusLines(number: number, data: unknown, loading: boolean, error: string | null): { lines: string[]; done: boolean } {
		const theme = this.opts.theme;
		if (loading && !data) {
			return { lines: [theme.fg("dim", `Loading #${number}…`)], done: true };
		}
		const lines: string[] = [];
		if (error) lines.push(theme.fg("error", `Failed to load #${number}: ${error}`));
		if (!data) return { lines, done: true };
		return { lines, done: false };
	}

	private renderDetailHeader(
		data: { number: number; title: string; state: string; author: string; createdAt: string; updatedAt: string; labels: string[]; assignees: string[] },
		extra?: string,
	): string[] {
		const theme = this.opts.theme;
		const lines: string[] = [
			theme.bold(theme.fg("text", `#${data.number} ${data.title}`)),
			theme.fg(
				"dim",
				`${data.state}${extra ? ` · ${extra}` : ""} · @${data.author} · opened ${relativeTime(data.createdAt)} · updated ${relativeTime(data.updatedAt)}`,
			),
		];
		if (data.labels.length > 0) lines.push(theme.fg("dim", `Labels: ${data.labels.join(", ")}`));
		if (data.assignees.length > 0) lines.push(theme.fg("dim", `Assignees: ${data.assignees.join(", ")}`));
		return lines;
	}

	private renderBodyAndComments(body: string, comments: { author: string; body: string; createdAt: string }[], width: number): string[] {
		const theme = this.opts.theme;
		const lines: string[] = ["", theme.bold("Description"), ...new Markdown(body || "_No description._", 0, 0, getMarkdownTheme()).render(width)];

		lines.push("", theme.bold(`Comments (${comments.length})`));
		for (const comment of comments) {
			lines.push(theme.fg("accent", `@${comment.author} · ${relativeTime(comment.createdAt)}`));
			lines.push(...new Markdown(comment.body, 0, 0, getMarkdownTheme()).render(width));
			lines.push("");
		}
		return lines;
	}

	private withDetailChrome(content: string[], footer: string): string[] {
		const visible = this.visibleRows();
		const maxScroll = Math.max(0, content.length - visible);
		this.scrollPos = Math.max(0, Math.min(this.scrollPos, maxScroll));
		const windowed = content.slice(this.scrollPos, this.scrollPos + visible);

		const lines = [...windowed];
		if (content.length > visible) {
			lines.push(this.opts.theme.fg("dim", `-- ${this.scrollPos + 1}-${Math.min(this.scrollPos + visible, content.length)} of ${content.length} --`));
		}
		lines.push("");
		if (footer) lines.push(footer);
		return lines;
	}
}
