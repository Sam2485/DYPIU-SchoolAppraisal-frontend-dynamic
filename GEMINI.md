# DYPIU Faculty Appraisal - Agent Guidelines

## Token Optimization & Serena MCP Tools

This project is configured with **Serena MCP** to minimize token consumption and prevent context window exhaustion. All AI agents working in this workspace must follow these mandatory rules:

### 1. Zero Full-File Dumps
- **NEVER** read full source files with file viewer tools or shell commands when inspecting code.
- Always explore structure using Serena's symbolic tools:
  - `get_symbols_overview(relative_path=...)`: Inspect functions, classes, and components in a file.
  - `find_symbol(name_path_pattern=..., include_body=False)`: Locate symbols across the codebase.
  - `find_symbol(name_path_pattern=..., include_body=True)`: Read **only** the specific function, hook, or component body needed.
  - `find_referencing_symbols(...)`: Find callers and usages across files.
  - `search_for_pattern(substring_pattern=...)`: Perform fast pattern matching without loading file contents.

### 2. Surgical Symbolic Edits
- For modifying complete functions/components: use `replace_symbol_body`.
- For small targeted changes within a function: use `replace_content` with exact text or tight regex patterns.
- For additions at the top or bottom of a file: use `insert_before_symbol` or `insert_after_symbol`.
- Avoid rewriting entire files, as re-emitting file content burns tokens and risks regressions.

### 3. Consult Serena Persistent Memories
- Never search or re-analyze the codebase to understand architecture, stack, or conventions.
- Retrieve durable project context on demand via `read_memory`:
  - `core`: Root map, invariants, and memory graph.
  - `tech_stack`: React 19, Vite, routing, packages, and language server setup.
  - `architecture`: Page vs feature breakdown, dynamic form AST, API gateway routing.
  - `conventions`: Code styles, hook naming, role-based security, auto-save patterns.
  - `suggested_commands`: Dev server, build, lint, and Windows PowerShell helpers.
  - `task_completion`: Pre-completion verification steps (lint, build, index).
- To update or record new conventions, use `write_memory`.
- Verify memory integrity with `serena memories check`.

### 4. Language Server & Symbol Index
- TypeScript Language Server is active for `.js` and `.jsx` files.
- When creating new components, keep the index fresh by running `serena project index`.