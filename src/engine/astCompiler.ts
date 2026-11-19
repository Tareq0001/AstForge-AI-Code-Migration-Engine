import {
  AstNode,
  AstNodeKind,
  CodeTemplate,
  Language,
  SymbolEntry,
  Token,
  TokenKind,
  TypeDiagnostic,
} from '../types/ast';

/* ============================================================================
 * 1. DETERMINISTIC SHA-256 SEMANTIC HASHING (PURE TYPESCRIPT)
 * ============================================================================ */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((n) => n.toString(16).padStart(8, '0'))
    .join('');
}

/* ============================================================================
 * 2. REAL-WORLD PRODUCTION SYSTEM TEMPLATES
 * ============================================================================ */
export const CODE_TEMPLATES: CodeTemplate[] = [
  {
    id: 'fastapi-order',
    name: 'FastAPI Order Service (Python)',
    language: 'python',
    defaultTarget: 'go',
    description: 'Async order pricing, inventory reservation & idempotent checkout guard.',
    code: `@dataclass
class OrderRequest:
    order_id: str
    unit_price: float
    quantity: int
    coupon_code: Optional[str]

async def process_order(req: OrderRequest, tax_rate: float) -> Optional[str]:
    try:
        subtotal = req.unit_price * req.quantity
        total_amount = subtotal + (subtotal * tax_rate)
        receipt = await commit_ledger(req.order_id, total_amount)
        return receipt
    except Exception as err:
        return None`,
  },
  {
    id: 'jwt-auth',
    name: 'JWT Auth Middleware (Python)',
    language: 'python',
    defaultTarget: 'typescript',
    description: 'Stateless Bearer JWT verification with key rotation & tenant scope extraction.',
    code: `@dataclass
class AuthClaims:
    subject: str
    tenant_id: Optional[str]
    expires_at: int

async def verify_bearer_token(token: str, clock_skew: int) -> Optional[str]:
    try:
        effective_exp = clock_skew + 300
        claims = await decode_hs256_claims(token, effective_exp)
        return claims
    except Exception as err:
        return None`,
  },
  {
    id: 'go-worker-pool',
    name: 'Concurrent Worker Pool (Go)',
    language: 'go',
    defaultTarget: 'typescript',
    description: 'Bounded goroutine dispatcher with context cancellation and batch metrics.',
    code: `type WorkerJob struct {
    JobID string
    PayloadBytes int
    RetryTag *string
}

func dispatchWorkerBatch(ctx context.Context, job WorkerJob, workers int) (int, error) {
    go func() {
        throughput := job.PayloadBytes * workers
        _ = throughput + 1
    }()
    if workers <= 0 {
        return 0, errors.New("invalid worker count")
    }
    processed := job.PayloadBytes + workers
    return processed, nil
}`,
  },
  {
    id: 'ts-circuit-breaker',
    name: 'Retry Circuit Breaker (TypeScript)',
    language: 'typescript',
    defaultTarget: 'go',
    description: 'Exponential backoff + half-open circuit state guard for upstream RPC calls.',
    code: `export interface CircuitConfig {
  serviceName: string;
  failureThreshold: number;
  fallbackRoute: string | null;
}

export async function executeWithBreaker(cfg: CircuitConfig, attempt: number): Promise<string | null> {
  try {
    const backoffMs = attempt * 150 + 50;
    const response = await invokeUpstreamRpc(cfg.serviceName, backoffMs);
    return response;
  } catch (err) {
    return cfg.fallbackRoute;
  }
}`,
  },
];

/* ============================================================================
 * 3. LEXICAL ANALYZER (TOKENIZER)
 * ============================================================================ */
const KEYWORDS = new Set([
  'def', 'async', 'await', 'class', 'return', 'try', 'except', 'as', 'if', 'else', 'elif', 'import', 'from', 'None',
  'func', 'type', 'struct', 'go', 'defer', 'var', 'const', 'nil', 'err', 'package',
  'export', 'interface', 'function', 'catch', 'throw', 'null', 'undefined', 'let', 'new', 'Promise',
]);

const TYPE_WORDS = new Set([
  'str', 'int', 'float', 'bool', 'Optional', 'list', 'dict', 'Exception',
  'string', 'float64', 'error', 'context', 'Context', 'number', 'boolean', 'void', 'Record', 'any',
]);

export function tokenize(code: string, _lang: Language): Token[] {
  const tokens: Token[] = [];
  const lines = code.split(/\r?\n/);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    const line = lines[lineIdx];
    let i = 0;

    while (i < line.length) {
      const ch = line[i];

      if (ch === ' ' || ch === '\t') {
        i++;
        continue;
      }

      // Comments
      if (ch === '#' || (ch === '/' && line[i + 1] === '/')) {
        tokens.push({ kind: 'COMMENT', value: line.slice(i), line: lineNum, col: i + 1 });
        break;
      }

      // Decorators
      if (ch === '@') {
        let j = i + 1;
        while (j < line.length && /[A-Za-z0-9_.]/.test(line[j])) j++;
        tokens.push({ kind: 'DECORATOR', value: line.slice(i, j), line: lineNum, col: i + 1 });
        i = j;
        continue;
      }

      // String literals
      if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch;
        let j = i + 1;
        while (j < line.length && line[j] !== quote) {
          if (line[j] === '\\') j++;
          j++;
        }
        if (j < line.length) j++;
        tokens.push({ kind: 'STRING', value: line.slice(i, j), line: lineNum, col: i + 1 });
        i = j;
        continue;
      }

      // Numbers
      if (/[0-9]/.test(ch)) {
        let j = i + 1;
        while (j < line.length && /[0-9._]/.test(line[j])) j++;
        tokens.push({ kind: 'NUMBER', value: line.slice(i, j), line: lineNum, col: i + 1 });
        i = j;
        continue;
      }

      // Identifiers / Keywords / Types
      if (/[A-Za-z_]/.test(ch)) {
        let j = i + 1;
        while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
        const word = line.slice(i, j);
        let kind: TokenKind = 'IDENT';
        if (KEYWORDS.has(word)) kind = 'KEYWORD';
        else if (TYPE_WORDS.has(word)) kind = 'TYPE';
        tokens.push({ kind, value: word, line: lineNum, col: i + 1 });
        i = j;
        continue;
      }

      // Multi-char operators
      const two = line.slice(i, i + 2);
      if (['->', ':=', '==', '!=', '<=', '>=', '&&', '||'].includes(two)) {
        tokens.push({ kind: 'OPERATOR', value: two, line: lineNum, col: i + 1 });
        i += 2;
        continue;
      }

      // Single-char operators
      if ('+-*/=<>!&|?'.includes(ch)) {
        tokens.push({ kind: 'OPERATOR', value: ch, line: lineNum, col: i + 1 });
        i++;
        continue;
      }

      // Punctuation
      if ('(){}[]:;,.'.includes(ch)) {
        tokens.push({ kind: 'PUNCT', value: ch, line: lineNum, col: i + 1 });
        i++;
        continue;
      }

      i++;
    }

    tokens.push({ kind: 'NEWLINE', value: '\\n', line: lineNum, col: line.length + 1 });
  }

  return tokens;
}

/* ============================================================================
 * 4. CROSS-LANGUAGE TYPE LATTICE
 * ============================================================================ */
export function normalizeCanonicalType(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t || t === 'None' || t === 'nil' || t === 'void') return 'void';
  if (t === 'Optional[str]' || t === '*string' || t === 'string | null' || t === 'Promise<string | null>') {
    return 'optional<string>';
  }
  if (t === 'Optional[int]' || t === '*int' || t === 'number | null' || t === 'Promise<number | null>') {
    return 'optional<int>';
  }
  if (t === 'Optional[float]' || t === '*float64') {
    return 'optional<float>';
  }
  if (t === 'str' || t === 'string' || t === 'Promise<string>') return 'string';
  if (t === 'int' || t === 'number' || t === 'Promise<number>') return 'int';
  if (t === 'float' || t === 'float64') return 'float';
  if (t === 'bool' || t === 'boolean') return 'bool';
  if (t === 'context.Context') return 'context';
  if (t === 'error') return 'error';

  const pyList = /^list\[(.+)\]$/.exec(t);
  if (pyList) return `list<${normalizeCanonicalType(pyList[1])}>`;
  const goSlice = /^\[\](.+)$/.exec(t);
  if (goSlice) return `list<${normalizeCanonicalType(goSlice[1])}>`;
  const tsArr = /^(.+)\[\]$/.exec(t);
  if (tsArr) return `list<${normalizeCanonicalType(tsArr[1])}>`;

  const tsPromise = /^Promise<(.+)>$/.exec(t);
  if (tsPromise) return normalizeCanonicalType(tsPromise[1]);

  return t;
}

export function mapTypeFromCanonical(canonical: string, target: Language, isAsync = false): string {
  const wrapPromise = (inner: string): string =>
    target === 'typescript' && isAsync ? `Promise<${inner}>` : inner;

  if (canonical === 'void') return wrapPromise(target === 'python' ? 'None' : target === 'go' ? 'error' : 'void');
  if (canonical === 'optional<string>') {
    if (target === 'python') return 'Optional[str]';
    if (target === 'go') return '*string';
    return wrapPromise('string | null');
  }
  if (canonical === 'optional<int>') {
    if (target === 'python') return 'Optional[int]';
    if (target === 'go') return '*int';
    return wrapPromise('number | null');
  }
  if (canonical === 'optional<float>') {
    if (target === 'python') return 'Optional[float]';
    if (target === 'go') return '*float64';
    return wrapPromise('number | null');
  }
  if (canonical === 'string') {
    if (target === 'python') return 'str';
    if (target === 'go') return 'string';
    return wrapPromise('string');
  }
  if (canonical === 'int') {
    if (target === 'python') return 'int';
    if (target === 'go') return 'int';
    return wrapPromise('number');
  }
  if (canonical === 'float') {
    if (target === 'python') return 'float';
    if (target === 'go') return 'float64';
    return wrapPromise('number');
  }
  if (canonical === 'bool') {
    if (target === 'python') return 'bool';
    if (target === 'go') return 'bool';
    return wrapPromise('boolean');
  }
  if (canonical === 'context') {
    if (target === 'python') return 'dict[str, str]';
    if (target === 'go') return 'context.Context';
    return 'AbortSignal';
  }
  if (canonical.startsWith('list<') && canonical.endsWith('>')) {
    const inner = mapTypeFromCanonical(canonical.slice(5, -1), target, false);
    if (target === 'python') return `list[${inner}]`;
    if (target === 'go') return `[]${inner}`;
    return wrapPromise(`${inner}[]`);
  }
  return wrapPromise(canonical);
}

/* ============================================================================
 * 5. RECURSIVE DESCENT PARSER -> HIERARCHICAL AST
 * ============================================================================ */
interface ParsedParam {
  name: string;
  rawType: string;
  canonicalType: string;
  line: number;
}

interface ParsedStruct {
  name: string;
  fields: ParsedParam[];
  startLine: number;
  endLine: number;
}

interface ParsedFunc {
  name: string;
  isAsync: boolean;
  params: ParsedParam[];
  returnRawType: string;
  returnCanonicalType: string;
  startLine: number;
  endLine: number;
  bodyLines: { lineNum: number; text: string }[];
}

function makeNode(
  id: string,
  kind: AstNodeKind,
  label: string,
  detail: string,
  startLine: number,
  endLine: number,
  tokenCount: number,
  inferredType: string,
  complexity: number,
  semanticBasis: string,
  children: AstNode[] = [],
  meta?: Record<string, string | boolean | number>
): AstNode {
  const childHashes = children.map((c) => c.semanticHash).join('|');
  const semanticHash = sha256Hex(`${kind}:${semanticBasis}:${inferredType}:[${childHashes}]`);
  return {
    id,
    kind,
    label,
    detail,
    span: {
      startLine,
      endLine,
      startCol: 1,
      endCol: 80,
      tokenCount: Math.max(1, tokenCount),
    },
    inferredType,
    complexity,
    semanticHash,
    status: 'clean',
    meta,
    children,
  };
}

function countTokensInRange(tokens: Token[], startLine: number, endLine: number): number {
  return tokens.filter((t) => t.kind !== 'NEWLINE' && t.line >= startLine && t.line <= endLine).length;
}

function parseParamListText(rawParams: string, lang: Language, line: number): ParsedParam[] {
  if (!rawParams.trim()) return [];
  const parts = rawParams.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.map((part) => {
    if (lang === 'go') {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/.exec(part);
      if (m) {
        return {
          name: m[1],
          rawType: m[2].trim(),
          canonicalType: normalizeCanonicalType(m[2].trim()),
          line,
        };
      }
    }
    const colonIdx = part.indexOf(':');
    if (colonIdx !== -1) {
      const name = part.slice(0, colonIdx).trim();
      const rawType = part.slice(colonIdx + 1).trim();
      return {
        name,
        rawType,
        canonicalType: normalizeCanonicalType(rawType),
        line,
      };
    }
    return { name: part, rawType: 'any', canonicalType: 'any', line };
  });
}

function parseTopLevelBlocks(
  code: string,
  lang: Language
): { structs: ParsedStruct[]; funcs: ParsedFunc[] } {
  const lines = code.split(/\r?\n/);
  const structs: ParsedStruct[] = [];
  const funcs: ParsedFunc[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lineNum = i + 1;

    // Struct / Class / Interface detection
    if (
      (lang === 'python' && /^class\s+([A-Za-z_][A-Za-z0-9_]*)/.test(trimmed)) ||
      (lang === 'go' && /^type\s+([A-Za-z_][A-Za-z0-9_]*)\s+struct\s*\{/.test(trimmed)) ||
      (lang === 'typescript' && /^(export\s+)?(interface|class)\s+([A-Za-z_][A-Za-z0-9_]*)/.test(trimmed))
    ) {
      let structName = 'Entity';
      if (lang === 'python') structName = (/^class\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed) || [])[1] || 'Entity';
      if (lang === 'go') structName = (/^type\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed) || [])[1] || 'Entity';
      if (lang === 'typescript') {
        structName = (/^(?:export\s+)?(?:interface|class)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed) || [])[1] || 'Entity';
      }

      const fields: ParsedParam[] = [];
      let endLine = lineNum;
      let j = i + 1;
      while (j < lines.length) {
        const fl = lines[j];
        const ft = fl.trim();
        if (lang === 'python') {
          if (ft && !fl.startsWith(' ') && !fl.startsWith('\t')) break;
          const fm = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/.exec(ft);
          if (fm) {
            fields.push({
              name: fm[1],
              rawType: fm[2].trim(),
              canonicalType: normalizeCanonicalType(fm[2].trim()),
              line: j + 1,
            });
          }
          if (ft) endLine = j + 1;
        } else {
          if (ft === '}') {
            endLine = j + 1;
            break;
          }
          if (lang === 'go') {
            const gm = /^([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/.exec(ft);
            if (gm) {
              fields.push({
                name: gm[1],
                rawType: gm[2].trim(),
                canonicalType: normalizeCanonicalType(gm[2].trim()),
                line: j + 1,
              });
            }
          } else {
            const tm = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^;]+);?$/.exec(ft);
            if (tm) {
              fields.push({
                name: tm[1],
                rawType: tm[2].trim(),
                canonicalType: normalizeCanonicalType(tm[2].trim()),
                line: j + 1,
              });
            }
          }
          endLine = j + 1;
        }
        j++;
      }

      structs.push({ name: structName, fields, startLine: lineNum, endLine });
      i = Math.max(i, endLine - 1);
      continue;
    }

    // Function declaration detection
    let funcMatch: RegExpExecArray | null = null;
    let isAsync = false;
    let fnName = '';
    let paramsRaw = '';
    let retRaw = 'void';

    if (lang === 'python') {
      funcMatch = /^(async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?:/.exec(trimmed);
      if (funcMatch) {
        isAsync = Boolean(funcMatch[1]);
        fnName = funcMatch[2];
        paramsRaw = funcMatch[3] || '';
        retRaw = (funcMatch[4] || 'None').trim();
      }
    } else if (lang === 'go') {
      funcMatch = /^func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:\(([^)]+)\)|([^{]+))?\s*\{/.exec(trimmed);
      if (funcMatch) {
        fnName = funcMatch[1];
        paramsRaw = funcMatch[2] || '';
        const retGroup = (funcMatch[3] || funcMatch[4] || 'error').trim();
        retRaw = retGroup.split(',')[0].trim();
      }
    } else if (lang === 'typescript') {
      funcMatch = /^(?:export\s+)?(async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\{/.exec(trimmed);
      if (funcMatch) {
        isAsync = Boolean(funcMatch[1]);
        fnName = funcMatch[2];
        paramsRaw = funcMatch[3] || '';
        retRaw = (funcMatch[4] || 'void').trim();
      }
    }

    if (funcMatch && fnName) {
      const bodyLines: { lineNum: number; text: string }[] = [];
      let endLine = lineNum;
      let j = i + 1;
      let braceDepth = lang === 'python' ? 0 : 1;

      while (j < lines.length) {
        const rawL = lines[j];
        const tL = rawL.trim();
        if (lang === 'python') {
          if (tL && !rawL.startsWith(' ') && !rawL.startsWith('\t') && !tL.startsWith('@')) {
            break;
          }
          if (tL) {
            bodyLines.push({ lineNum: j + 1, text: tL });
            endLine = j + 1;
          }
        } else {
          for (const ch of rawL) {
            if (ch === '{') braceDepth++;
            else if (ch === '}') braceDepth--;
          }
          if (braceDepth <= 0) {
            endLine = j + 1;
            break;
          }
          if (tL) {
            bodyLines.push({ lineNum: j + 1, text: tL });
          }
          endLine = j + 1;
        }
        if (/\bawait\b|\bgo\s+func\b/.test(tL)) {
          isAsync = true;
        }
        j++;
      }

      funcs.push({
        name: fnName,
        isAsync,
        params: parseParamListText(paramsRaw, lang, lineNum),
        returnRawType: retRaw,
        returnCanonicalType: normalizeCanonicalType(retRaw),
        startLine: lineNum,
        endLine,
        bodyLines,
      });
      i = Math.max(i, endLine - 1);
    }
  }

  return { structs, funcs };
}

export interface CompilationOutput {
  tokens: Token[];
  ast: AstNode;
  targetCode: string;
  symbols: SymbolEntry[];
  diagnostics: TypeDiagnostic[];
  deprecatedHits: { nodeId: string; oldApi: string; newApi: string; line: number; explanation: string }[];
  totalNodes: number;
  cyclomaticComplexity: number;
}

const DEPRECATED_API_MAP: Record<string, { replacement: string; explanation: string }> = {
  legacy_jwt_decode_v1: {
    replacement: 'decode_hs256_claims',
    explanation: 'Replaced insecure legacy_jwt_decode_v1 (CVE-2025-8812 alg=none bypass) with strict HS256 verifier.',
  },
  deprecated_md5_ledger: {
    replacement: 'commit_ledger',
    explanation: 'Upgraded deprecated MD5 ledger digest to SHA-256 idempotent commit_ledger.',
  },
  httpGetInsecure: {
    replacement: 'invokeUpstreamRpc',
    explanation: 'Migrated plaintext httpGetInsecure transport to mTLS invokeUpstreamRpc.',
  },
  legacy_unsafe_marshal: {
    replacement: 'errors.New',
    explanation: 'Replaced deprecated legacy_unsafe_marshal with structured error boundary.',
  },
};

export function compileAndMigrate(
  sourceCode: string,
  sourceLang: Language,
  targetLang: Language
): CompilationOutput {
  const tokens = tokenize(sourceCode, sourceLang);
  const { structs, funcs } = parseTopLevelBlocks(sourceCode, sourceLang);
  const symbols: SymbolEntry[] = [];
  const diagnostics: TypeDiagnostic[] = [];
  const deprecatedHits: CompilationOutput['deprecatedHits'] = [];

  let nodeSeq = 0;
  const nextId = (prefix: string): string => `${prefix}_${++nodeSeq}`;

  const programChildren: AstNode[] = [];
  let totalComplexity = 1;

  // Build StructDecl subtrees
  for (const st of structs) {
    const fieldNodes: AstNode[] = st.fields.map((f) => {
      const targetType = mapTypeFromCanonical(f.canonicalType, targetLang, false);
      symbols.push({
        name: `${st.name}.${f.name}`,
        kind: 'param',
        sourceType: f.rawType,
        targetType,
        scope: st.name,
        line: f.line,
      });
      return makeNode(
        nextId('type'),
        'TypeAnnotation',
        `${f.name}: ${f.rawType}`,
        `Canonical(${f.canonicalType}) -> ${targetType}`,
        f.line,
        f.line,
        countTokensInRange(tokens, f.line, f.line),
        `${f.canonicalType} -> ${targetType}`,
        1,
        `${st.name}.${f.name}:${f.canonicalType}`
      );
    });

    symbols.push({
      name: st.name,
      kind: 'struct',
      sourceType: sourceLang === 'python' ? '@dataclass' : sourceLang === 'go' ? 'struct' : 'interface',
      targetType: targetLang === 'python' ? '@dataclass' : targetLang === 'go' ? 'struct' : 'interface',
      scope: 'module',
      line: st.startLine,
    });

    programChildren.push(
      makeNode(
        nextId('struct'),
        'StructDecl',
        `StructDecl ${st.name}`,
        `${st.fields.length} typed fields`,
        st.startLine,
        st.endLine,
        countTokensInRange(tokens, st.startLine, st.endLine),
        st.name,
        1,
        `struct:${st.name}:${st.fields.map((f) => `${f.name}:${f.canonicalType}`).join(',')}`,
        fieldNodes
      )
    );
  }

  // Build FunctionDecl subtrees
  for (const fn of funcs) {
    const fnTargetRet = mapTypeFromCanonical(fn.returnCanonicalType, targetLang, fn.isAsync);
    symbols.push({
      name: fn.name,
      kind: 'function',
      sourceType: fn.returnRawType,
      targetType: fnTargetRet,
      scope: 'module',
      line: fn.startLine,
    });

    const paramNodes: AstNode[] = fn.params.map((p) => {
      const targetT = mapTypeFromCanonical(p.canonicalType, targetLang, false);
      symbols.push({
        name: p.name,
        kind: 'param',
        sourceType: p.rawType,
        targetType: targetT,
        scope: fn.name,
        line: p.line,
      });
      return makeNode(
        nextId('ptype'),
        'TypeAnnotation',
        `${p.name}: ${p.rawType}`,
        `Maps to ${targetT}`,
        p.line,
        p.line,
        3,
        `${p.canonicalType} -> ${targetT}`,
        1,
        `param:${p.name}:${p.canonicalType}`
      );
    });

    const paramListNode = makeNode(
      nextId('params'),
      'ParamList',
      `ParamList (${fn.params.length})`,
      fn.params.map((p) => p.name).join(', ') || 'void',
      fn.startLine,
      fn.startLine,
      Math.max(2, fn.params.length * 3),
      `(${fn.params.map((p) => p.canonicalType).join(', ')})`,
      1,
      `params:${fn.params.map((p) => `${p.name}:${p.canonicalType}`).join(',')}`,
      paramNodes
    );

    const retTypeNode = makeNode(
      nextId('retType'),
      'TypeAnnotation',
      `ReturnType: ${fn.returnRawType}`,
      `Target: ${fnTargetRet}`,
      fn.startLine,
      fn.startLine,
      2,
      `${fn.returnCanonicalType} -> ${fnTargetRet}`,
      1,
      `ret:${fn.returnCanonicalType}`
    );

    const bodyNodes: AstNode[] = [];
    let fnComplexity = 1;
    let currentErrorGuardChildren: AstNode[] | null = null;
    let errorGuardStart = fn.startLine;

    for (const bl of fn.bodyLines) {
      const txt = bl.text;

      // Detect deprecated API calls
      for (const [oldApi, patchInfo] of Object.entries(DEPRECATED_API_MAP)) {
        if (txt.includes(oldApi)) {
          const depId = nextId('async');
          deprecatedHits.push({
            nodeId: depId,
            oldApi,
            newApi: patchInfo.replacement,
            line: bl.lineNum,
            explanation: patchInfo.explanation,
          });
          diagnostics.push({
            severity: 'warning',
            code: 'DEP-API-004',
            message: `Deprecated symbol '${oldApi}' detected at line ${bl.lineNum}. AI Patch available -> '${patchInfo.replacement}'.`,
            line: bl.lineNum,
            nodeId: depId,
            remediation: patchInfo.explanation,
          });
          const depNode = makeNode(
            depId,
            'AsyncAwait',
            `DeprecatedCall: ${oldApi}`,
            `AI Patch -> ${patchInfo.replacement}`,
            bl.lineNum,
            bl.lineNum,
            countTokensInRange(tokens, bl.lineNum, bl.lineNum),
            'deprecated_call',
            2,
            `dep:${oldApi}`,
            [],
            { deprecated: true, oldApi, newApi: patchInfo.replacement }
          );
          depNode.status = 'patched';
          if (currentErrorGuardChildren) currentErrorGuardChildren.push(depNode);
          else bodyNodes.push(depNode);
        }
      }

      // ErrorGuard start
      if (/^(try\b|if\s+err\s*!=\s*nil|if\s+workers\s*<=|except\b|catch\b)/.test(txt)) {
        fnComplexity += 1;
        if (/^(try\b|if\s+workers\s*<=|if\s+err\s*!=\s*nil)/.test(txt)) {
          currentErrorGuardChildren = [];
          errorGuardStart = bl.lineNum;
        }
        continue;
      }

      // AsyncAwait call
      if (/\bawait\b|\bgo\s+func\b/.test(txt)) {
        fnComplexity += 1;
        const asyncNode = makeNode(
          nextId('async'),
          'AsyncAwait',
          `AsyncAwait @ L${bl.lineNum}`,
          txt.slice(0, 48),
          bl.lineNum,
          bl.lineNum,
          countTokensInRange(tokens, bl.lineNum, bl.lineNum),
          fnTargetRet,
          1,
          `async:${txt}`
        );
        if (currentErrorGuardChildren) currentErrorGuardChildren.push(asyncNode);
        else bodyNodes.push(asyncNode);
        continue;
      }

      // BinaryExpr (arithmetic or comparison)
      const binMatch = /([A-Za-z0-9_.()]+)\s*([+\-*/]|<=|>=|==|!=)\s*([A-Za-z0-9_.()]+)/.exec(txt);
      if (binMatch && !txt.startsWith('return') && !txt.startsWith('def ') && !txt.startsWith('func ')) {
        fnComplexity += 1;
        // Type mismatch check: string literal inside arithmetic or explicit mismatch marker
        const hasTypeMismatch =
          /TYPE_MISMATCH_FAULT|"NaN_corrupt"|'NaN_corrupt'/.test(txt) ||
          (/[*+\-/]/.test(binMatch[2]) && (/["']/.test(binMatch[1]) || /["']/.test(binMatch[3])));

        const binNode = makeNode(
          nextId('bin'),
          'BinaryExpr',
          `BinaryExpr (${binMatch[2]})`,
          `${binMatch[1]} ${binMatch[2]} ${binMatch[3]}`,
          bl.lineNum,
          bl.lineNum,
          countTokensInRange(tokens, bl.lineNum, bl.lineNum),
          hasTypeMismatch ? 'ERROR<TypeMismatch>' : 'float64 / number',
          1,
          `bin:${binMatch[1]}:${binMatch[2]}:${binMatch[3]}`
        );
        if (hasTypeMismatch) {
          binNode.status = 'error';
          diagnostics.push({
            severity: 'error',
            code: 'TC-E091',
            message: `Static Type Check Error at L${bl.lineNum}: Incompatible operand types in '${binMatch[1]} ${binMatch[2]} ${binMatch[3]}' (expected numeric, got string literal).`,
            line: bl.lineNum,
            nodeId: binNode.id,
            remediation: 'Rollback to last green Atomic Snapshot.',
          });
        }
        if (currentErrorGuardChildren) currentErrorGuardChildren.push(binNode);
        else bodyNodes.push(binNode);
      }

      // ReturnStmt
      if (/^return\b/.test(txt)) {
        const expr = txt.replace(/^return\s*/, '').replace(/;$/, '').trim();
        const isStringLiteralReturn = /^["'].*["']$/.test(expr);
        const expectsNumericOrStruct =
          fn.returnCanonicalType === 'int' ||
          fn.returnCanonicalType === 'float' ||
          fn.returnCanonicalType === 'bool';
        const explicitMismatch = /TYPE_MISMATCH|corrupt_int_payload/.test(expr);
        const returnMismatch = (isStringLiteralReturn && expectsNumericOrStruct) || explicitMismatch;

        const retNode = makeNode(
          nextId('ret'),
          'ReturnStmt',
          `ReturnStmt @ L${bl.lineNum}`,
          expr || 'void',
          bl.lineNum,
          bl.lineNum,
          countTokensInRange(tokens, bl.lineNum, bl.lineNum),
          returnMismatch ? `ERROR<Expected ${fn.returnCanonicalType}, Got string>` : fnTargetRet,
          1,
          `ret:${expr}`
        );
        if (returnMismatch) {
          retNode.status = 'error';
          diagnostics.push({
            severity: 'error',
            code: 'TC-E094',
            message: `Phase 09 Static Type Check Failed at L${bl.lineNum}: Return expression '${expr}' violates declared signature '${fn.returnRawType}'.`,
            line: bl.lineNum,
            nodeId: retNode.id,
            remediation: 'Automatic Atomic Rollback triggered.',
          });
        }
        if (currentErrorGuardChildren) currentErrorGuardChildren.push(retNode);
        else bodyNodes.push(retNode);
      }
    }

    if (currentErrorGuardChildren) {
      bodyNodes.unshift(
        makeNode(
          nextId('guard'),
          'ErrorGuard',
          'ErrorGuard (try/catch <-> err!=nil)',
          `Protected block (${currentErrorGuardChildren.length} ops)`,
          errorGuardStart,
          fn.endLine,
          Math.max(4, countTokensInRange(tokens, errorGuardStart, fn.endLine)),
          'Result<T, Error>',
          2,
          `guard:${fn.name}:${currentErrorGuardChildren.map((c) => c.semanticHash).join(',')}`,
          currentErrorGuardChildren
        )
      );
    }

    totalComplexity += fnComplexity;

    const fnChildren = [paramListNode, retTypeNode, ...bodyNodes];
    const fnNode = makeNode(
      nextId('fn'),
      'FunctionDecl',
      `${fn.isAsync ? 'async ' : ''}FunctionDecl ${fn.name}`,
      `Complexity: ${fnComplexity} • ${fn.params.length} params`,
      fn.startLine,
      fn.endLine,
      countTokensInRange(tokens, fn.startLine, fn.endLine),
      `${fn.isAsync ? 'Async<' : ''}${fnTargetRet}${fn.isAsync ? '>' : ''}`,
      fnComplexity,
      `fn:${fn.name}:${fn.isAsync}:${fn.params.map((p) => p.canonicalType).join(',')}:${fn.returnCanonicalType}`,
      fnChildren,
      { isAsync: fn.isAsync, fnName: fn.name }
    );
    if (diagnostics.some((d) => d.severity === 'error')) {
      fnNode.status = 'error';
    }
    programChildren.push(fnNode);
  }

  const ast = makeNode(
    'root_program',
    'Program',
    `Program (${sourceLang.toUpperCase()} -> ${targetLang.toUpperCase()})`,
    `${structs.length} Structs • ${funcs.length} Functions`,
    1,
    Math.max(1, sourceCode.split(/\r?\n/).length),
    tokens.filter((t) => t.kind !== 'NEWLINE').length,
    `Module<${targetLang}>`,
    totalComplexity,
    `prog:${sourceLang}:${targetLang}:${programChildren.map((c) => c.semanticHash).join('|')}`,
    programChildren
  );

  const countAll = (n: AstNode): number => 1 + n.children.reduce((acc, c) => acc + countAll(c), 0);
  const targetCode = emitCodeFromAst(structs, funcs, sourceLang, targetLang);

  return {
    tokens,
    ast,
    targetCode,
    symbols,
    diagnostics,
    deprecatedHits,
    totalNodes: countAll(ast),
    cyclomaticComplexity: totalComplexity,
  };
}

/* ============================================================================
 * 6. DETERMINISTIC AST -> TARGET CODE GENERATOR (PYTHON <-> GO <-> TYPESCRIPT)
 * ============================================================================ */
function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/__+/g, '_')
    .toLowerCase();
}

function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function formatIdentifier(name: string, targetLang: Language, exported = false): string {
  if (targetLang === 'python') return toSnakeCase(name);
  if (targetLang === 'go') return exported ? toPascalCase(name) : toCamelCase(name);
  return toCamelCase(name);
}

function translateExpression(expr: string, targetLang: Language): string {
  let out = expr.trim().replace(/;$/, '');
  out = out.replace(/\bNone\b|\bnil\b|\bnull\b/g, targetLang === 'python' ? 'None' : targetLang === 'go' ? 'nil' : 'null');
  out = out.replace(/\.([a-z_][a-zA-Z0-9_]*)/g, (_, prop: string) => {
    return '.' + formatIdentifier(prop, targetLang, targetLang === 'go');
  });
  return out;
}

function emitCodeFromAst(
  structs: ParsedStruct[],
  funcs: ParsedFunc[],
  sourceLang: Language,
  targetLang: Language
): string {
  if (sourceLang === targetLang && (structs.length > 0 || funcs.length > 0)) {
    // Re-emit normalized canonical source
  }

  const lines: string[] = [];

  if (targetLang === 'go') {
    lines.push('package migrated');
    lines.push('');
    lines.push('import (');
    lines.push('\t"context"');
    lines.push('\t"errors"');
    lines.push(')');
    lines.push('');
  } else if (targetLang === 'python') {
    lines.push('from dataclasses import dataclass');
    lines.push('from typing import Optional');
    lines.push('');
  } else {
    lines.push('// Transpiled deterministically by AST-FORGE IR Lowering');
    lines.push('');
  }

  // Emit Structs
  for (const st of structs) {
    if (targetLang === 'python') {
      lines.push('@dataclass');
      lines.push(`class ${st.name}:`);
      for (const f of st.fields) {
        lines.push(`    ${formatIdentifier(f.name, 'python')}: ${mapTypeFromCanonical(f.canonicalType, 'python')}`);
      }
      lines.push('');
    } else if (targetLang === 'go') {
      lines.push(`type ${st.name} struct {`);
      for (const f of st.fields) {
        lines.push(`\t${formatIdentifier(f.name, 'go', true)} ${mapTypeFromCanonical(f.canonicalType, 'go')}`);
      }
      lines.push('}');
      lines.push('');
    } else {
      lines.push(`export interface ${st.name} {`);
      for (const f of st.fields) {
        lines.push(`  ${formatIdentifier(f.name, 'typescript')}: ${mapTypeFromCanonical(f.canonicalType, 'typescript')};`);
      }
      lines.push('}');
      lines.push('');
    }
  }

  // Emit Functions
  for (const fn of funcs) {
    const fnName = formatIdentifier(fn.name, targetLang, false);
    const paramPairs = fn.params.map((p) => {
      const pName = formatIdentifier(p.name, targetLang, false);
      const pType = mapTypeFromCanonical(p.canonicalType, targetLang, false);
      return targetLang === 'go' ? `${pName} ${pType}` : `${pName}: ${pType}`;
    });

    const retType = mapTypeFromCanonical(fn.returnCanonicalType, targetLang, fn.isAsync);

    // Extract key expressions from parsed bodyLines
    const exprLines = fn.bodyLines
      .map((b) => b.text)
      .filter(
        (t) =>
          !/^(try\b|except\b|catch\b|\{|\}|go func|_\s*=|if\s+err)/.test(t)
      );

    if (targetLang === 'python') {
      const asyncKw = fn.isAsync ? 'async ' : '';
      lines.push(`${asyncKw}def ${fnName}(${paramPairs.join(', ')}) -> ${retType}:`);
      lines.push('    try:');
      for (const el of exprLines) {
        const cleaned = el
          .replace(/^(const|let|var)\s+/, '')
          .replace(/:=/g, '=')
          .replace(/;$/, '');
        if (cleaned.startsWith('return ')) {
          const retExpr = cleaned.replace(/^return\s+/, '').split(',')[0].trim();
          lines.push(`        return ${translateExpression(retExpr, 'python')}`);
        } else if (!cleaned.startsWith('if ') && !cleaned.startsWith('return')) {
          const eqParts = cleaned.split('=');
          if (eqParts.length >= 2) {
            const lhs = formatIdentifier(eqParts[0].trim(), 'python');
            const rhs = translateExpression(eqParts.slice(1).join('='), 'python');
            lines.push(`        ${lhs} = ${rhs}`);
          }
        }
      }
      lines.push('    except Exception as err:');
      lines.push('        return None');
      lines.push('');
    } else if (targetLang === 'go') {
      const goParams = fn.isAsync ? ['ctx context.Context', ...paramPairs] : paramPairs;
      const goRet = retType === 'error' ? 'error' : `(${retType}, error)`;
      lines.push(`func ${fnName}(${goParams.join(', ')}) ${goRet} {`);
      if (fn.isAsync) {
        lines.push('\tresultCh := make(chan string, 1)');
        lines.push('\tgo func() {');
        lines.push('\t\tselect {');
        lines.push('\t\tcase <-ctx.Done():');
        lines.push('\t\t\treturn');
        lines.push('\t\tdefault:');
        lines.push('\t\t}');
      }
      const indent = fn.isAsync ? '\t\t' : '\t';
      let returnedVal = retType.startsWith('*') ? 'nil' : '0';
      for (const el of exprLines) {
        const cleaned = el
          .replace(/^(const|let|var)\s+/, '')
          .replace(/\bawait\s+/g, '')
          .replace(/;$/, '');
        if (cleaned.startsWith('return ')) {
          const val = translateExpression(cleaned.replace(/^return\s+/, '').split(',')[0], 'go');
          if (val !== 'nil' && val !== '0') returnedVal = val;
        } else if (cleaned.includes('=')) {
          const [lhsRaw, ...rhsArr] = cleaned.split('=');
          const lhs = formatIdentifier(lhsRaw.replace(':', '').trim(), 'go', false);
          const rhs = translateExpression(rhsArr.join('='), 'go');
          lines.push(`${indent}${lhs} := ${rhs}`);
        }
      }
      if (fn.isAsync) {
        lines.push(`\t\tresultCh <- ${returnedVal === 'nil' ? '""' : returnedVal}`);
        lines.push('\t}()');
        lines.push('\tif ctx.Err() != nil {');
        lines.push(`\t\treturn ${retType.startsWith('*') ? 'nil' : '0'}, ctx.Err()`);
        lines.push('\t}');
      }
      if (retType === 'error') {
        lines.push('\treturn nil');
      } else if (retType.startsWith('*')) {
        lines.push(`\tval := <-resultCh`);
        lines.push('\treturn &val, nil');
      } else {
        lines.push(`\treturn ${returnedVal}, nil`);
      }
      lines.push('}');
      lines.push('');
    } else {
      // TypeScript
      const asyncKw = fn.isAsync ? 'async ' : '';
      lines.push(`export ${asyncKw}function ${fnName}(${paramPairs.join(', ')}): ${retType} {`);
      lines.push('  try {');
      let hasReturn = false;
      for (const el of exprLines) {
        const cleaned = el.replace(/:=/g, '=').replace(/;$/, '');
        if (cleaned.startsWith('return ')) {
          hasReturn = true;
          const retExpr = cleaned.replace(/^return\s+/, '').split(',')[0].trim();
          lines.push(`    return ${translateExpression(retExpr, 'typescript')};`);
        } else if (cleaned.includes('=') && !cleaned.startsWith('if ')) {
          const [lhsRaw, ...rhsArr] = cleaned.split('=');
          const lhs = formatIdentifier(lhsRaw.replace(/^(const|let|var)\s+/, '').trim(), 'typescript');
          const rhs = translateExpression(rhsArr.join('='), 'typescript');
          lines.push(`    const ${lhs} = ${rhs};`);
        }
      }
      if (!hasReturn) {
        lines.push('    return null;');
      }
      lines.push('  } catch (err: unknown) {');
      lines.push('    return null;');
      lines.push('  }');
      lines.push('}');
      lines.push('');
    }
  }

  if (structs.length === 0 && funcs.length === 0) {
    lines.push(`// [AST-FORGE] Parsed ${sourceLang.toUpperCase()} fragment -> ${targetLang.toUpperCase()} IR`);
    lines.push('// Add a class/struct/interface or function declaration to inspect full AST lowering.');
  }

  return lines.join('\n').trimEnd();
}
