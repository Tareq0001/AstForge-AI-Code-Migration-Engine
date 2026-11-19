export type Language = 'python' | 'go' | 'typescript';

export type TokenKind =
  | 'KEYWORD'
  | 'IDENT'
  | 'TYPE'
  | 'OPERATOR'
  | 'PUNCT'
  | 'STRING'
  | 'NUMBER'
  | 'COMMENT'
  | 'DECORATOR'
  | 'NEWLINE';

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  col: number;
}

export type AstNodeKind =
  | 'Program'
  | 'FunctionDecl'
  | 'ParamList'
  | 'TypeAnnotation'
  | 'BinaryExpr'
  | 'ReturnStmt'
  | 'AsyncAwait'
  | 'ErrorGuard'
  | 'StructDecl';

export type AstNodeStatus = 'clean' | 'cached' | 'migrated' | 'patched' | 'error';

export interface SourceSpan {
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  tokenCount: number;
}

export interface AstNode {
  id: string;
  kind: AstNodeKind;
  label: string;
  detail: string;
  span: SourceSpan;
  inferredType: string;
  complexity: number;
  semanticHash: string;
  status: AstNodeStatus;
  meta?: Record<string, string | boolean | number>;
  children: AstNode[];
}

export interface SymbolEntry {
  name: string;
  kind: 'function' | 'struct' | 'param' | 'variable';
  sourceType: string;
  targetType: string;
  scope: string;
  line: number;
}

export interface CodeTemplate {
  id: string;
  name: string;
  language: Language;
  defaultTarget: Language;
  description: string;
  code: string;
}

export interface TypeDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  line: number;
  nodeId: string;
  remediation?: string;
}

export interface DiffLine {
  type: 'context' | 'add' | 'del';
  leftNum: number | null;
  rightNum: number | null;
  leftText: string;
  rightText: string;
}

export interface PipelineStageInfo {
  index: number; // 1..11
  code: string;  // "01".."11"
  name: string;
  shortName: string;
  detail: string;
  targetNodeKinds: AstNodeKind[];
}

export type StageStatus = 'idle' | 'running' | 'done' | 'cached' | 'error' | 'rolled_back';

export interface AtomicSnapshot {
  id: string;
  seq: number;
  label: string;
  timestamp: string;
  sourceLang: Language;
  targetLang: Language;
  sourceCode: string;
  targetCode: string;
  ast: AstNode;
  cacheHitRate: number;
  tokensUsed: number;
  tokensSaved: number;
  status: 'green' | 'recovered';
}

export interface CacheBenchmarkResult {
  coldDurationMs: number;
  hotDurationMs: number;
  coldTokens: number;
  hotTokens: number;
  savedPercent: number;
  speedupFactor: number;
}
