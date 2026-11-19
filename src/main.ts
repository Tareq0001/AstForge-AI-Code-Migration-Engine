import { AstCanvas } from './components/AstCanvas';
import { mountDossierModal } from './components/DossierModal';
import {
  CODE_TEMPLATES,
  CompilationOutput,
  compileAndMigrate,
} from './engine/astCompiler';
import { audioEngine } from './engine/audioEngine';
import {
  PIPELINE_STAGES,
  SemanticCacheStats,
  applyAiPatchToCode,
  computeUnifiedDiff,
  injectDeprecatedApiCode,
  injectTypeMismatchCode,
  runColdVsHotCacheBenchmark,
  semanticCache,
} from './engine/pipelineEngine';
import { AstNode, AtomicSnapshot, Language, StageStatus } from './types/ast';

/* ============================================================================
 * DOM REFERENCES & STATE
 * ============================================================================ */
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing DOM element #${id}`);
  return el as T;
};

const templatePillsEl = $<HTMLDivElement>('template-pills');
const sourceLangSelect = $<HTMLSelectElement>('source-lang-select');
const targetLangSelect = $<HTMLSelectElement>('target-lang-select');
const btnRunMigration = $<HTMLButtonElement>('btn-run-migration');
const pipelineStagesGrid = $<HTMLDivElement>('pipeline-stages-grid');
const pipelineTraceText = $<HTMLSpanElement>('pipeline-trace-text');
const pipelineStatusPill = $<HTMLDivElement>('pipeline-status-pill');
const pipelineStatusText = $<HTMLSpanElement>('pipeline-status-text');
const cacheBadgeChip = $<HTMLDivElement>('cache-badge-chip');
const telemCache = $<HTMLElement>('telem-cache');
const telemTokens = $<HTMLElement>('telem-tokens');
const telemSaved = $<HTMLElement>('telem-saved');
const telemNodes = $<HTMLElement>('telem-nodes');

const astCanvasEl = $<HTMLCanvasElement>('ast-canvas');
const nodeInspectorEl = $<HTMLDivElement>('node-inspector');
const editorTextarea = $<HTMLTextAreaElement>('source-code-editor');
const editorGutter = $<HTMLDivElement>('editor-gutter');
const editorMetricsBadge = $<HTMLSpanElement>('editor-metrics-badge');

const gateStateBadge = $<HTMLSpanElement>('gate-state-badge');
const labAlertBanner = $<HTMLDivElement>('lab-alert-banner');
const cacheBenchmarkCard = $<HTMLDivElement>('cache-benchmark-card');
const snapshotTimelineEl = $<HTMLDivElement>('snapshot-timeline');
const snapshotCountBadge = $<HTMLSpanElement>('snapshot-count-badge');

const tabContentDiff = $<HTMLDivElement>('tab-content-diff');
const tabContentTarget = $<HTMLDivElement>('tab-content-target');
const tabContentSymbols = $<HTMLDivElement>('tab-content-symbols');

const audioToggleBtn = $<HTMLButtonElement>('audio-toggle-btn');
const audioStatusText = $<HTMLSpanElement>('audio-status-text');

let activeTemplateId = CODE_TEMPLATES[0].id;
let sourceLang: Language = CODE_TEMPLATES[0].language;
let targetLang: Language = CODE_TEMPLATES[0].defaultTarget;
let isPipelineRunning = false;
let currentCompilation: CompilationOutput | null = null;
let snapshots: AtomicSnapshot[] = [];
let activeSnapshotId: string | null = null;
let snapshotSeq = 0;

const dossierModal = mountDossierModal();
const astCanvas = new AstCanvas(astCanvasEl, renderNodeInspector);

/* ============================================================================
 * HELPERS
 * ============================================================================ */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setPipelineStatus(
  mode: 'ready' | 'running' | 'error',
  label: string,
  trace: string
): void {
  pipelineStatusPill.classList.remove('status-ready', 'status-running', 'status-error');
  pipelineStatusPill.classList.add(
    mode === 'running' ? 'status-running' : mode === 'error' ? 'status-error' : 'status-ready'
  );
  pipelineStatusText.textContent = label;
  pipelineTraceText.textContent = trace;
}

function showLabBanner(
  kind: 'error' | 'patch' | 'ok',
  htmlContent: string
): void {
  labAlertBanner.className = `security-banner ${kind}`;
  labAlertBanner.innerHTML = htmlContent;
  labAlertBanner.classList.remove('hidden');
}

function hideLabBanner(): void {
  labAlertBanner.classList.add('hidden');
}

function syncEditorGutter(): void {
  const lines = editorTextarea.value.split(/\r?\n/);
  editorGutter.innerHTML = lines.map((_, i) => `<div>${i + 1}</div>`).join('');
  editorGutter.scrollTop = editorTextarea.scrollTop;
  const tokCount = currentCompilation
    ? currentCompilation.tokens.filter((t) => t.kind !== 'NEWLINE').length
    : 0;
  editorMetricsBadge.textContent = `${lines.length} LINES • ${tokCount} TOKENS`;
}

/* ============================================================================
 * RENDERERS (STAGE STRIP, INSPECTOR, DIFF, SNAPSHOTS, SYMBOLS)
 * ============================================================================ */
function initPipelineGrid(): void {
  pipelineStagesGrid.innerHTML = PIPELINE_STAGES.map(
    (s) => `
    <div id="stage-cell-${s.index}" class="stage-node" title="${escapeHtml(s.name)}: ${escapeHtml(s.detail)}">
      <span class="stage-code">${s.code}</span>
      <span class="stage-name">${escapeHtml(s.shortName)}</span>
    </div>
  `
  ).join('');
}

function setStageStatus(index: number, status: StageStatus): void {
  const cell = document.getElementById(`stage-cell-${index}`);
  if (!cell) return;
  cell.classList.remove('running', 'done', 'cached', 'error', 'rolled_back');
  if (status !== 'idle') {
    cell.classList.add(status);
  }
}

function resetAllStageStatuses(): void {
  for (const s of PIPELINE_STAGES) {
    setStageStatus(s.index, 'idle');
  }
}

function renderNodeInspector(node: AstNode): void {
  const statusColor =
    node.status === 'error'
      ? 'rose'
      : node.status === 'patched'
        ? 'amber'
        : node.status === 'cached'
          ? 'emerald'
          : 'cyan';

  nodeInspectorEl.innerHTML = `
    <div class="inspector-title">
      <span>${escapeHtml(node.kind)}</span>
      <span class="panel-badge ${statusColor}">${node.status.toUpperCase()}</span>
    </div>
    <div class="inspector-row"><span>Label</span><strong>${escapeHtml(node.label)}</strong></div>
    <div class="inspector-row"><span>Token Span</span><strong>L${node.span.startLine}–L${node.span.endLine} (${node.span.tokenCount} tok)</strong></div>
    <div class="inspector-row"><span>Inferred Type</span><strong>${escapeHtml(node.inferredType)}</strong></div>
    <div class="inspector-row"><span>Cyclomatic</span><strong>M = ${node.complexity}</strong></div>
    <div class="inspector-row"><span>SHA-256 Hash</span><strong>${node.semanticHash.slice(0, 20)}…</strong></div>
  `;
}

function renderUnifiedDiff(sourceCode: string, targetCode: string): void {
  const diff = computeUnifiedDiff(sourceCode, targetCode);
  const rows = diff
    .map((d) => {
      const sign = d.type === 'add' ? '+' : d.type === 'del' ? '-' : ' ';
      return `
        <tr class="diff-row ${d.type}">
          <td class="diff-ln">${d.leftNum ?? ''}</td>
          <td class="diff-left">${escapeHtml(d.leftText)}</td>
          <td class="diff-sign">${sign}</td>
          <td class="diff-ln">${d.rightNum ?? ''}</td>
          <td class="diff-right">${escapeHtml(d.rightText)}</td>
        </tr>
      `;
    })
    .join('');

  tabContentDiff.innerHTML = `
    <table class="diff-table">
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderTargetAndSymbols(comp: CompilationOutput): void {
  tabContentTarget.innerHTML = `<pre class="target-pre">${escapeHtml(comp.targetCode)}</pre>`;

  const diagHtml =
    comp.diagnostics.length > 0
      ? comp.diagnostics
          .map(
            (d) => `
            <div class="security-banner ${d.severity === 'error' ? 'error' : 'patch'}" style="margin:0 0 8px 0;">
              <strong>[${escapeHtml(d.code)}] L${d.line}:</strong> ${escapeHtml(d.message)}
              ${d.remediation ? `<div style="margin-top:3px;opacity:0.9;">↳ ${escapeHtml(d.remediation)}</div>` : ''}
            </div>`
          )
          .join('')
      : `<div class="security-banner ok" style="margin:0 0 8px 0;">✓ Phase 09 Static Type Check &amp; Phase 10 Contract Suite passed with 0 errors.</div>`;

  const symRows = comp.symbols
    .map(
      (s) => `
      <tr>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.kind)}</td>
        <td>${escapeHtml(s.scope)}</td>
        <td><code>${escapeHtml(s.sourceType)}</code></td>
        <td><code>${escapeHtml(s.targetType)}</code></td>
      </tr>
    `
    )
    .join('');

  tabContentSymbols.innerHTML = `
    ${diagHtml}
    <table class="sym-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Kind</th>
          <th>Scope</th>
          <th>Source Type</th>
          <th>Target Type</th>
        </tr>
      </thead>
      <tbody>${symRows || '<tr><td colspan="5">No symbols resolved yet.</td></tr>'}</tbody>
    </table>
  `;
}

function renderSnapshots(): void {
  snapshotCountBadge.textContent = `${snapshots.length} SNAPSHOT${snapshots.length === 1 ? '' : 'S'}`;
  if (snapshots.length === 0) {
    snapshotTimelineEl.innerHTML = `<div class="snap-meta">No atomic snapshots committed yet.</div>`;
    return;
  }

  snapshotTimelineEl.innerHTML = snapshots
    .slice()
    .reverse()
    .map(
      (snap) => `
      <div class="snap-card ${snap.id === activeSnapshotId ? 'active' : ''}">
        <div class="snap-head">
          <span>${escapeHtml(snap.label)}</span>
          <span class="panel-badge emerald">${snap.sourceLang.toUpperCase()}→${snap.targetLang.toUpperCase()}</span>
        </div>
        <div class="snap-meta">${escapeHtml(snap.timestamp)} • Cache ${snap.cacheHitRate}%</div>
        <div class="snap-meta">Tokens: ${snap.tokensUsed} (Saved ${snap.tokensSaved})</div>
        <button class="btn-mini rollback-snap-btn" data-snap-id="${snap.id}">Atomic Rollback</button>
      </div>
    `
    )
    .join('');

  snapshotTimelineEl.querySelectorAll<HTMLButtonElement>('.rollback-snap-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.snapId;
      if (id) restoreSnapshot(id, 'Manual Atomic Rollback triggered by operator.');
    });
  });
}

function renderTemplatePills(): void {
  templatePillsEl.innerHTML = CODE_TEMPLATES.map(
    (tpl) => `
    <button
      class="preset-pill ${tpl.id === activeTemplateId ? 'active' : ''}"
      data-template-id="${tpl.id}"
      title="${escapeHtml(tpl.description)}"
    >
      ${escapeHtml(tpl.name)}
    </button>
  `
  ).join('');

  templatePillsEl.querySelectorAll<HTMLButtonElement>('.preset-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tpl = CODE_TEMPLATES.find((t) => t.id === btn.dataset.templateId);
      if (!tpl || isPipelineRunning) return;
      audioEngine.playClick();
      activeTemplateId = tpl.id;
      sourceLang = tpl.language;
      targetLang = tpl.defaultTarget;
      sourceLangSelect.value = sourceLang;
      targetLangSelect.value = targetLang;
      editorTextarea.value = tpl.code;
      hideLabBanner();
      cacheBenchmarkCard.classList.add('hidden');
      renderTemplatePills();
      void runMigrationPipeline({ commitSnapshot: true, labelPrefix: 'Snap' });
    });
  });
}

/* ============================================================================
 * SNAPSHOT COMMIT & ATOMIC ROLLBACK
 * ============================================================================ */
function commitAtomicSnapshot(
  comp: CompilationOutput,
  stats: SemanticCacheStats,
  labelPrefix = 'Snap'
): AtomicSnapshot {
  snapshotSeq += 1;
  const now = new Date();
  const timestamp = now.toTimeString().slice(0, 8);
  const snap: AtomicSnapshot = {
    id: `snap_${snapshotSeq}_${Date.now()}`,
    seq: snapshotSeq,
    label: `${labelPrefix} #${snapshotSeq}`,
    timestamp,
    sourceLang,
    targetLang,
    sourceCode: editorTextarea.value,
    targetCode: comp.targetCode,
    ast: JSON.parse(JSON.stringify(comp.ast)) as AstNode,
    cacheHitRate: stats.savingsPercent,
    tokensUsed: stats.tokensUsed,
    tokensSaved: stats.tokensSaved,
    status: 'green',
  };
  snapshots.push(snap);
  if (snapshots.length > 8) {
    snapshots = snapshots.slice(snapshots.length - 8);
  }
  activeSnapshotId = snap.id;
  renderSnapshots();
  return snap;
}

function restoreSnapshot(snapId: string, reason: string): void {
  const snap = snapshots.find((s) => s.id === snapId) ?? snapshots[snapshots.length - 1];
  if (!snap) return;

  audioEngine.playRollbackSweep();
  sourceLang = snap.sourceLang;
  targetLang = snap.targetLang;
  sourceLangSelect.value = sourceLang;
  targetLangSelect.value = targetLang;
  editorTextarea.value = snap.sourceCode;
  activeSnapshotId = snap.id;

  const restoredComp = compileAndMigrate(snap.sourceCode, sourceLang, targetLang);
  const stats = semanticCache.evaluateAndCommit(restoredComp.ast, targetLang, false);
  currentCompilation = restoredComp;

  syncEditorGutter();
  astCanvas.setAst(restoredComp.ast, true);
  astCanvas.setPipelinePulse(false);
  renderUnifiedDiff(snap.sourceCode, restoredComp.targetCode);
  renderTargetAndSymbols(restoredComp);
  updateTelemetryChips(restoredComp, stats);
  renderSnapshots();

  gateStateBadge.className = 'panel-badge emerald';
  gateStateBadge.textContent = 'GATE: RECOVERED';
  setPipelineStatus('ready', `ROLLED BACK (${snap.label})`, reason);
  showLabBanner(
    'ok',
    `<strong>✓ Atomic Rollback Executed → ${escapeHtml(snap.label)}</strong><br/>${escapeHtml(reason)}`
  );
}

function updateTelemetryChips(comp: CompilationOutput, stats: SemanticCacheStats): void {
  telemCache.textContent = stats.isCacheHit ? `HIT (${stats.cacheHits}/${stats.totalSubtrees})` : `MISS (${stats.cacheMisses})`;
  cacheBadgeChip.classList.toggle('hit', stats.isCacheHit);
  telemTokens.textContent = String(stats.tokensUsed);
  telemSaved.textContent = `${stats.savingsPercent}%`;
  telemNodes.textContent = String(comp.totalNodes);
}

/* ============================================================================
 * 11-PHASE ANIMATED COMPILER PIPELINE
 * ============================================================================ */
async function runMigrationPipeline(options?: {
  commitSnapshot?: boolean;
  labelPrefix?: string;
  patchedNodeIds?: string[];
  patchNotes?: string[];
  fast?: boolean;
}): Promise<void> {
  if (isPipelineRunning) return;
  isPipelineRunning = true;
  btnRunMigration.disabled = true;
  resetAllStageStatuses();

  const code = editorTextarea.value;
  const comp = compileAndMigrate(code, sourceLang, targetLang);
  currentCompilation = comp;
  syncEditorGutter();

  // Preserve patched node visual status if coming from AI Patch flow
  if (options?.patchedNodeIds && options.patchedNodeIds.length > 0) {
    const patchSet = new Set(options.patchedNodeIds);
    const markPatched = (n: AstNode): void => {
      if (patchSet.has(n.id) || (n.meta && n.meta.deprecated)) {
        n.status = 'patched';
      }
      n.children.forEach(markPatched);
    };
    markPatched(comp.ast);
  }

  const stats = semanticCache.evaluateAndCommit(comp.ast, targetLang, false);
  astCanvas.setAst(comp.ast, true);

  const hasStaticErrors = comp.diagnostics.some((d) => d.severity === 'error');
  const stepDelay = options?.fast ? 45 : 95;

  for (const stage of PIPELINE_STAGES) {
    setStageStatus(stage.index, 'running');
    astCanvas.setPipelinePulse(true, stage.targetNodeKinds);
    setPipelineStatus('running', `PHASE ${stage.code}: ${stage.shortName.toUpperCase()}`, stage.detail);
    audioEngine.playStageTick(stage.index, stage.index === 5 && stats.isCacheHit);

    await delay(stepDelay);

    // Phase 05 Semantic Hash Cache indicator
    if (stage.index === 5) {
      setStageStatus(stage.index, stats.isCacheHit ? 'cached' : 'done');
      updateTelemetryChips(comp, stats);
      continue;
    }

    // Phase 09 Static Type Check Verification Gate
    if (stage.index === 9 && hasStaticErrors) {
      setStageStatus(stage.index, 'error');
      audioEngine.playFaultAlert();
      const errDiags = comp.diagnostics.filter((d) => d.severity === 'error');
      const errIds = errDiags.map((d) => d.nodeId);
      astCanvas.highlightNodes(errIds);
      renderUnifiedDiff(code, comp.targetCode);
      renderTargetAndSymbols(comp);

      gateStateBadge.className = 'panel-badge rose';
      gateStateBadge.textContent = 'GATE: TYPE VIOLATION';
      setPipelineStatus(
        'error',
        'PHASE 09 FAILED',
        errDiags[0]?.message || 'Static type mismatch detected. Triggering Atomic Rollback...'
      );
      showLabBanner(
        'error',
        `<strong>✕ Phase 09 Static Type Check Failed (${escapeHtml(errDiags[0]?.code ?? 'TC-ERR')})</strong><br/>${escapeHtml(
          errDiags[0]?.message ?? 'Type mismatch detected'
        )}<br/><em>Executing automatic Atomic Rollback to last verified green snapshot...</em>`
      );

      await delay(950);
      isPipelineRunning = false;
      btnRunMigration.disabled = false;
      const lastGreen = snapshots[snapshots.length - 1];
      if (lastGreen) {
        restoreSnapshot(
          lastGreen.id,
          `Auto-reverted Phase 09 Type-Mismatch (${errDiags[0]?.code ?? 'TC-ERR'}) back to ${lastGreen.label}.`
        );
      }
      return;
    }

    setStageStatus(stage.index, 'done');
  }

  // Commit Semantic Cache & Atomic Snapshot on green pass
  const finalStats = semanticCache.evaluateAndCommit(comp.ast, targetLang, true);
  astCanvas.setAst(comp.ast, false);
  astCanvas.setPipelinePulse(false);

  if (options?.patchedNodeIds && options.patchedNodeIds.length > 0) {
    astCanvas.highlightNodes(options.patchedNodeIds);
  }

  renderUnifiedDiff(code, comp.targetCode);
  renderTargetAndSymbols(comp);
  updateTelemetryChips(comp, finalStats);

  if (options?.commitSnapshot !== false) {
    commitAtomicSnapshot(comp, finalStats, options?.labelPrefix ?? 'Snap');
  }

  audioEngine.playCommitChime();
  gateStateBadge.className = 'panel-badge emerald';
  gateStateBadge.textContent = 'GATE: VERIFIED';
  setPipelineStatus(
    'ready',
    finalStats.isCacheHit ? `CACHE HIT (${finalStats.savingsPercent}% SAVED)` : 'MIGRATION COMMITTED',
    `11-phase pipeline verified (${comp.totalNodes} AST nodes, ${finalStats.tokensUsed} tokens, ${finalStats.savingsPercent}% saved).`
  );

  if (options?.patchNotes && options.patchNotes.length > 0) {
    showLabBanner(
      'patch',
      `<strong>⚡ AI Deprecation Patch Applied &amp; Verified</strong><br/>${options.patchNotes
        .map((n) => escapeHtml(n))
        .join('<br/>')}`
    );
  }

  isPipelineRunning = false;
  btnRunMigration.disabled = false;
}

/* ============================================================================
 * EVENT BINDINGS
 * ============================================================================ */
let liveParseTimer = 0;
editorTextarea.addEventListener('input', () => {
  syncEditorGutter();
  window.clearTimeout(liveParseTimer);
  liveParseTimer = window.setTimeout(() => {
    const code = editorTextarea.value;
    const comp = compileAndMigrate(code, sourceLang, targetLang);
    const stats = semanticCache.evaluateAndCommit(comp.ast, targetLang, false);
    currentCompilation = comp;
    syncEditorGutter();
    astCanvas.setAst(comp.ast, false);
    renderUnifiedDiff(code, comp.targetCode);
    renderTargetAndSymbols(comp);
    updateTelemetryChips(comp, stats);
  }, 160);
});

editorTextarea.addEventListener('scroll', () => {
  editorGutter.scrollTop = editorTextarea.scrollTop;
});

sourceLangSelect.addEventListener('change', () => {
  sourceLang = sourceLangSelect.value as Language;
  void runMigrationPipeline({ commitSnapshot: true });
});

targetLangSelect.addEventListener('change', () => {
  targetLang = targetLangSelect.value as Language;
  void runMigrationPipeline({ commitSnapshot: true });
});

btnRunMigration.addEventListener('click', () => {
  audioEngine.playClick();
  hideLabBanner();
  void runMigrationPipeline({ commitSnapshot: true });
});

// AST Canvas Controls
$<HTMLButtonElement>('btn-zoom-in').addEventListener('click', () => astCanvas.zoomBy(1.18));
$<HTMLButtonElement>('btn-zoom-out').addEventListener('click', () => astCanvas.zoomBy(0.84));
$<HTMLButtonElement>('btn-fit-ast').addEventListener('click', () => astCanvas.fitToView());

// Header Controls
audioToggleBtn.addEventListener('click', () => {
  const muted = audioEngine.toggleMute();
  audioToggleBtn.classList.toggle('active', !muted);
  audioStatusText.textContent = muted ? 'Audio: OFF' : 'Audio: ON';
});

$<HTMLButtonElement>('open-dossier-btn').addEventListener('click', () => {
  audioEngine.playClick();
  dossierModal.open();
});

// Fault Injection & Cache Benchmark Lab
$<HTMLButtonElement>('btn-inject-mismatch').addEventListener('click', () => {
  if (isPipelineRunning) return;
  audioEngine.playClick();
  cacheBenchmarkCard.classList.add('hidden');
  editorTextarea.value = injectTypeMismatchCode(editorTextarea.value, sourceLang);
  syncEditorGutter();
  void runMigrationPipeline({ commitSnapshot: false, fast: true });
});

$<HTMLButtonElement>('btn-inject-deprecation').addEventListener('click', async () => {
  if (isPipelineRunning) return;
  audioEngine.playClick();
  cacheBenchmarkCard.classList.add('hidden');

  // 1. Inject deprecated call & detect it in AST
  const deprecatedCode = injectDeprecatedApiCode(editorTextarea.value, sourceLang);
  editorTextarea.value = deprecatedCode;
  const preComp = compileAndMigrate(deprecatedCode, sourceLang, targetLang);
  currentCompilation = preComp;
  syncEditorGutter();
  astCanvas.setAst(preComp.ast, true);
  const depNodeIds = preComp.deprecatedHits.map((d) => d.nodeId);
  if (depNodeIds.length > 0) {
    astCanvas.highlightNodes(depNodeIds);
  }
  showLabBanner(
    'patch',
    `<strong>⚠ Breaking Deprecated API Detected:</strong> Synthesizing deterministic AI Patch &amp; re-verifying AST...`
  );

  await delay(650);

  // 2. Apply AI Patch & re-run 11-phase migration
  const { patchedCode, appliedPatches } = applyAiPatchToCode(deprecatedCode);
  editorTextarea.value = patchedCode;
  syncEditorGutter();

  // Highlight FunctionDecl / AsyncAwait nodes affected by the patch
  const postPre = compileAndMigrate(patchedCode, sourceLang, targetLang);
  const patchedIds: string[] = [];
  const findAsyncOrFn = (n: AstNode): void => {
    if (n.kind === 'AsyncAwait' || n.kind === 'FunctionDecl') patchedIds.push(n.id);
    n.children.forEach(findAsyncOrFn);
  };
  findAsyncOrFn(postPre.ast);

  await runMigrationPipeline({
    commitSnapshot: true,
    labelPrefix: 'Patched',
    patchedNodeIds: patchedIds.slice(0, 2),
    patchNotes: appliedPatches.length > 0 ? appliedPatches : ['AI Patch applied to deprecated AST call site.'],
    fast: true,
  });
});

$<HTMLButtonElement>('btn-sim-cold-cache').addEventListener('click', () => {
  if (isPipelineRunning) return;
  audioEngine.playClick();
  const res = runColdVsHotCacheBenchmark(editorTextarea.value, sourceLang, targetLang);
  const comp = compileAndMigrate(editorTextarea.value, sourceLang, targetLang);
  const stats = semanticCache.evaluateAndCommit(comp.ast, targetLang, true);
  currentCompilation = comp;
  astCanvas.setAst(comp.ast, false);
  updateTelemetryChips(comp, stats);

  cacheBenchmarkCard.classList.remove('hidden');
  cacheBenchmarkCard.innerHTML = `
    <div><strong>SHA-256 Semantic Cache Benchmark (Cold vs Hot AST Pass)</strong></div>
    <div class="bench-grid">
      <div class="bench-stat"><span>Cold Cache Pass</span><strong style="color:#fbbf24;">${res.coldDurationMs} ms (${res.coldTokens} tok)</strong></div>
      <div class="bench-stat"><span>Hot Semantic Cache</span><strong>${res.hotDurationMs} ms (${res.hotTokens} tok)</strong></div>
      <div class="bench-stat"><span>Token Budget Saved</span><strong>${res.savedPercent}% (${res.speedupFactor}x faster)</strong></div>
    </div>
  `;
  setPipelineStatus(
    'ready',
    `BENCHMARK: ${res.savedPercent}% SAVED`,
    `Cold cache: ${res.coldDurationMs}ms (${res.coldTokens} tok) vs Hot cache: ${res.hotDurationMs}ms (${res.hotTokens} tok).`
  );
  audioEngine.playCommitChime();
});

$<HTMLButtonElement>('btn-atomic-rollback').addEventListener('click', () => {
  if (isPipelineRunning || snapshots.length === 0) return;
  const targetSnap =
    snapshots.length >= 2 && activeSnapshotId === snapshots[snapshots.length - 1].id
      ? snapshots[snapshots.length - 2]
      : snapshots[snapshots.length - 1];
  restoreSnapshot(targetSnap.id, `Restored code, target diff, and AST state to ${targetSnap.label}.`);
});

$<HTMLButtonElement>('btn-reset-workspace').addEventListener('click', () => {
  if (isPipelineRunning) return;
  audioEngine.playClick();
  const tpl = CODE_TEMPLATES.find((t) => t.id === activeTemplateId) ?? CODE_TEMPLATES[0];
  sourceLang = tpl.language;
  targetLang = tpl.defaultTarget;
  sourceLangSelect.value = sourceLang;
  targetLangSelect.value = targetLang;
  editorTextarea.value = tpl.code;
  semanticCache.clear();
  snapshots = [];
  snapshotSeq = 0;
  hideLabBanner();
  cacheBenchmarkCard.classList.add('hidden');
  void runMigrationPipeline({ commitSnapshot: true, labelPrefix: 'Snap', fast: true });
});

// Copy target output
$<HTMLButtonElement>('btn-copy-target').addEventListener('click', () => {
  if (!currentCompilation) return;
  audioEngine.playClick();
  void navigator.clipboard?.writeText(currentCompilation.targetCode);
  const btn = $<HTMLButtonElement>('btn-copy-target');
  btn.textContent = 'Copied!';
  window.setTimeout(() => {
    btn.textContent = 'Copy Target';
  }, 1200);
});

// Output Subtabs
document.querySelectorAll<HTMLButtonElement>('.subtab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const key = tab.dataset.tab;
    if (!key) return;
    document.querySelectorAll('.subtab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-content-${key}`)?.classList.add('active');
  });
});

/* ============================================================================
 * BOOTSTRAP WORKBENCH
 * ============================================================================ */
initPipelineGrid();
renderTemplatePills();
sourceLangSelect.value = sourceLang;
targetLangSelect.value = targetLang;
editorTextarea.value = CODE_TEMPLATES[0].code;
syncEditorGutter();

// Run initial warm-up pass + initial Snapshot #1
void (async () => {
  const initialComp = compileAndMigrate(editorTextarea.value, sourceLang, targetLang);
  // Pre-seed cache for immediate demonstration on subsequent runs while keeping Snap #1 clean
  semanticCache.evaluateAndCommit(initialComp.ast, targetLang, true);
  await runMigrationPipeline({ commitSnapshot: true, labelPrefix: 'Snap', fast: true });
})();
