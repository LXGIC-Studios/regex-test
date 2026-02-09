# @lxgicstudios/regex-test

[![npm version](https://img.shields.io/npm/v/@lxgicstudios/regex-test)](https://www.npmjs.com/package/@lxgicstudios/regex-test)
[![license](https://img.shields.io/npm/l/@lxgicstudios/regex-test)](./LICENSE)
[![node](https://img.shields.io/node/v/@lxgicstudios/regex-test)](./package.json)

Test regex patterns against strings right from the CLI. Matches get highlighted with colors, capture groups are clearly labeled, and you can even get plain-English explanations of what your pattern does. Zero dependencies.

## Install

```bash
# Run directly
npx @lxgicstudios/regex-test <pattern> <string>

# Or install globally
npm i -g @lxgicstudios/regex-test
```

## Usage

```bash
# Basic match
regex-test "\d+" "abc123def456"

# With capture groups
regex-test "(\w+)@(\w+)" "user@host"

# Named capture groups
regex-test "(?<year>\d{4})-(?<month>\d{2})" "2025-01-15"

# Case-insensitive matching
regex-test "hello" "Hello World" --flags gi

# Test against a file of strings
regex-test "error|warn" --bulk ./app.log --flags gi

# Explain what a pattern does
regex-test "^\d{3}-\d{4}$" --explain

# JSON output
regex-test "\w+" "hello world" --json
```

## Features

- **Color-highlighted matches** so you can see exactly what matched
- **Capture group display** with numbered and named groups
- **Bulk testing** against files (one string per line)
- **Regex explainer** that breaks down patterns in plain English
- **Multiple flags** support (g, i, m, s, u, y)
- **Multi-string testing** with summary stats
- **JSON output** for scripting and automation
- **Zero dependencies** - uses only Node.js builtins

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--help, -h` | Show help | - |
| `--json` | Output as JSON | `false` |
| `--flags <f>` | Regex flags (g, i, m, s, u, y) | `g` |
| `--bulk <file>` | Test against each line in a file | - |
| `--explain` | Explain the regex in plain English | `false` |

## Explain Mode

The `--explain` flag breaks your pattern into tokens and describes each one:

```bash
$ regex-test "^(\d{3})-(\d{4})$" --explain

  Regex Breakdown
  Pattern: /^(\d{3})-(\d{4})$/

  ^              Start of string/line
  (              Capture group start
  \d             Any digit (0-9)
  {3}            Exactly 3 of the previous
  )              Group end
  -              Literal "-"
  (              Capture group start
  \d             Any digit (0-9)
  {4}            Exactly 4 of the previous
  )              Group end
  $              End of string/line
```

## Requirements

- Node.js 18+

---

**Built by [LXGIC Studios](https://lxgicstudios.com)**

[GitHub](https://github.com/lxgicstudios/regex-test) | [Twitter](https://x.com/lxgicstudios)
