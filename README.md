# pi-github

A [`pi`](https://pi.dev) extension that browses the current repo's open GitHub Pull Requests and Issues from a full-screen TUI inside `pi` — list, drill into details, and (for PRs) approve or merge — without leaving your terminal.

## Prerequisites

- The [`gh` CLI](https://cli.github.com) installed and authenticated (`gh auth login`)
- The current directory must be a git repository with a GitHub remote

`/github` checks both of these on invocation and shows a clear error instead of opening the screen if either is missing.

## Usage

Run `/github` inside `pi`. It detects `owner/repo` from your git remote and opens a full-screen browser for that repo's open Pull Requests and Issues, sorted most-recently-updated first.

### Keybindings

**List view** (Pull Requests / Issues):

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move selection |
| `Enter` | Open the selected item's detail view |
| `Tab` | Switch between Pull Requests and Issues |
| _(type)_ | Fuzzy-filter the visible list by title or number |
| `Backspace` | Remove the last filter character |
| `r` | Refresh the current section from GitHub |
| `Esc` | Clear the filter, then close the screen |

**Detail view** (Pull Request or Issue):

| Key | Action |
|-----|--------|
| `↑` / `↓` / `PageUp` / `PageDown` | Scroll |
| `r` | Refresh this item |
| `a` | Approve (Pull Requests only) |
| `m` | Merge (Pull Requests only) |
| `Esc` | Back to the list |

Issues are read-only — no approve/merge actions are shown on the Issue detail screen.

### Approve

`a` on a PR detail screen shows a confirm dialog naming the PR number, title, and the GitHub account the action will run as. Confirming runs `gh pr review --approve` and refreshes the detail view.

### Merge

`m` on a PR detail screen detects which merge methods the repository allows (squash / merge commit / rebase). If more than one is allowed, you're prompted to pick one first. It then shows a confirm dialog naming the PR, chosen method, and acting account before running `gh pr merge`. `pi-github` doesn't pre-check CI or review status — a blocked merge simply surfaces GitHub's own error.

## Configuration

The number of PRs/Issues fetched per section is configurable (default: **20**). Set it in `.pi/settings.json` (project) or `~/.pi/agent/settings.json` (global) under a `pi-github` key — project settings take precedence:

```json
{
  "pi-github": {
    "fetchLimit": 50
  }
}
```

## Installing locally for development

Add a project-local extension entry to `.pi/settings.json`:

```json
{
  "extensions": ["/absolute/path/to/pi-github/src/index.ts"]
}
```

Or symlink the package into `.pi/extensions/`:

```bash
mkdir -p .pi/extensions
ln -s /absolute/path/to/pi-github .pi/extensions/pi-github
```

Either way, run `npm install` in this directory first (needed for typechecking and tests; `pi` itself loads the TypeScript source directly via `jiti`, no build step required). After editing the source, run `/reload` inside `pi` to pick up changes without restarting.

Once this repository has a pushed remote, it can also be installed with:

```bash
pi install git:github.com/<owner>/pi-github
```

(not set up automatically by this package — see [packages.md](https://pi.dev) for details on publishing).

## Development

```bash
npm install
npm run typecheck
npm test
```

## License

MIT
