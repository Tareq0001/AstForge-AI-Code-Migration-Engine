# AST-FORGE: AI-Powered Codebase Migration Engine & Interactive AST Compiler Workbench

> **Reference Project (#96)**  
> **Exclusive Lead Architect & Engineer:** **أ. طارق ابوعشي | Tareq Abuashi — Lead Software Engineer & AI Systems Architect**

AST-FORGE is an in-browser, deterministic multi-language codebase migration engine and interactive Abstract Syntax Tree (AST) compiler workbench. It combines a real-time lexical analyzer, recursive descent parser, SHA-256 subtree Merkle semantic cache, 11-phase migration pipeline, unified diff viewer, and an automated Phase-09 verification & atomic rollback engine across **Python ↔ Go ↔ TypeScript**.

---

## Core Architectural Capabilities

1. **Real-Time Lexer, Recursive Descent Parser & Deterministic Cross-Language Transpiler (`src/engine/astCompiler.ts`)**
   - Tokenizes live source code (`KEYWORD`, `IDENT`, `TYPE`, `OPERATOR`, `PUNCT`, `STRING`, `NUMBER`, `DECORATOR`, `COMMENT`).
   - Builds a strictly typed hierarchical AST (`Program`, `StructDecl`, `FunctionDecl`, `ParamList`, `TypeAnnotation`, `AsyncAwait`, `ErrorGuard`, `BinaryExpr`, `ReturnStmt`) with exact `Token Span`, `Inferred Type`, `Cyclomatic Complexity`, and pure TypeScript **SHA-256 Semantic Hashing**.
   - Performs deterministic cross-language type lattice lowering and construct translation between **Python 3.12 ↔ Go 1.23 ↔ TypeScript 5.9**:
     - `Optional[str]` ↔ `*string` ↔ `string | null`
     - `async def / await` ↔ `goroutine + context.Context` ↔ `async function / Promise<T>`
     - `try / except` ↔ `if err != nil` ↔ `try / catch`
   - Includes 4 production system templates:
     - `FastAPI Order Service (Python)`
     - `JWT Auth Middleware (Python)`
     - `Concurrent Worker Pool (Go)`
     - `Retry Circuit Breaker (TypeScript)`

2. **60fps HiDPI Interactive AST Canvas (`src/components/AstCanvas.ts`)**
   - Proportional hierarchical layout rendered on a HiDPI 2D Canvas with color-coded node gradients per AST kind.
   - Animated photon pulses flowing down active edges synchronized with each of the 11 compiler phases.
   - Full mouse pan, wheel zoom, viewport fit, and click-to-inspect **Node Inspector** (`Token Span`, `Inferred Type`, `Cyclomatic Complexity`, `SHA-256 Semantic Hash`).

3. **11-Phase Migration Pipeline & SHA-256 Semantic Hash Cache (`src/engine/pipelineEngine.ts`)**
   - Step-by-step animated execution across 11 compiler phases:
     `01 Lexer` → `02 AST Parse` → `03 Symbol Table` → `04 Type Inference` → `05 Semantic Hash Cache` → `06 Dependency Graph` → `07 LLM/IR Lowering` → `08 Target Codegen` → `09 Static Type Check` → `10 Unit Test Harness` → `11 Atomic Commit Snapshot`.
   - Subtree SHA-256 Merkle cache evaluates `HIT / MISS` rates, saving **~78%** of token budget on warm subtrees.
   - Side-by-side **Unified Diff Viewer** powered by an LCS line diff algorithm alongside target code output and symbol table telemetry.

4. **Atomic Commit Snapshots & Fault Injection Lab**
   - **Inject Type-Mismatch Error**: Injects an incompatible type operation, caught deterministically at Phase `09 Static Type Check`, highlights the offending AST node in crimson, and triggers an automatic **Atomic Rollback** to the last green snapshot.
   - **Inject Breaking API Deprecation**: Injects a deprecated call site, synthesizes an **AI Patch**, highlights the remediated AST node, and updates the Unified Diff.
   - **Simulate Cold Semantic Cache**: Benchmarks Cold Cache vs Hot Semantic Cache latency and token budget savings.
   - **Web Audio Telemetry & Architecture Dossier Modal (`src/components/DossierModal.ts`)**: Synthesized compiler ticks/chimes with Mute toggle and an interactive mathematical/architectural dossier.

---

## Local Development & Production Build

```powershell
npm run dev
npm run build
```

---

## Attribution

Architected, designed, and engineered exclusively by:  
**أ. طارق ابوعشي | Tareq Abuashi — Lead Software Engineer & AI Systems Architect**
