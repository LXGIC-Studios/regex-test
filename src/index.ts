#!/usr/bin/env node

import { readFileSync } from "node:fs";

// ── ANSI Colors ──────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

const MATCH_COLORS = [c.bgGreen, c.bgYellow, c.bgCyan, c.bgMagenta, c.bgBlue, c.bgRed];

// ── Types ────────────────────────────────────────────────────
interface Options {
  help: boolean;
  json: boolean;
  pattern: string;
  strings: string[];
  flags: string;
  bulk?: string;
  explain: boolean;
}

// ── Arg Parsing ──────────────────────────────────────────────
function parseArgs(argv: string[]): Options {
  const opts: Options = {
    help: false,
    json: false,
    pattern: "",
    strings: [],
    flags: "g",
    explain: false,
  };

  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      opts.help = true;
    } else if (a === "--json") {
      opts.json = true;
    } else if (a === "--explain") {
      opts.explain = true;
    } else if (a === "--flags" && argv[i + 1]) {
      opts.flags = argv[++i];
    } else if (a === "--bulk" && argv[i + 1]) {
      opts.bulk = argv[++i];
    } else if (!opts.pattern && !a.startsWith("-")) {
      opts.pattern = a;
    } else if (opts.pattern && !a.startsWith("-")) {
      opts.strings.push(a);
    }
    i++;
  }

  return opts;
}

// ── Help ─────────────────────────────────────────────────────
const HELP = `
${c.bold}${c.cyan}  regex-test${c.reset}  Test regex patterns from the terminal

${c.bold}USAGE${c.reset}
  ${c.green}npx @lxgicstudios/regex-test${c.reset} <pattern> <string> [string...] [options]

${c.bold}OPTIONS${c.reset}
  ${c.yellow}--help, -h${c.reset}       Show this help message
  ${c.yellow}--json${c.reset}           Output results as JSON
  ${c.yellow}--flags <f>${c.reset}      Regex flags (default: "g"). e.g., "gi", "gm"
  ${c.yellow}--bulk <file>${c.reset}    Test pattern against each line in a file
  ${c.yellow}--explain${c.reset}        Break down the regex pattern in plain English

${c.bold}EXAMPLES${c.reset}
  ${c.dim}$ regex-test "\\d+" "abc123def456"${c.reset}
  ${c.dim}$ regex-test "(\\w+)@(\\w+)" "user@host" --flags gi${c.reset}
  ${c.dim}$ regex-test "(?<year>\\d{4})-(?<month>\\d{2})" "2025-01-15"${c.reset}
  ${c.dim}$ regex-test "error|warn" --bulk /var/log/app.log --flags gi${c.reset}
  ${c.dim}$ regex-test "^\\d{3}-\\d{4}$" --explain${c.reset}
`;

// ── Regex Explainer ──────────────────────────────────────────
interface ExplainPart {
  token: string;
  meaning: string;
}

function explainRegex(pattern: string): ExplainPart[] {
  const parts: ExplainPart[] = [];
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "^") {
      parts.push({ token: "^", meaning: "Start of string/line" });
      i++;
    } else if (ch === "$") {
      parts.push({ token: "$", meaning: "End of string/line" });
      i++;
    } else if (ch === ".") {
      parts.push({ token: ".", meaning: "Any character (except newline)" });
      i++;
    } else if (ch === "*") {
      parts.push({ token: "*", meaning: "Zero or more of the previous" });
      i++;
    } else if (ch === "+") {
      parts.push({ token: "+", meaning: "One or more of the previous" });
      i++;
    } else if (ch === "?") {
      parts.push({ token: "?", meaning: "Zero or one of the previous (optional)" });
      i++;
    } else if (ch === "|") {
      parts.push({ token: "|", meaning: "OR (alternative)" });
      i++;
    } else if (ch === "\\") {
      const next = pattern[i + 1] || "";
      const escapes: Record<string, string> = {
        d: "Any digit (0-9)",
        D: "Any non-digit",
        w: "Any word character (a-z, A-Z, 0-9, _)",
        W: "Any non-word character",
        s: "Any whitespace (space, tab, newline)",
        S: "Any non-whitespace",
        b: "Word boundary",
        B: "Non-word boundary",
        n: "Newline",
        t: "Tab",
        r: "Carriage return",
      };
      if (escapes[next]) {
        parts.push({ token: `\\${next}`, meaning: escapes[next] });
      } else {
        parts.push({ token: `\\${next}`, meaning: `Literal "${next}"` });
      }
      i += 2;
    } else if (ch === "[") {
      let end = pattern.indexOf("]", i);
      if (end === -1) end = pattern.length;
      const charClass = pattern.slice(i, end + 1);
      const negated = pattern[i + 1] === "^";
      parts.push({
        token: charClass,
        meaning: negated
          ? `Any character NOT in ${charClass}`
          : `Any character in ${charClass}`,
      });
      i = end + 1;
    } else if (ch === "(") {
      // Check for named groups, non-capturing, lookaheads
      if (pattern.slice(i, i + 3) === "(?:") {
        parts.push({ token: "(?:", meaning: "Non-capturing group start" });
        i += 3;
      } else if (pattern.slice(i, i + 4) === "(?<=") {
        parts.push({ token: "(?<=", meaning: "Positive lookbehind start" });
        i += 4;
      } else if (pattern.slice(i, i + 4) === "(?<!") {
        parts.push({ token: "(?<!", meaning: "Negative lookbehind start" });
        i += 4;
      } else if (pattern.slice(i, i + 3) === "(?=") {
        parts.push({ token: "(?=", meaning: "Positive lookahead start" });
        i += 3;
      } else if (pattern.slice(i, i + 3) === "(?!") {
        parts.push({ token: "(?!", meaning: "Negative lookahead start" });
        i += 3;
      } else if (pattern[i + 1] === "?" && pattern[i + 2] === "<") {
        const nameEnd = pattern.indexOf(">", i + 3);
        if (nameEnd !== -1) {
          const name = pattern.slice(i + 3, nameEnd);
          parts.push({ token: `(?<${name}>`, meaning: `Named capture group "${name}" start` });
          i = nameEnd + 1;
        } else {
          parts.push({ token: "(", meaning: "Capture group start" });
          i++;
        }
      } else {
        parts.push({ token: "(", meaning: "Capture group start" });
        i++;
      }
    } else if (ch === ")") {
      parts.push({ token: ")", meaning: "Group end" });
      i++;
    } else if (ch === "{") {
      const end = pattern.indexOf("}", i);
      if (end !== -1) {
        const quant = pattern.slice(i, end + 1);
        const inner = pattern.slice(i + 1, end);
        if (inner.includes(",")) {
          const [min, max] = inner.split(",");
          if (max === "") {
            parts.push({ token: quant, meaning: `${min} or more of the previous` });
          } else {
            parts.push({ token: quant, meaning: `Between ${min} and ${max} of the previous` });
          }
        } else {
          parts.push({ token: quant, meaning: `Exactly ${inner} of the previous` });
        }
        i = end + 1;
      } else {
        parts.push({ token: ch, meaning: `Literal "${ch}"` });
        i++;
      }
    } else {
      parts.push({ token: ch, meaning: `Literal "${ch}"` });
      i++;
    }
  }

  return parts;
}

// ── Match Processing ─────────────────────────────────────────
interface MatchResult {
  input: string;
  matches: Array<{
    full: string;
    index: number;
    groups: string[];
    namedGroups: Record<string, string>;
  }>;
  highlighted: string;
}

function testString(pattern: string, flags: string, input: string): MatchResult {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`${c.red}Invalid regex:${c.reset} ${msg}`);
    process.exit(1);
  }

  const result: MatchResult = {
    input,
    matches: [],
    highlighted: input,
  };

  // Collect all matches
  if (flags.includes("g")) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(input)) !== null) {
      result.matches.push({
        full: match[0],
        index: match.index,
        groups: match.slice(1),
        namedGroups: match.groups ? { ...match.groups } : {},
      });
      if (match[0].length === 0) regex.lastIndex++;
    }
  } else {
    const match = regex.exec(input);
    if (match) {
      result.matches.push({
        full: match[0],
        index: match.index,
        groups: match.slice(1),
        namedGroups: match.groups ? { ...match.groups } : {},
      });
    }
  }

  // Build highlighted string
  if (result.matches.length > 0) {
    let highlighted = "";
    let lastEnd = 0;
    for (let mi = 0; mi < result.matches.length; mi++) {
      const m = result.matches[mi];
      const color = MATCH_COLORS[mi % MATCH_COLORS.length];
      highlighted += input.slice(lastEnd, m.index);
      highlighted += `${color}${c.bold}${m.full}${c.reset}`;
      lastEnd = m.index + m.full.length;
    }
    highlighted += input.slice(lastEnd);
    result.highlighted = highlighted;
  }

  return result;
}

// ── Render ───────────────────────────────────────────────────
function renderResult(result: MatchResult): void {
  const matchCount = result.matches.length;
  const icon = matchCount > 0 ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;

  console.log(`\n  ${icon} ${c.bold}${matchCount}${c.reset} match${matchCount === 1 ? "" : "es"} found`);
  console.log(`  ${c.dim}Input:${c.reset}   ${result.input}`);
  console.log(`  ${c.dim}Result:${c.reset}  ${result.highlighted}`);

  for (let i = 0; i < result.matches.length; i++) {
    const m = result.matches[i];
    const color = MATCH_COLORS[i % MATCH_COLORS.length];
    console.log(`\n  ${color} Match ${i + 1} ${c.reset} "${c.bold}${m.full}${c.reset}" at index ${m.index}`);

    if (m.groups.length > 0) {
      console.log(`    ${c.cyan}Capture groups:${c.reset}`);
      for (let g = 0; g < m.groups.length; g++) {
        console.log(`      ${c.dim}$${g + 1}:${c.reset} ${c.yellow}${m.groups[g] ?? "(undefined)"}${c.reset}`);
      }
    }

    const namedKeys = Object.keys(m.namedGroups);
    if (namedKeys.length > 0) {
      console.log(`    ${c.magenta}Named groups:${c.reset}`);
      for (const key of namedKeys) {
        console.log(`      ${c.dim}${key}:${c.reset} ${c.green}${m.namedGroups[key]}${c.reset}`);
      }
    }
  }
}

// ── Main ─────────────────────────────────────────────────────
function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (!opts.pattern) {
    console.error(`${c.red}Error:${c.reset} Please provide a regex pattern.`);
    console.error(`${c.dim}Run with --help for usage info.${c.reset}`);
    process.exit(1);
  }

  // Explain mode
  if (opts.explain) {
    const parts = explainRegex(opts.pattern);
    console.log(`\n${c.bold}${c.cyan}  Regex Breakdown${c.reset}`);
    console.log(`  ${c.dim}Pattern:${c.reset} ${c.yellow}/${opts.pattern}/${c.reset}\n`);

    for (const part of parts) {
      console.log(`  ${c.bold}${c.green}${part.token.padEnd(15)}${c.reset} ${c.dim}${part.meaning}${c.reset}`);
    }
    console.log("");

    if (opts.strings.length === 0 && !opts.bulk) {
      process.exit(0);
    }
  }

  // Bulk mode
  let strings = opts.strings;
  if (opts.bulk) {
    try {
      const content = readFileSync(opts.bulk, "utf-8");
      strings = content.split("\n").filter(Boolean);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${c.red}Error reading file:${c.reset} ${msg}`);
      process.exit(1);
    }
  }

  if (strings.length === 0) {
    console.error(`${c.red}Error:${c.reset} Provide test strings as arguments or use --bulk <file>.`);
    process.exit(1);
  }

  console.log(`\n${c.bold}${c.cyan}  regex-test${c.reset}`);
  console.log(`  ${c.dim}Pattern:${c.reset} ${c.yellow}/${opts.pattern}/${opts.flags}${c.reset}`);

  const allResults: MatchResult[] = [];

  for (const str of strings) {
    const result = testString(opts.pattern, opts.flags, str);
    allResults.push(result);

    if (!opts.json) {
      renderResult(result);
    }
  }

  if (opts.json) {
    const jsonOut = allResults.map((r) => ({
      input: r.input,
      matchCount: r.matches.length,
      matches: r.matches,
    }));
    console.log(JSON.stringify(jsonOut, null, 2));
  }

  // Summary for bulk
  if (strings.length > 1 && !opts.json) {
    const matchedCount = allResults.filter((r) => r.matches.length > 0).length;
    console.log(`\n  ${c.bold}Summary:${c.reset} ${c.green}${matchedCount}${c.reset}/${strings.length} strings matched`);
  }

  console.log("");
}

main();
