# agent/TOOL_PRIORS.md

## Purpose

Tool selection optimization through learned priors. The right tool for the job, learned from experience.

Tool selection affects efficiency. Track what works, avoid what doesn't.

---

## Available Tools

| Tool | Purpose | Default Priority |
|------|---------|------------------|
| `read_file` | Read file contents | High |
| `grep_search` | Fast text search | High |
| `semantic_search` | Semantic code search | Medium |
| `file_search` | Find files by glob | High |
| `list_dir` | List directory contents | Medium |
| `create_file` | Create new file | High |
| `replace_string_in_file` | Edit existing file | High |
| `multi_replace_string_in_file` | Multiple edits | High |
| `run_in_terminal` | Execute commands | High |
| `get_terminal_output` | Check background tasks | Medium |
| `runTests` | Run test suite | High |
| `get_errors` | Check compilation errors | High |
| `manage_todo_list` | Track task progress | Medium |
| `tool_search_tool_regex` | Find deferred tools | Low |

---

## Tool Selection Matrix

### Finding Information

| Need | Best Tool | Alternative |
|------|-----------|-------------|
| Exact string in codebase | `grep_search` | - |
| Conceptual search | `semantic_search` | `grep_search` with synonyms |
| File by name/pattern | `file_search` | `list_dir` + navigate |
| Directory structure | `list_dir` | `file_search` with `**/` |
| File contents | `read_file` | `grep_search` in file |
| Overview of file | `grep_search` in file | `read_file` large range |

### Making Changes

| Need | Best Tool | Alternative |
|------|-----------|-------------|
| New file | `create_file` | - |
| Single edit | `replace_string_in_file` | - |
| Multiple related edits | `multi_replace_string_in_file` | Sequential edits |
| Rename/move file | `run_in_terminal` with mv | - |
| Delete file | `run_in_terminal` with rm | - |

### Verification

| Need | Best Tool | Alternative |
|------|-----------|-------------|
| Run tests | `runTests` | `run_in_terminal` |
| Type errors | `get_errors` | `run_in_terminal` with tsc |
| Lint errors | `get_errors` | `run_in_terminal` with lint |
| Command output | `run_in_terminal` | - |
| Background task status | `get_terminal_output` | - |

---

## Tool Success Data

Track success/failure by tool and context:

```yaml
tool: "tool_name"
context: "task type or situation"
attempts: N
successes: N
success_rate: N%
common_failures: ["reason1", "reason2"]
optimization_notes: "what improves success"
```

### Current Data

#### read_file
```yaml
tool: "read_file"
context: "gathering context"
attempts: 50
successes: 50
success_rate: 100%
common_failures: []
optimization_notes: "Read larger ranges to reduce calls"
```

#### replace_string_in_file
```yaml
tool: "replace_string_in_file"
context: "code edits"
attempts: 30
successes: 28
success_rate: 93%
common_failures: ["string not found (whitespace)", "multiple matches"]
optimization_notes: "Include 3-5 lines context, verify uniqueness"
```

#### grep_search
```yaml
tool: "grep_search"
context: "finding code"
attempts: 40
successes: 38
success_rate: 95%
common_failures: ["pattern too broad", "wrong file type"]
optimization_notes: "Use includePattern for focused search"
```

#### run_in_terminal
```yaml
tool: "run_in_terminal"
context: "command execution"
attempts: 25
successes: 22
success_rate: 88%
common_failures: ["command not found", "permission denied", "timeout"]
optimization_notes: "Set appropriate timeout, check prerequisites"
```

---

## Tool Chains

Common effective sequences:

### Context Gathering Chain
```
file_search → read_file (parallel) → grep_search (targeted)
```

### Edit Chain
```
read_file → replace_string_in_file → get_errors → runTests
```

### Debug Chain
```
get_errors → grep_search → read_file → replace_string_in_file → runTests
```

### New File Chain
```
file_search (check exists) → create_file → get_errors
```

---

## Tool Anti-Patterns

### Avoid
| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Many small reads | Slow, fragmented context | Read larger ranges |
| Sequential independent reads | Wasted time | Parallel reads |
| Edit before read | Blind changes | Read context first |
| Run tests without targeting | Slow feedback | Use `files` parameter |
| Background without tracking | Lost output | Track terminal ID |

---

## Priors by Task Type

### Bug Fix
1. `get_errors` - See current errors
2. `grep_search` - Find related code
3. `read_file` - Understand context
4. `replace_string_in_file` - Make fix
5. `runTests` - Verify fix

### Feature Implementation
1. `file_search` - Find related files
2. `read_file` (parallel) - Understand structure
3. `create_file` / `replace_string_in_file` - Implement
4. `get_errors` - Check compilation
5. `runTests` - Verify behavior

### Documentation
1. `read_file` - Understand current docs
2. `grep_search` - Find related content
3. `create_file` / `replace_string_in_file` - Update docs
4. `run_in_terminal` - Run doc generators if applicable

### Configuration
1. `list_dir` - Understand structure
2. `read_file` - Read current config
3. `grep_search` - Find config usages
4. `replace_string_in_file` - Update config
5. `run_in_terminal` - Test config

---

## Learning Protocol

After tool usage:
1. Note success/failure
2. If failure, record reason
3. Update success_rate
4. If pattern emerges, add to anti-patterns or chains

---

## Integration

- **METRICS.md**: Tool calls counted per task
- **SELF_EVAL.md**: Tool usage score based on efficiency
- **PATTERNS.md**: Tool chains become patterns
