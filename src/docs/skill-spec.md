# NeoSpark Skill Specification

Source: <https://useneospark.com/skill-spec/>

The package, manifest and execution contract for NeoSpark Skills. Use this document as context when creating, packaging or reviewing a Skill for NeoSpark. When using skill-creator or another Skill builder, provide this entire document before the builder starts.

## At a glance

- **SKILL.md is the manifest.** YAML frontmatter declares the Skill; the Markdown body tells the agent how to do the work.
- **One file or one ZIP.** Prompt-only Skills can be a single Markdown file. Skills with scripts and dependencies use a ZIP package.
- **Two execution modes.** Inline is the default; subprocess is for Python tools and generated files.
- **Review comes before publication.** Uploads enter the review queue after automated validation. Ready to submit? [Publish a Skill](https://useneospark.com/publish/).

## Using a Skill builder

`skill-creator` and similar tools write against their own defaults, which may not match the NeoSpark runtime. Give the builder this entire specification as context before it starts, and tell it that this document is authoritative. If the builder's defaults conflict with the specification, follow the specification.

Ask for a package that can run on NeoSpark without hand edits: a valid SKILL.md, the correct execution mode, every referenced script and dependency, and only the environment variables the scripts need. Then review the result against the [Author checklist](#author-checklist) before uploading.

## Package format

A submission can be a single SKILL.md file or a ZIP archive containing SKILL.md and its supporting files.

| Item | Requirement |
| --- | --- |
| Single Markdown file | Maximum 512 KB. Use this for a Skill that does not reference external scripts. |
| ZIP archive | Maximum 20 MB compressed, 200 files and 100 MB uncompressed. |
| Manifest discovery | The platform searches the archive for SKILL.md at any depth, case-insensitively. |
| Archive paths | Files must stay inside the package. Path traversal entries are rejected. |
| Skill ID | Must match `^[a-z0-9][a-z0-9_-]{0,63}$`. The frontmatter ID takes precedence over the form value. |

Keep the package focused: include the manifest, scripts, templates and dependency files the workflow needs, not build output or local credentials.

## Frontmatter reference

Frontmatter sits between two `---` delimiters at the start of SKILL.md. Only `id` is strictly required by the uploader, but authors should always provide an English name, description and valid version.

| Field | Required | Default | Purpose |
| --- | --- | --- | --- |
| `id` | Required | None | Unique Skill identifier, up to 64 lowercase letters, digits, hyphens or underscores. |
| `name` | Optional | Skill ID | Public display name shown in the catalogue and on the Skill page. |
| `description` | Optional | Empty string | Short public summary of what the Skill does and when to use it. |
| `version` | Optional | `0.0.0` | Semantic version in major.minor.patch form. |
| `model` | Optional | `anthropic:claude-opus-5` | Default model used when the Skill runs. |
| `tools` | Optional | `[]` | Platform tool names available to the Skill. |
| `dependencies` | Optional | `[]` | IDs of other Skills this Skill depends on. |

### Additional subprocess fields

| Field | Purpose |
| --- | --- |
| `execution_mode` | Set to `subprocess`. The default execution mode is `inline`. |
| `scripts` | Map of tool names to Python files, relative to the directory containing SKILL.md. |
| `file_generating_scripts` | Subset of scripts whose generated files should be uploaded and returned as downloadable URLs. |
| `tool_inputs` | Per-script parameter guidance added to the tool description shown to the model. |
| `env_whitelist` | Environment variable names the script is allowed to receive. Request only what is necessary. |
| `requirements` | Requirements file used to install third-party Python dependencies. Defaults to requirements.txt beside SKILL.md. |

## Inline execution

Inline is the default execution mode. A Skill can contain only instructions, or it can include fenced Python code blocks. The platform extracts and merges those blocks before execution.

- Merged inline Python code is limited to 500 lines.
- An AST sandbox checks imports and builtins before execution.
- File I/O, network access, dynamic imports and functions such as `eval`, `exec` and `open` are blocked.
- Only sandbox-approved Python modules are available.

A minimal prompt-only Skill needs no Python at all:

```markdown
---
id: concise-product-copy
name: Concise Product Copy
description: Rewrite product descriptions into clear, concise English.
version: 1.0.0
model: anthropic:claude-opus-5
tools: []
dependencies: []
---

Rewrite the product description supplied by the user.
Preserve factual claims, remove filler, and return only the revised copy.
```

## Subprocess execution

Use `execution_mode: subprocess` when the Skill exposes Python scripts as tools. Every entry in `scripts` becomes a tool named `<skill_id>_<tool_name>`.

```yaml
---
id: image-generator
name: Image Generator
description: Generate an image from a text prompt.
version: 1.0.0
execution_mode: subprocess
scripts:
  generate_image: scripts/generate_image.py
file_generating_scripts:
  - generate_image
tool_inputs:
  generate_image: >
    Accepts a JSON object with a required prompt string and an optional filename.
env_whitelist:
  - NEOSPARK_API_KEY
requirements: requirements.txt
---
```

### Script contract

The platform invokes each script with an output directory and a JSON input payload:

```bash
python <script> --output-dir <output-directory> --input-json <json-payload>
```

- Exit code 0 is required for success.
- Execution times out after 300 seconds; combined stdout and stderr are capped at 10 MB.
- The final stdout line can be a JSON object containing structured content, files or an error.
- Files produced by entries in `file_generating_scripts` are uploaded and returned as downloadable URLs.
- Third-party packages are installed from the declared requirements file.

**Security note:** subprocess scripts do not run inside the inline AST sandbox. Declare only required environment variables and expect the package to receive manual review before publication.

## Submitting a Skill

The author upload endpoint is `POST /api/v1/skills/upload`. It accepts an authenticated multipart submission with `file`, an optional `skill_id` and optional preview images.

1. The platform parses the manifest and checks IDs, script references, archive paths and inline sandbox constraints.
2. A valid upload enters `pending`; it is not registered as a public Skill yet.
3. An administrator approves or rejects the submission. Approved Skills are registered and appear in the catalogue; rejected submissions include a reason.

A Skill ID that is already registered or already has a pending submission returns a 409 conflict. Preview images are optional: submit up to 10 image files, each no larger than 5 MB. The first image becomes the catalogue cover.

Check your submission from the [publish page](https://useneospark.com/publish/). For installation and usage, see the [install guide](https://useneospark.com/install/).

## Author checklist

- Use a unique, lowercase Skill ID and a valid semantic version.
- Write the public title and description in English.
- Keep SKILL.md instructions specific enough for an agent to follow without extra context.
- Use a ZIP whenever the manifest references external scripts.
- Make every `scripts` path point to an existing Python file inside the package.
- List file-producing tools in `file_generating_scripts` and document their inputs in `tool_inputs`.
- Request only necessary environment variables and never package secrets.
- Include up to 10 representative preview images, with the intended cover first.
