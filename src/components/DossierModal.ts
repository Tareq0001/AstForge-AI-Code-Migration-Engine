/**
 * Compiler & AST Architecture Dossier Modal
 * Architected exclusively by أ. طارق ابوعشي | Tareq Abuashi — Lead Software Engineer & AI Systems Architect
 */
export function mountDossierModal(): { open: () => void; close: () => void } {
  const existing = document.getElementById('astforge-dossier-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'astforge-dossier-modal';
  overlay.className = 'dossier-overlay hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'dossier-modal-title');

  overlay.innerHTML = `
    <div class="dossier-dialog">
      <div class="dossier-header">
        <div>
          <span class="panel-badge cyan">REFERENCE ARCHITECTURE #96</span>
          <h2 id="dossier-modal-title">AST-FORGE Compiler &amp; Semantic Migration Dossier</h2>
          <p class="dossier-author">
            Exclusive Lead Architect: <strong>أ. طارق ابوعشي | Tareq Abuashi — Lead Software Engineer &amp; AI Systems Architect</strong>
          </p>
        </div>
        <button id="close-dossier-btn" class="btn-icon" aria-label="Close Architecture Dossier">
          <span>✕ Close</span>
        </button>
      </div>

      <div class="dossier-body custom-scroll">
        <div class="dossier-grid">
          <article class="dossier-card">
            <h3>01. Recursive Descent Parsing (LL Grammar)</h3>
            <p>
              Source code streams are tokenized into typed lexical spans (<code>KEYWORD</code>, <code>IDENT</code>,
              <code>TYPE</code>, <code>OPERATOR</code>, <code>DECORATOR</code>) and lowered via deterministic recursive
              descent into a strictly typed AST hierarchy:
            </p>
            <div class="formula-box">
              Program ::= (StructDecl | FunctionDecl)*<br/>
              FunctionDecl ::= Async? Ident "(" ParamList ")" "-&gt;" TypeAnnotation Block<br/>
              Block ::= (ErrorGuard | AsyncAwait | BinaryExpr | ReturnStmt)*
            </div>
            <p>
              Each AST node retains exact line/column <code>Token Span</code> coordinates and computes local
              McCabe cyclomatic complexity <code>M = E - N + 2P</code>.
            </p>
          </article>

          <article class="dossier-card">
            <h3>02. SHA-256 Subtree Semantic Fingerprinting</h3>
            <p>
              To eliminate redundant LLM inference across unchanged functions and data models, every AST node computes
              a canonical Merkle hash invariant to whitespace and comments:
            </p>
            <div class="formula-box">
              H(node) = SHA256(Kind || CanonicalSig || InferredType || [H(child_i)])<br/>
              Token_Saved = Σ_{hit} (W_node × 0.78) &nbsp;⇒&nbsp; ~78% Token Budget Reduction
            </div>
            <p>
              On a Semantic Cache <strong>HIT</strong>, only boundary verification tokens (~22%) are spent;
              unchanged subtrees bypass LLM/IR lowering with sub-5ms retrieval.
            </p>
          </article>

          <article class="dossier-card">
            <h3>03. SSA / IR Lowering &amp; Cross-Language Type Lattice</h3>
            <p>
              Phase 07 lowers uncached subtrees into a language-neutral canonical type lattice before Phase 08 emits
              idiomatic target syntax across <strong>Python ↔ Go ↔ TypeScript</strong>:
            </p>
            <div class="formula-box">
              optional&lt;string&gt; &nbsp;↦&nbsp; Python: Optional[str] &nbsp;|&nbsp; Go: *string &nbsp;|&nbsp; TS: string | null<br/>
              async_barrier &nbsp;&nbsp;&nbsp;↦&nbsp; Python: async/await &nbsp;|&nbsp; Go: goroutine + ctx &nbsp;|&nbsp; TS: async/Promise&lt;T&gt;<br/>
              error_boundary &nbsp;&nbsp;↦&nbsp; Python: try/except &nbsp;|&nbsp; Go: if err != nil &nbsp;|&nbsp; TS: try/catch
            </div>
          </article>

          <article class="dossier-card">
            <h3>04. Phase-09 Verification &amp; Atomic Rollback Guarantees</h3>
            <p>
              No migration commits directly to workspace state. Phase 09 (<em>Static Type Check</em>) and Phase 10
              (<em>Unit Test Harness</em>) act as hard verification gates before Phase 11 seals an immutable
              <code>AtomicSnapshot</code>:
            </p>
            <div class="formula-box">
              Commit(S_{n+1}) = (Verify_TypeSoundness(AST) ∧ Verify_Contracts(AST))<br/>
              ¬Commit(S_{n+1}) &nbsp;⇒&nbsp; AtomicRollback(S_n) &nbsp;[Zero Partial Mutation]
            </div>
            <p>
              If a type mismatch (e.g., <code>TC-E091</code> / <code>TC-E094</code>) is detected in Phase 09, the engine
              highlights the offending AST node in crimson and deterministically reverts code, AST, and diff state to
              the last verified green snapshot.
            </p>
          </article>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const open = (): void => {
    overlay.classList.remove('hidden');
  };
  const close = (): void => {
    overlay.classList.add('hidden');
  };

  overlay.querySelector('#close-dossier-btn')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });

  return { open, close };
}
