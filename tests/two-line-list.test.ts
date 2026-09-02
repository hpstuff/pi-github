import { describe, expect, it } from "vitest";
import { TwoLineList } from "../src/ui/two-line-list.ts";

function makeList(count: number, maxVisible: number) {
	const items = Array.from({ length: count }, (_, i) => ({ value: String(i), data: `item-${i}` }));
	return new TwoLineList(items, maxVisible, {
		renderRow: (data, isSelected) => [`${isSelected ? "SEL:" : ""}${data}:line1`, `${isSelected ? "SEL:" : ""}${data}:line2`],
		highlightRow: (line) => `[HL]${line}[/HL]`,
		scrollInfo: (t) => `[SCROLL]${t}`,
	});
}

describe("TwoLineList", () => {
	it("starts selection at the first item", () => {
		const list = makeList(3, 3);
		expect(list.getSelectedItem()?.value).toBe("0");
	});

	it("moveDown/moveUp wrap around and fire onSelectionChange", () => {
		const list = makeList(3, 3);
		const seen: string[] = [];
		list.onSelectionChange = (item) => seen.push(item.value);

		list.moveDown();
		list.moveDown();
		list.moveDown(); // wraps back to 0
		expect(seen).toEqual(["1", "2", "0"]);

		list.moveUp(); // wraps to last
		expect(seen).toEqual(["1", "2", "0", "2"]);
	});

	it("renders two lines per visible item, marking only the selected item", () => {
		const list = makeList(2, 2);
		list.setSelectedIndex(1);
		const lines = list.render(80);
		expect(lines).toEqual([
			"item-0:line1",
			"item-0:line2",
			"[HL]SEL:item-1:line1[/HL]",
			"[HL]SEL:item-1:line2[/HL]",
		]);
	});

	it("shows a scroll indicator once items exceed maxVisible", () => {
		const list = makeList(5, 2);
		const noScroll = new TwoLineList(
			Array.from({ length: 2 }, (_, i) => ({ value: String(i), data: `item-${i}` })),
			2,
			{ renderRow: (d, s) => [`${s}${d}`, `${s}${d}`], highlightRow: (l) => l, scrollInfo: (t) => `[SCROLL]${t}` },
		);
		expect(noScroll.render(80).some((line) => line.includes("SCROLL"))).toBe(false);

		expect(list.render(80).some((line) => line.includes("[SCROLL]"))).toBe(true);
	});

	it("returns no lines for an empty list", () => {
		const list = makeList(0, 3);
		expect(list.render(80)).toEqual([]);
		expect(list.getSelectedItem()).toBeNull();
	});
});
