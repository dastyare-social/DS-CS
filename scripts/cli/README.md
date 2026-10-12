# ds-cs

The CLI for [Dastyare Social — CS](https://cs.dastyare.social). Installs agent skills, wires up MCP, and authenticates to a channel.

```bash
npx @dastyaresocial/ds-cs init
npx @dastyaresocial/ds-cs add post-with-media
```

## Why

DS-CS already speaks two agent protocols — a REST API and an MCP server — but neither tells an agent *how* to use them. The constraints that matter (upload before you post; `kind=` filters stories while `type=` counts them; the oRPC URL must be absolute) are scattered across a README an agent will not read.

Skills are that knowledge, in the form agents actually load. This CLI installs them.

## The interactive flow

Run it with no flags and `ds-cs` asks, in this order:

```
? Where should ds-cs install skills?
❯ This project                    committed, shared with your team
  Global (every project)           your user directory — OpenCode, Claude Code

? Which agents should read these skills?
  type to filter · space toggle · a all · enter confirm
  ❯ ◉ Select all
    ◉ OpenCode          .agents/skills
    ◉ Cursor            .agents/skills
    ◉ Codex             .agents/skills
    ◉ Claude Code       .claude/skills
    ○ Windsurf          .windsurf/skills
  … 8 more

(15 selected: opencode, claude-code, cursor, codex, …)

? How should the files be shared between agents?
❯ Symlink                          one copy, updates land everywhere
  Copy                              independent files per agent

? Which skills would you like to install?
  type to filter · space toggle · a all · enter install
  ❯ ◉ Select all
    ○ add-component     skills/dev/add-component/
    ○ add-orpc-endpoint skills/dev/add-orpc-endpoint/
  …
```

Scope first, because it decides which directories exist; then which agents read
the skills; then how those agents share one copy; then what to install.

Both multi-selects open on a **Select all** row — space on it, or `a` anywhere,
takes everything; pressing it again clears the selection. That is what you want
on a first run and never again.

**Your last choices are remembered** in `~/.config/ds-cs/preferences.json`, so
the next run preselects them and you can just hit enter three times. Delete the
file to reset. It lives in your user directory, not the repo — scope and agent
choice are habits, not project configuration.

In the skill picker, typing filters against names, paths **and descriptions**, so
`webh` finds `webhooks` and `manage-stories` (both mention webhooks). Space
toggles, so you can take several at once.

Without a terminal — CI, a pipe, an agent — nothing prompts. `ds-cs add` prints
a listing, and flags decide:

```bash
ds-cs add --global                     # scope
ds-cs add brand-config -a opencode     # agent (repeatable, or a directory path)
ds-cs add --copy                       # independent copies
ds-cs add -y                           # accept defaults, no prompts
```

## Commands

| Command | What it does |
|---|---|
| `ds-cs init` | Prepare skills directories, optionally write MCP config |
| `ds-cs add <skill\|source>` | Install skills from DS-CS or anywhere else |
| `ds-cs list` | Show what is installed and where it came from |
| `ds-cs update [skill…]` | Re-fetch skills that changed upstream |
| `ds-cs remove <skill…]` | Uninstall skills from every agent |
| `ds-cs search [query]` | Search installed skills |
| `ds-cs mcp [agent]` | Print, or write, MCP server config |
| `ds-cs login` | Store a channel URL and API key |
| `ds-cs whoami` | Show the stored channel |
| `ds-cs logout` | Remove stored credentials |

## Sources

```bash
ds-cs add brand-config              # from the DS-CS registry (the default)
ds-cs add owner/repo                # any GitHub skills repo
ds-cs add owner/repo@skill          # one skill from that repo
ds-cs add owner/repo@a,b            # several
ds-cs add https://github.com/o/r/tree/main/skills/x
ds-cs add ./my-skills               # a local directory
ds-cs add https://…/SKILL.md        # a direct URL
ds-cs add https://…/archive.tar.gz  # a zip or tarball of skills
ds-cs add git@github.com:o/r.git    # any other git host
ds-cs add owner/repo --list         # browse without installing
```

A bare word is a skill name from the DS-CS registry, because knowing where a skill lives should not be the user's problem. Anything source-shaped — `owner/repo`, a URL, a path — is treated as a source.

GitHub repositories are fetched as tarballs rather than cloned: one HTTP request, no `git` binary required, and no repository hooks executed. Only non-GitHub git hosts fall back to `git clone`.

## Where skills land

The canonical copy always goes to `.agents/skills/<name>` — the directory OpenCode, Cursor, Codex and a dozen others already read. Every other target is symlinked to it, so an update lands everywhere at once and there is one source of truth per project.

```bash
ds-cs add brand-config -a claude-code        # also link into .claude/skills
ds-cs add brand-config -a ./my-agent/skills  # or any directory you name
ds-cs add brand-config --copy                # copy instead of symlink
```

Symlinks are the default because agents that disagree about skill content is a worse problem than agents that disagree about inode counts. `--copy` is there for filesystems where symlinks do not work; the CLI falls back to copying automatically if a symlink fails.

Run `ds-cs init --list-agents` for the full table.

## Lockfile

Installs are recorded in `skills-lock.json`, in the same v1 format `npx skills` (vercel-labs) reads and writes. The two tools interoperate in one project without clobbering each other:

```bash
ds-cs add brand-config        # DS-CS skills
npx skills add emilkowalski/skill   # third-party skills
ds-cs list                   # reports both
```

Each entry records the source, the skill's path within it, and a content hash. `ds-cs update` compares against that hash and **refuses to overwrite a skill you have edited locally** — an agent's tweak to a skill is usually deliberate. `--force` overrides.

## MCP

```bash
ds-cs login --url https://cs.example.com --api-key "$API_KEY"
ds-cs mcp                    # print every client format
ds-cs mcp claude-code        # write .mcp.json
ds-cs mcp opencode           # write opencode.json
```

An existing config file is never overwritten. The snippet is printed for you to merge — clobbering a working MCP config to add one server is a bad trade.

Remote (HTTP) works everywhere and is what most people want. Local (stdio, `bun run mcp`) is faster and works offline but needs a clone with `DATABASE_URL` set.

## Credentials

`ds-cs login` verifies the channel before saving, so a mistyped key surfaces at login rather than mid-task inside an agent. Credentials land in `~/.config/ds-cs/auth.json` at mode `0600` — outside the project, because a key that can delete content is one `git add -A` away from being published.

```bash
ds-cs whoami     # shows a redacted key
ds-cs logout
```

`DS_CS_URL` and `DS_CS_API_KEY` override the stored values. `DS_CS_CONFIG_DIR` relocates the file.

## Where the registry comes from

`ds-cs add` resolves the DS-CS registry in this order:

1. **A local checkout** — a DS-CS repo found by walking up from the current directory. Edit a skill and reinstall it and you get your edit, not whatever `main` says.
2. **The copy bundled in this package** — `prepack` copies `skills/` into the published package. This is the normal path for an installed CLI, and it works with no network at all. It also guarantees the registry matches the CLI version you have.
3. **GitHub** — a fallback for a CLI older than the skills it wants. Only the `skills/` subtree is fetched; the full repo tarball is ~28MB, almost all of it `public/` and generated assets, and reading it to get ten markdown files is not a trade worth making.

The repo's `skills/` is the source of truth. The copy inside this package is a build artefact, regenerated on `prepack` and gitignored.

## Publishing a skill to the registry

DS-CS skills live in [`skills/`](../../skills) in this repository. A skill is a directory with a `SKILL.md` whose frontmatter carries a `name` and a `description`:

```
skills/
  dev/add-orpc-endpoint/SKILL.md
  product/post-with-media/SKILL.md
```

The description is the whole interface — it is what an agent reads to decide whether to load the skill. Write it as "use when X", and name the sibling skills it should *not* be used for. Reference files, scripts and templates sit next to `SKILL.md` in the same directory and travel with it.

Set `metadata.internal: true` to hide a skill from discovery until `INSTALL_INTERNAL_SKILLS=1`.

## Development

```bash
npm test                    # node:test, no dependencies
npm run sync-skills         # refresh the bundled registry copy
npm run dev -- --help
```

The prompts are hand-rolled keypress handling, which cannot be exercised without
a terminal — every automated check would otherwise stop at `isInteractive()` and
test the non-interactive path instead. `test/pty_harness.py` runs the real
binary under a pty, sends keystrokes, and prints the final screen.

It splits the raw stream into repaint frames rather than counting occurrences of
a menu in it. A prompt redraws by emitting cursor-up and erase sequences, so the
byte stream contains every frame ever drawn; counting them there would report a
correctly-repainting prompt as one that duplicates its menu:

```bash
python3 test/pty_harness.py "ENTER,SPACE,ENTER,ENTER,s,t,o,SPACE,ENTER" \
  node bin/ds-cs.mjs add
```

While working inside a DS-CS checkout, `ds-cs add` prefers the local `skills/` directory over the published registry, so edits reinstall immediately. Pass a source path explicitly to bypass that.

## Requirements

Node 18.17+. Zero runtime dependencies.
