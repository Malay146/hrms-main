export type SalaryCategory =
  | "basic"
  | "allowance"
  | "gross"
  | "deduction"
  | "net"
  | "contribution";

export type RuleComputation =
  | "fixed"
  | "percent_of_wage"
  | "percent_of_basic"
  | "percent_of_gross"
  | "percent_of_category"
  | "formula";

export type ComputeRule = {
  name: string;
  code: string;
  category: SalaryCategory;
  sequence: number;
  computation: RuleComputation;
  amount?: number;
  percentage?: number;
  percentBaseCode?: string;
  formula?: string;
};

export type ComputeContext = {
  wage: number;
  workedDays: number;
  scheduledDays: number;
  unpaidLeaveDays: number;
};

export type ComputeLine = {
  name: string;
  code: string;
  category: SalaryCategory;
  amount: number;
};

export type ComputeResult = {
  lines: ComputeLine[];
  gross: number;
  net: number;
};

export type FormulaEnv = {
  wage: number;
  workedDays: number;
  scheduledDays: number;
  unpaidLeaveDays: number;
  categories: Record<SalaryCategory, number>;
  byCode: Record<string, number>;
};

const EMPTY_CATEGORIES = (): Record<SalaryCategory, number> => ({
  basic: 0,
  allowance: 0,
  gross: 0,
  deduction: 0,
  net: 0,
  contribution: 0,
});

export function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computePayslip(rules: ComputeRule[], context: ComputeContext): ComputeResult {
  const ordered = [...rules].sort((a, b) => a.sequence - b.sequence);
  const categories = EMPTY_CATEGORIES();
  const byCode: Record<string, number> = {};
  const lines: ComputeLine[] = [];

  for (const rule of ordered) {
    const amount = roundMoney(computeRuleAmount(rule, context, categories, byCode));
    lines.push({
      name: rule.name,
      code: rule.code,
      category: rule.category,
      amount,
    });
    byCode[rule.code] = amount;
    if (rule.category === "gross" || rule.category === "net") {
      categories[rule.category] = amount;
    } else {
      categories[rule.category] = roundMoney(categories[rule.category] + amount);
    }
  }

  return {
    lines,
    gross: categories.gross,
    net: categories.net,
  };
}

function computeRuleAmount(
  rule: ComputeRule,
  context: ComputeContext,
  categories: Record<SalaryCategory, number>,
  byCode: Record<string, number>,
) {
  switch (rule.computation) {
    case "fixed":
      return rule.amount ?? 0;
    case "percent_of_wage":
      return context.wage * ((rule.percentage ?? 0) / 100);
    case "percent_of_basic":
      return categories.basic * ((rule.percentage ?? 0) / 100);
    case "percent_of_gross":
      return categories.gross * ((rule.percentage ?? 0) / 100);
    case "percent_of_category": {
      const base = rule.percentBaseCode ? (byCode[rule.percentBaseCode] ?? 0) : 0;
      return base * ((rule.percentage ?? 0) / 100);
    }
    case "formula":
      return evaluateFormula(rule.formula ?? "0", {
        ...context,
        categories: { ...categories },
        byCode: { ...byCode },
      });
    default:
      return 0;
  }
}

const FORMULA_ALLOWED = /^[0-9+\-*/(). _a-zA-Z\[\]'"]+$/;
const FORMULA_BANNED = /\b(require|process|window|Function|eval|globalThis|global|constructor|import)\b/;

export function evaluateFormula(raw: string, env: FormulaEnv) {
  let source = raw.trim();
  source = source.replace(/^result\s*=\s*/i, "");
  if (!source) throw new Error("Formula is empty.");
  if (!FORMULA_ALLOWED.test(source) || FORMULA_BANNED.test(source)) {
    throw new Error("Unsafe formula.");
  }

  const parser = new FormulaParser(source, env);
  const value = parser.parseExpression();
  parser.expectEnd();
  return value;
}

class FormulaParser {
  private index = 0;

  constructor(
    private readonly source: string,
    private readonly env: FormulaEnv,
  ) {}

  parseExpression(): number {
    return this.parseAdd();
  }

  expectEnd() {
    this.skipSpaces();
    if (this.index < this.source.length) {
      throw new Error("Unexpected formula token.");
    }
  }

  private parseAdd(): number {
    let value = this.parseMul();
    while (true) {
      this.skipSpaces();
      const op = this.source[this.index];
      if (op !== "+" && op !== "-") break;
      this.index += 1;
      const right = this.parseMul();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  private parseMul(): number {
    let value = this.parseUnary();
    while (true) {
      this.skipSpaces();
      const op = this.source[this.index];
      if (op !== "*" && op !== "/") break;
      this.index += 1;
      const right = this.parseUnary();
      if (op === "/" && right === 0) return 0;
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }

  private parseUnary(): number {
    this.skipSpaces();
    if (this.source[this.index] === "+") {
      this.index += 1;
      return this.parseUnary();
    }
    if (this.source[this.index] === "-") {
      this.index += 1;
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipSpaces();
    const ch = this.source[this.index];
    if (ch === "(") {
      this.index += 1;
      const value = this.parseAdd();
      this.skipSpaces();
      if (this.source[this.index] !== ")") throw new Error("Missing closing parenthesis.");
      this.index += 1;
      return value;
    }
    if (ch && /[0-9.]/.test(ch)) {
      return this.parseNumber();
    }
    if (ch && /[A-Za-z_]/.test(ch)) {
      return this.parseReference();
    }
    throw new Error("Unexpected formula token.");
  }

  private parseNumber(): number {
    const start = this.index;
    while (this.index < this.source.length && /[0-9.]/.test(this.source[this.index] ?? "")) {
      this.index += 1;
    }
    const value = Number(this.source.slice(start, this.index));
    if (!Number.isFinite(value)) throw new Error("Invalid number in formula.");
    return value;
  }

  private parseReference(): number {
    const name = this.parseIdent();
    if (name === "wage") return this.env.wage;
    if (name === "workedDays") return this.env.workedDays;
    if (name === "scheduledDays") return this.env.scheduledDays;
    if (name === "unpaidLeaveDays") return this.env.unpaidLeaveDays;
    if (name === "categories") {
      const key = this.parseAccessor();
      return this.env.categories[key as SalaryCategory] ?? 0;
    }
    if (name === "byCode") {
      const key = this.parseAccessor();
      return this.env.byCode[key] ?? 0;
    }
    if (this.env.byCode[name] !== undefined) return this.env.byCode[name];
    throw new Error(`Unknown formula identifier: ${name}`);
  }

  private parseAccessor() {
    this.skipSpaces();
    if (this.source[this.index] === ".") {
      this.index += 1;
      return this.parseIdent();
    }
    if (this.source[this.index] === "[") {
      this.index += 1;
      this.skipSpaces();
      const quote = this.source[this.index];
      if (quote !== "'" && quote !== '"') throw new Error("Expected quoted key.");
      this.index += 1;
      const start = this.index;
      while (this.index < this.source.length && this.source[this.index] !== quote) {
        this.index += 1;
      }
      const key = this.source.slice(start, this.index);
      if (this.source[this.index] !== quote) throw new Error("Unclosed quote.");
      this.index += 1;
      this.skipSpaces();
      if (this.source[this.index] !== "]") throw new Error("Missing closing bracket.");
      this.index += 1;
      return key;
    }
    throw new Error("Expected property accessor.");
  }

  private parseIdent() {
    this.skipSpaces();
    const start = this.index;
    if (!/[A-Za-z_]/.test(this.source[this.index] ?? "")) {
      throw new Error("Expected identifier.");
    }
    this.index += 1;
    while (this.index < this.source.length && /[A-Za-z0-9_]/.test(this.source[this.index] ?? "")) {
      this.index += 1;
    }
    return this.source.slice(start, this.index);
  }

  private skipSpaces() {
    while (this.source[this.index] === " ") this.index += 1;
  }
}
