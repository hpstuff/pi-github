const UNITS: Array<{ limit: number; divisor: number; suffix: string }> = [
	{ limit: 60, divisor: 1, suffix: "s" },
	{ limit: 60 * 60, divisor: 60, suffix: "m" },
	{ limit: 60 * 60 * 24, divisor: 60 * 60, suffix: "h" },
	{ limit: 60 * 60 * 24 * 30, divisor: 60 * 60 * 24, suffix: "d" },
	{ limit: 60 * 60 * 24 * 365, divisor: 60 * 60 * 24 * 30, suffix: "mo" },
];

/** Formats an ISO timestamp as a relative "Xs/m/h/d/mo/y ago" string, given the reference time. */
export function relativeTime(iso: string, now: Date = new Date()): string {
	const deltaSeconds = Math.floor((now.getTime() - new Date(iso).getTime()) / 1000);
	if (deltaSeconds < 1) return "just now";

	for (const unit of UNITS) {
		if (deltaSeconds < unit.limit) {
			return `${Math.floor(deltaSeconds / unit.divisor)}${unit.suffix} ago`;
		}
	}

	const years = Math.floor(deltaSeconds / (60 * 60 * 24 * 365));
	return `${years}y ago`;
}
