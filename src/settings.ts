import { readFile as fsReadFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_FETCH_LIMIT = 20;

interface PiGithubSettings {
	fetchLimit?: unknown;
}

interface GetFetchLimitOptions {
	cwd: string;
	home?: string;
	readFile?: (path: string) => Promise<string>;
}

async function readPiGithubSettings(
	path: string,
	readFile: (path: string) => Promise<string>,
): Promise<PiGithubSettings | undefined> {
	let content: string;
	try {
		content = await readFile(path);
	} catch {
		return undefined;
	}

	try {
		const parsed = JSON.parse(content) as Record<string, unknown>;
		const section = parsed["pi-github"];
		if (section && typeof section === "object") {
			return section as PiGithubSettings;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function asPositiveInteger(value: unknown): number | undefined {
	return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

/** Reads the `pi-github.fetchLimit` setting, project settings taking precedence over global. */
export async function getFetchLimit(options: GetFetchLimitOptions): Promise<number> {
	const readFile = options.readFile ?? ((path: string) => fsReadFile(path, "utf8"));
	const home = options.home ?? homedir();

	const globalPath = join(home, ".pi", "agent", "settings.json");
	const projectPath = join(options.cwd, ".pi", "settings.json");

	const [global, project] = await Promise.all([
		readPiGithubSettings(globalPath, readFile),
		readPiGithubSettings(projectPath, readFile),
	]);

	return asPositiveInteger(project?.fetchLimit) ?? asPositiveInteger(global?.fetchLimit) ?? DEFAULT_FETCH_LIMIT;
}
