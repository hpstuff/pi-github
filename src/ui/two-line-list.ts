export interface TwoLineListItem<T> {
	value: string;
	data: T;
}

export interface TwoLineListOptions<T> {
	/** Renders an item's two lines. Output should already be themed but not padded/highlighted. */
	renderRow: (item: T, isSelected: boolean, width: number) => [string, string];
	/** Pads a line to `width` and applies the selection background. */
	highlightRow: (line: string, width: number) => string;
	/** Styles the "(i/n)" indicator shown when the list is scrolled. */
	scrollInfo?: (text: string) => string;
}

/** A `SelectList`-like widget where each item renders as two lines (title + meta) instead of one. */
export class TwoLineList<T> {
	private selectedIndex = 0;

	onSelectionChange?: (item: TwoLineListItem<T>) => void;

	constructor(
		private readonly items: TwoLineListItem<T>[],
		private readonly maxVisible: number,
		private readonly options: TwoLineListOptions<T>,
	) {}

	setSelectedIndex(index: number): void {
		this.selectedIndex = Math.max(0, Math.min(index, this.items.length - 1));
	}

	getSelectedItem(): TwoLineListItem<T> | null {
		return this.items[this.selectedIndex] ?? null;
	}

	moveUp(): void {
		if (this.items.length === 0) return;
		this.selectedIndex = this.selectedIndex === 0 ? this.items.length - 1 : this.selectedIndex - 1;
		this.notifySelectionChange();
	}

	moveDown(): void {
		if (this.items.length === 0) return;
		this.selectedIndex = this.selectedIndex === this.items.length - 1 ? 0 : this.selectedIndex + 1;
		this.notifySelectionChange();
	}

	render(width: number): string[] {
		if (this.items.length === 0) return [];

		const maxVisible = Math.max(1, this.maxVisible);
		const startIndex = Math.max(0, Math.min(this.selectedIndex - Math.floor(maxVisible / 2), Math.max(0, this.items.length - maxVisible)));
		const endIndex = Math.min(startIndex + maxVisible, this.items.length);

		const lines: string[] = [];
		for (let i = startIndex; i < endIndex; i++) {
			const item = this.items[i];
			if (!item) continue;
			const isSelected = i === this.selectedIndex;
			const [line1, line2] = this.options.renderRow(item.data, isSelected, width);
			if (isSelected) {
				lines.push(this.options.highlightRow(line1, width), this.options.highlightRow(line2, width));
			} else {
				lines.push(line1, line2);
			}
		}

		if ((startIndex > 0 || endIndex < this.items.length) && this.options.scrollInfo) {
			lines.push(this.options.scrollInfo(`  (${this.selectedIndex + 1}/${this.items.length})`));
		}

		return lines;
	}

	private notifySelectionChange(): void {
		const item = this.getSelectedItem();
		if (item && this.onSelectionChange) this.onSelectionChange(item);
	}
}
