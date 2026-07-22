/**
 * A small, safe formula evaluator for power users. NO eval() is used.
 *
 * Supported syntax:
 *   - Column references:   [Column Name]   (name comes from configuration)
 *   - String literals:     "text" or 'text'
 *   - Number literals:     42, 3.14
 *   - Concatenation:       a & b
 *   - Arithmetic:          + - * /
 *   - Comparison:          = <> < > <= >=
 *   - Function calls:      NAME(arg, arg, ...)
 *
 * Built-in functions include NEXT_CALENDAR_DAY / PREV_CALENDAR_DAY, whose
 * employee/date/return column names all come from the expression (i.e. from
 * configuration) — never hardcoded.
 */
import type { CellValue } from "./types";
import { cellToString, isBlank } from "./normalize";

export type FormulaContext = {
  /** Read a column value from the current row. */
  getColumn: (name: string) => CellValue;
  /**
   * Look up a value from the same employee's date +/- offset days.
   * Returns null when the related row is missing or ambiguous.
   */
  lookupCalendarDay: (
    employeeColumn: string,
    dateColumn: string,
    returnColumn: string,
    offsetDays: number,
  ) => CellValue;
};

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "col"; v: string }
  | { t: "ident"; v: string }
  | { t: "op"; v: string }
  | { t: "lparen" }
  | { t: "rparen" }
  | { t: "comma" };

const OPERATORS = ["<=", ">=", "<>", "&", "+", "-", "*", "/", "=", "<", ">"];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    if (ch === "[") {
      const end = input.indexOf("]", i);
      if (end === -1) throw new FormulaError("Unclosed [column reference]");
      tokens.push({ t: "col", v: input.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = input.indexOf(ch, i + 1);
      if (end === -1) throw new FormulaError("Unclosed string literal");
      tokens.push({ t: "str", v: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ t: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ t: "rparen" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ t: "comma" });
      i++;
      continue;
    }
    const twoChar = input.slice(i, i + 2);
    const op = OPERATORS.find((o) => o.length === 2 && o === twoChar) ??
      OPERATORS.find((o) => o.length === 1 && o === ch);
    if (op) {
      tokens.push({ t: "op", v: op });
      i += op.length;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j]!)) j++;
      tokens.push({ t: "num", v: Number(input.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j]!)) j++;
      tokens.push({ t: "ident", v: input.slice(i, j) });
      i = j;
      continue;
    }
    throw new FormulaError(`Unexpected character "${ch}"`);
  }
  return tokens;
}

export class FormulaError extends Error {}

// ---------------------------------------------------------------------------
// Parser (recursive descent with precedence) → AST
// ---------------------------------------------------------------------------

type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "col"; v: string }
  | { k: "call"; name: string; args: Node[] }
  | { k: "bin"; op: string; l: Node; r: Node };

const PRECEDENCE: Record<string, number> = {
  "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1,
  "&": 2,
  "+": 3, "-": 3,
  "*": 4, "/": 4,
};

function parse(tokens: Token[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpression(minPrec = 0): Node {
    let left = parsePrimary();
    while (true) {
      const tk = peek();
      if (!tk || tk.t !== "op") break;
      const prec = PRECEDENCE[tk.v] ?? -1;
      if (prec < minPrec || prec === -1) break;
      next();
      const right = parseExpression(prec + 1);
      left = { k: "bin", op: tk.v, l: left, r: right };
    }
    return left;
  }

  function parsePrimary(): Node {
    const tk = next();
    if (!tk) throw new FormulaError("Unexpected end of expression");
    switch (tk.t) {
      case "num":
        return { k: "num", v: tk.v };
      case "str":
        return { k: "str", v: tk.v };
      case "col":
        return { k: "col", v: tk.v };
      case "lparen": {
        const inner = parseExpression();
        if (next()?.t !== "rparen") throw new FormulaError("Expected )");
        return inner;
      }
      case "ident": {
        if (peek()?.t === "lparen") {
          next(); // consume (
          const args: Node[] = [];
          if (peek()?.t !== "rparen") {
            args.push(parseExpression());
            while (peek()?.t === "comma") {
              next();
              args.push(parseExpression());
            }
          }
          if (next()?.t !== "rparen") throw new FormulaError("Expected )");
          return { k: "call", name: tk.v.toUpperCase(), args };
        }
        // A bare identifier is treated as a column reference for convenience.
        return { k: "col", v: tk.v };
      }
      case "op":
        // Unary minus.
        if (tk.v === "-") {
          const operand = parsePrimary();
          return { k: "bin", op: "-", l: { k: "num", v: 0 }, r: operand };
        }
        throw new FormulaError(`Unexpected operator "${tk.v}"`);
      default:
        throw new FormulaError("Unexpected token");
    }
  }

  const result = parseExpression();
  if (pos !== tokens.length) throw new FormulaError("Unexpected trailing tokens");
  return result;
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

function toNumber(v: CellValue): number {
  if (typeof v === "number") return v;
  const n = Number(cellToString(v));
  return Number.isNaN(n) ? 0 : n;
}

function evalNode(node: Node, ctx: FormulaContext): CellValue {
  switch (node.k) {
    case "num":
      return node.v;
    case "str":
      return node.v;
    case "col":
      return ctx.getColumn(node.v);
    case "bin": {
      if (node.op === "&") {
        return cellToString(evalNode(node.l, ctx)) + cellToString(evalNode(node.r, ctx));
      }
      const l = evalNode(node.l, ctx);
      const r = evalNode(node.r, ctx);
      switch (node.op) {
        case "+": return toNumber(l) + toNumber(r);
        case "-": return toNumber(l) - toNumber(r);
        case "*": return toNumber(l) * toNumber(r);
        case "/": return toNumber(r) === 0 ? 0 : toNumber(l) / toNumber(r);
        case "=": return cellToString(l) === cellToString(r);
        case "<>": return cellToString(l) !== cellToString(r);
        case "<": return toNumber(l) < toNumber(r);
        case ">": return toNumber(l) > toNumber(r);
        case "<=": return toNumber(l) <= toNumber(r);
        case ">=": return toNumber(l) >= toNumber(r);
        default: throw new FormulaError(`Unknown operator ${node.op}`);
      }
    }
    case "call":
      return evalCall(node, ctx);
    default:
      throw new FormulaError("Unknown node");
  }
}

function truthy(v: CellValue): boolean {
  if (typeof v === "boolean") return v;
  if (isBlank(v)) return false;
  if (typeof v === "number") return v !== 0;
  return true;
}

function evalCall(node: Extract<Node, { k: "call" }>, ctx: FormulaContext): CellValue {
  const args = node.args;
  const arg = (i: number): CellValue => (i < args.length ? evalNode(args[i]!, ctx) : null);
  // A literal column name argument (used by lookups) without evaluating it.
  const rawColName = (i: number): string => {
    const a = args[i];
    if (!a) throw new FormulaError(`${node.name}: missing argument ${i + 1}`);
    if (a.k === "col") return a.v;
    if (a.k === "str") return a.v;
    throw new FormulaError(`${node.name}: argument ${i + 1} must be a column reference`);
  };

  switch (node.name) {
    case "CONCAT":
      return args.map((_, i) => cellToString(arg(i))).join("");
    case "TRIM":
      return cellToString(arg(0)).trim();
    case "UPPER":
      return cellToString(arg(0)).toUpperCase();
    case "LOWER":
      return cellToString(arg(0)).toLowerCase();
    case "ISBLANK":
      return isBlank(arg(0));
    case "IF":
      return truthy(arg(0)) ? arg(1) : arg(2);
    case "DEFAULT": {
      const v = arg(0);
      return isBlank(v) ? arg(1) : v;
    }
    case "NEXT_CALENDAR_DAY":
      return ctx.lookupCalendarDay(rawColName(0), rawColName(1), rawColName(2), 1);
    case "PREV_CALENDAR_DAY":
      return ctx.lookupCalendarDay(rawColName(0), rawColName(1), rawColName(2), -1);
    default:
      throw new FormulaError(`Unknown function ${node.name}()`);
  }
}

/** Compile an expression once, evaluate many times against different rows. */
export function compileFormula(expression: string): (ctx: FormulaContext) => CellValue {
  const ast = parse(tokenize(expression));
  return (ctx: FormulaContext) => evalNode(ast, ctx);
}

/** Convenience one-shot evaluation. */
export function evaluateFormula(expression: string, ctx: FormulaContext): CellValue {
  return compileFormula(expression)(ctx);
}
