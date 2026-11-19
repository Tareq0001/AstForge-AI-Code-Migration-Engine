import {
  AstNode,
  CacheBenchmarkResult,
  DiffLine,
  Language,
  PipelineStageInfo,
} from '../types/ast';
import { compileAndMigrate, CompilationOutput } from './astCompiler';

export const PIPELINE_STAGES: PipelineStageInfo[] = [
  {
    index: 1,
    code: '01',
    name: 'Lexer',
    shortName: 'Lexer',
    detail: 'Tokenizing source stream into typed lexical spans',
    targetNodeKinds: ['Program'],
  },
  {
    index: 2,
    code: '02',
    name: 'AST Parse',
    shortName: 'AST Parse',
    detail: 'Recursive descent parsing into typed hierarchical AST',
    targetNodeKinds: ['Program', 'StructDecl', 'FunctionDecl'],
  },
  {
    index: 3,
    code: '03',
    name: 'Symbol Table',
    shortName: 'Symbols',
    detail: 'Resolving lexical scopes, struct fields & signatures',
    targetNodeKinds: ['StructDecl', 'FunctionDecl', 'ParamList'],
  },
  {
    index: 4,
    code: '04',
    name: 'Type Inference',
    shortName: 'Type Inf',
    detail: 'Unifying cross-language types across lattice constraints',
    targetNodeKinds: ['TypeAnnotation', 'ParamList'],
  },
  {
    index: 5,
    code: '05',
    name: 'Semantic Hash Cache',
    shortName: 'SHA Cache',
    detail: 'Probing SHA-256 subtree Merkle cache (~78% token savings)',
    targetNodeKinds: ['StructDecl', 'FunctionDecl'],
  },
  {
    index: 6,
    code: '06',
    name: 'Dependency Graph',
    shortName: 'Dep Graph',
    detail: 'Topological ordering of imports, async barriers & guards',
    targetNodeKinds: ['AsyncAwait', 'ErrorGuard'],
  },
  {
    index: 7,
    code: '07',
    name: 'LLM/IR Lowering',
    shortName: 'IR Lower',
    detail: 'Lowering uncached AST subtrees via SSA intermediate form',
    targetNodeKinds: ['BinaryExpr', 'AsyncAwait', 'ErrorGuard'],
  },
  {
    index: 8,
    code: '08',
    name: 'Target Codegen',
    shortName: 'Codegen',
    detail: 'Emitting idiomatic target language syntax & signatures',
    targetNodeKinds: ['FunctionDecl', 'ReturnStmt', 'StructDecl'],
  },
  {
    index: 9,
    code: '09',
    name: 'Static Type Check',
    shortName: 'Type Check',
    detail: 'Verifying type soundness & return invariants (Rollback Gate)',
    targetNodeKinds: ['TypeAnnotation', 'BinaryExpr', 'ReturnStmt'],
  },
  {
    index: 10,
    code: '10',
    name: 'Unit Test Harness',
    shortName: 'Unit Tests',
    detail: 'Running contract assertions & semantic parity checks',
    targetNodeKinds: ['FunctionDecl', 'ReturnStmt'],
  },
  {
    index: 11,
    code: '11',
    name: 'Atomic Commit Snapshot',
    shortName: 'Snapshot',
    detail: 'Sealing immutable workspace state & SHA-256 commit pointer',
    targetNodeKinds: ['Program'],
  },
];

export interface SemanticCacheStats {
  totalSubtrees: number;
  cacheHits: number;
  cacheMisses: number;
  tokensUsed: number;
  tokensSaved: number;
  savingsPercent: number;
  isCacheHit: boolean;
}

class SemanticHashCacheStore {
  private entries = new Map<string, { label: string; tokens: number; hits: number }>();

  public clear(): void {
    this.entries.clear();
  }

  public size(): number {
    return this.entries.size;
  }

  public evaluateAndCommit(
    ast: AstNode,
    targetLang: Language,
    commitToCache = true
  ): SemanticCacheStats {
    const subtrees: AstNode[] = [];
    const collect = (node: AstNode): void => {
      if (
        node.kind === 'StructDecl' ||
        node.kind === 'FunctionDecl' ||
        node.kind === 'ErrorGuard' ||
        node.kind === 'ParamList'
      ) {
        subtrees.push(node);
      }
      for (const child of node.children) collect(child);
    };
    collect(ast);

    if (subtrees.length === 0) {
      subtrees.push(ast);
    }

    let cacheHits = 0;
    let cacheMisses = 0;
    let tokensUsed = 0;
    let tokensSaved = 0;

    for (const node of subtrees) {
      const key = `${targetLang}:${node.semanticHash}`;
      const weight = Math.max(24, node.span.tokenCount * 14);
      const existing = this.entries.get(key);

      if (existing) {
        cacheHits++;
        existing.hits++;
        // On a semantic cache HIT, only ~22% boundary verification tokens are needed; ~78% saved
        const overhead = Math.round(weight * 0.22);
        tokensUsed += overhead;
        tokensSaved += weight - overhead;
        if (node.status === 'clean') {
          node.status = 'cached';
        }
      } else {
        cacheMisses++;
        tokensUsed += weight;
        if (commitToCache) {
          this.entries.set(key, { label: node.label, tokens: weight, hits: 1 });
        }
        if (node.status === 'clean') {
          node.status = 'migrated';
        }
      }
    }

    const totalBudget = tokensUsed + tokensSaved;
    const savingsPercent = totalBudget > 0 ? Math.round((tokensSaved / totalBudget) * 100) : 0;

    return {
      totalSubtrees: subtrees.length,
      cacheHits,
      cacheMisses,
      tokensUsed,
      tokensSaved,
      savingsPercent,
      isCacheHit: cacheHits > 0 && cacheHits >= cacheMisses,
    };
  }
}

export const semanticCache = new SemanticHashCacheStore();

/* ============================================================================
 * UNIFIED / SIDE-BY-SIDE LCS LINE DIFF
 * ============================================================================ */
export function computeUnifiedDiff(sourceCode: string, targetCode: string): DiffLine[] {
  const left = sourceCode.split(/\r?\n/);
  const right = targetCode.split(/\r?\n/);
  const m = left.length;
  const n = right.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (left[i].trim() === right[j].trim()) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (left[i].trim() === right[j].trim()) {
      diff.push({
        type: 'context',
        leftNum: i + 1,
        rightNum: j + 1,
        leftText: left[i],
        rightText: right[j],
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diff.push({
        type: 'del',
        leftNum: i + 1,
        rightNum: null,
        leftText: left[i],
        rightText: '',
      });
      i++;
    } else {
      diff.push({
        type: 'add',
        leftNum: null,
        rightNum: j + 1,
        leftText: '',
        rightText: right[j],
      });
      j++;
    }
  }

  while (i < m) {
    diff.push({
      type: 'del',
      leftNum: i + 1,
      rightNum: null,
      leftText: left[i],
      rightText: '',
    });
    i++;
  }
  while (j < n) {
    diff.push({
      type: 'add',
      leftNum: null,
      rightNum: j + 1,
      leftText: '',
      rightText: right[j],
    });
    j++;
  }

  return diff;
}

/* ============================================================================
 * FAULT INJECTION & COLD-VS-HOT CACHE BENCHMARK
 * ============================================================================ */
export function injectTypeMismatchCode(code: string, lang: Language): string {
  const lines = code.split(/\r?\n/);
  const faultLine =
    lang === 'python'
      ? '        corrupt_total = "NaN_corrupt" * 100  # INJECTED TYPE MISMATCH'
      : lang === 'go'
        ? '\tcorruptTotal := "NaN_corrupt" * workers // INJECTED TYPE MISMATCH'
        : '    const corruptTotal = "NaN_corrupt" * 100; // INJECTED TYPE MISMATCH';

  // Insert right before first return statement if possible
  const retIdx = lines.findIndex((l) => /\breturn\b/.test(l));
  if (retIdx > 0) {
    lines.splice(retIdx, 0, faultLine);
    return lines.join('\n');
  }
  return `${code}\n${faultLine}`;
}

export function injectDeprecatedApiCode(code: string, lang: Language): string {
  if (lang === 'python') {
    if (code.includes('decode_hs256_claims')) {
      return code.replace('decode_hs256_claims', 'legacy_jwt_decode_v1');
    }
    if (code.includes('commit_ledger')) {
      return code.replace('commit_ledger', 'deprecated_md5_ledger');
    }
    return code.replace(
      /return\s+/,
      'legacy_audit = await legacy_jwt_decode_v1("v1_token", 60)\n        return '
    );
  }
  if (lang === 'go') {
    if (code.includes('errors.New')) {
      return code.replace('errors.New', 'legacy_unsafe_marshal');
    }
    return code + '\n// legacy_unsafe_marshal("v1_payload")';
  }
  if (code.includes('invokeUpstreamRpc')) {
    return code.replace('invokeUpstreamRpc', 'httpGetInsecure');
  }
  return code.replace(/return\s+/, 'const legacyRes = await httpGetInsecure("http://legacy", 50);\n    return ');
}

export function applyAiPatchToCode(code: string): {
  patchedCode: string;
  appliedPatches: string[];
} {
  let out = code;
  const appliedPatches: string[] = [];
  const rules: [string, string, string][] = [
    [
      'legacy_jwt_decode_v1',
      'decode_hs256_claims',
      'AI Patch #1: Upgraded legacy_jwt_decode_v1 -> decode_hs256_claims (Strict HS256 enforcement)',
    ],
    [
      'deprecated_md5_ledger',
      'commit_ledger',
      'AI Patch #2: Upgraded deprecated_md5_ledger -> commit_ledger (SHA-256 idempotency)',
    ],
    [
      'httpGetInsecure',
      'invokeUpstreamRpc',
      'AI Patch #3: Upgraded httpGetInsecure -> invokeUpstreamRpc (mTLS + circuit telemetry)',
    ],
    [
      'legacy_unsafe_marshal',
      'errors.New',
      'AI Patch #4: Upgraded legacy_unsafe_marshal -> errors.New (Structured boundary)',
    ],
  ];

  for (const [oldApi, newApi, desc] of rules) {
    if (out.includes(oldApi)) {
      out = out.split(oldApi).join(newApi);
      appliedPatches.push(desc);
    }
  }
  return { patchedCode: out, appliedPatches };
}

export function runColdVsHotCacheBenchmark(
  sourceCode: string,
  sourceLang: Language,
  targetLang: Language
): CacheBenchmarkResult {
  // Cold pass measurement (includes simulated LLM lowering latency per uncached subtree)
  semanticCache.clear();
  const t0 = performance.now();
  const coldComp: CompilationOutput = compileAndMigrate(sourceCode, sourceLang, targetLang);
  const coldStats = semanticCache.evaluateAndCommit(coldComp.ast, targetLang, true);
  const coldParseMs = performance.now() - t0;
  // Realistic deterministic model: each uncached subtree incurs IR lowering + LLM synthesis latency
  const coldDurationMs = Math.round((coldParseMs + coldStats.totalSubtrees * 145) * 10) / 10;

  // Hot pass measurement (all subtrees hit SHA-256 Semantic Cache)
  const t1 = performance.now();
  const hotComp = compileAndMigrate(sourceCode, sourceLang, targetLang);
  const hotStats = semanticCache.evaluateAndCommit(hotComp.ast, targetLang, true);
  const hotParseMs = performance.now() - t1;
  const hotDurationMs = Math.max(3.2, Math.round((hotParseMs + hotStats.cacheHits * 1.4) * 10) / 10);

  const savedPercent = hotStats.savingsPercent || 78;
  const speedupFactor = Math.round((coldDurationMs / hotDurationMs) * 10) / 10;

  return {
    coldDurationMs,
    hotDurationMs,
    coldTokens: coldStats.tokensUsed,
    hotTokens: hotStats.tokensUsed,
    savedPercent,
    speedupFactor,
  };
}
