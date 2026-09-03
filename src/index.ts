import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { checkGhAuthenticated, checkGhInstalled } from "./gh-cli.ts";
import { detectRepo } from "./repo.ts";
import { getFetchLimit } from "./settings.ts";
import { GithubApp } from "./ui/app.ts";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("github", {
		description: "Browse this repo's open GitHub Pull Requests and Issues",
		handler: async (_args, ctx) => {
			const exec = pi.exec;

			const installed = await checkGhInstalled(exec);
			if (!installed.ok) {
				ctx.ui.notify(installed.error, "error");
				return;
			}

			const authenticated = await checkGhAuthenticated(exec, ctx.cwd);
			if (!authenticated.ok) {
				ctx.ui.notify(authenticated.error, "error");
				return;
			}

			const repoResult = await detectRepo(exec, ctx.cwd);
			if (!repoResult.ok) {
				ctx.ui.notify(repoResult.error, "error");
				return;
			}

			const limit = await getFetchLimit({ cwd: ctx.cwd });

			await ctx.ui.custom<void>(
				(tui, theme, _keybindings, done) => {
					return new GithubApp({
						repo: repoResult.repo,
						cwd: ctx.cwd,
						exec,
						limit,
						ui: ctx.ui,
						theme,
						tui,
						done,
					});
				},
				{
					overlay: true,
					overlayOptions: {
						width: "100%",
						maxHeight: "100%",
						anchor: "center",
						margin: 0,
					},
				},
			);
		},
	});
}
