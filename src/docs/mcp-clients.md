# Using NeoSpark Skills in Claude Code / Codex

Every Skill in the NeoSpark market can be downloaded as a native Claude Code / Codex
skill. The downloaded skill does not execute anything itself: it calls that Skill's
MCP tool on NeoSpark, so runs, billing and generated assets all stay on the platform.

## What the download contains

```
neospark-<skill-id>-skill.zip
├── skill/SKILL.md       native skill (installs to ~/.claude/skills or ~/.codex/skills)
├── install.sh           installer (macOS / Linux / Git Bash)
├── install.ps1          installer (Windows PowerShell)
├── verify_install.py    post-install self-check
├── claude.mcp.json      Claude Code MCP config (manual install)
├── codex-config.toml    Codex MCP config (manual install)
└── README.md            same instructions, offline
```

The package carries a key scoped to this one Skill. It is never a key for the whole
account.

## Install

1. Download the package from the Skill market and unzip it.
2. Open a terminal in the unzipped folder and run the installer:

```bash
./install.sh claude     # Claude Code only
./install.sh            # Claude Code + Codex
```

```powershell
.\install.ps1 claude
```

The installer copies the skill into the client's skills folder, writes the MCP server
config, and runs a self-check (files, config, and an MCP `initialize` handshake).

3. **Restart Claude Code.** MCP servers and skills are loaded at start-up.
4. Use the skill:

```
/neospark-<skill-id> your request
```

For example: `/neospark-agent-reach summarize https://example.com`.

## Verify

- `claude mcp list` — the skill's server should show as connected.
- `/mcp` inside a session — exactly one server and one tool for this skill.
- Typing `/` — the child skill name appears in the list.

## Manual install

If scripts cannot run in the environment:

1. Copy `skill/` to `~/.claude/skills/neospark-<skill-id>/`
   (or `~/.codex/skills/` for Codex).
2. Register the MCP server (key is in `claude.mcp.json`):

```bash
claude mcp add --transport http <skill-id> \
  https://api.useneospark.com/mcp/<skill-id> \
  --header "Authorization: Bearer <nsk_key>" --scope user
```

For Codex, append `codex-config.toml` to `~/.codex/config.toml` instead.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `claude: command not found` | Claude Code CLI is not installed or not on `PATH`; use the manual install path |
| Skill runs but says the MCP tool is missing | MCP server not configured — check `claude mcp list`, rerun the installer |
| 401 / invalid key | The package was downloaded again, which rotates the key; reinstall from the new package |
| Self-check says "no usable python" | Only the self-check was skipped; the skill still works |
| Nothing happens in the current session | Restart Claude Code; MCP and skills load at start-up |
| Image/video jobs take minutes | Expected: generation is asynchronous on the platform |
| `codex` rejects the config | Use Codex ≥ 26.1007; remote MCP entries need `url`, not `type` |

## Notes

- Calls consume the signed-in user's NeoSpark credits; the reply reports usage.
- The key is scoped to one Skill and one user. Do not share the package.
- Re-downloading rotates the key and invalidates previously installed copies.
- Codex supports the same package: the installer writes `~/.codex/config.toml` and
  copies the skill to `~/.codex/skills/`.
