import { AstNode, AstNodeKind } from '../types/ast';

interface LayoutNode {
  ast: AstNode;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  parent: LayoutNode | null;
  children: LayoutNode[];
}

const KIND_PALETTE: Record<AstNodeKind, { top: string; bottom: string; stroke: string; badge: string }> = {
  Program: { top: '#0e2240', bottom: '#0a1529', stroke: '#06b6d4', badge: '#38bdf8' },
  StructDecl: { top: '#241744', bottom: '#140f29', stroke: '#8b5cf6', badge: '#a78bfa' },
  FunctionDecl: { top: '#0b2a3c', bottom: '#081b29', stroke: '#06b6d4', badge: '#22d3ee' },
  ParamList: { top: '#172044', bottom: '#0d132b', stroke: '#6366f1', badge: '#818cf8' },
  TypeAnnotation: { top: '#092e29', bottom: '#061d1a', stroke: '#10b981', badge: '#34d399' },
  BinaryExpr: { top: '#31220c', bottom: '#1e1406', stroke: '#f59e0b', badge: '#fbbf24' },
  ReturnStmt: { top: '#0d3124', bottom: '#071f17', stroke: '#10b981', badge: '#34d399' },
  AsyncAwait: { top: '#112a46', bottom: '#0a1a2e', stroke: '#38bdf8', badge: '#7dd3fc' },
  ErrorGuard: { top: '#351b2a', bottom: '#1f0f19', stroke: '#f59e0b', badge: '#fbbf24' },
};

export class AstCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rootAst: AstNode | null = null;
  private layoutNodes: LayoutNode[] = [];
  private selectedId: string | null = null;
  private hoveredId: string | null = null;

  private activeKinds: Set<AstNodeKind> = new Set();
  private highlightedNodeIds: Set<string> = new Set();
  private pulseActive = false;

  private panX = 0;
  private panY = 0;
  private zoom = 1;
  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;

  private width = 800;
  private height = 420;
  private dpr = 1;
  private rafId = 0;
  private onSelectCallback: (node: AstNode) => void;

  constructor(canvas: HTMLCanvasElement, onSelect: (node: AstNode) => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('2D Canvas context unavailable');
    }
    this.ctx = context;
    this.onSelectCallback = onSelect;

    this.bindEvents();
    this.resize();

    const ro = new ResizeObserver(() => this.resize());
    if (canvas.parentElement) {
      ro.observe(canvas.parentElement);
    }
    this.startLoop();
  }

  public setAst(ast: AstNode, autoFit = true): void {
    this.rootAst = ast;
    this.computeLayout();
    if (!this.selectedId || !this.layoutNodes.some((n) => n.ast.id === this.selectedId)) {
      this.selectedId = ast.id;
    }
    const sel = this.layoutNodes.find((n) => n.ast.id === this.selectedId);
    if (sel) {
      this.onSelectCallback(sel.ast);
    }
    if (autoFit) {
      this.fitToView();
    }
  }

  public setPipelinePulse(active: boolean, targetKinds: AstNodeKind[] = []): void {
    this.pulseActive = active;
    this.activeKinds = new Set(targetKinds);
  }

  public highlightNodes(nodeIds: string[]): void {
    this.highlightedNodeIds = new Set(nodeIds);
    if (nodeIds.length > 0) {
      const target = this.layoutNodes.find((n) => n.ast.id === nodeIds[0]);
      if (target) {
        this.selectedId = target.ast.id;
        this.onSelectCallback(target.ast);
      }
    }
  }

  public zoomBy(factor: number): void {
    const nextZoom = Math.max(0.35, Math.min(2.2, this.zoom * factor));
    const cx = this.width / 2;
    const cy = this.height / 2;
    this.panX = cx - ((cx - this.panX) / this.zoom) * nextZoom;
    this.panY = cy - ((cy - this.panY) / this.zoom) * nextZoom;
    this.zoom = nextZoom;
  }

  public fitToView(): void {
    if (this.layoutNodes.length === 0) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of this.layoutNodes) {
      minX = Math.min(minX, n.x - n.w / 2);
      maxX = Math.max(maxX, n.x + n.w / 2);
      minY = Math.min(minY, n.y - n.h / 2);
      maxY = Math.max(maxY, n.y + n.h / 2);
    }
    const treeW = Math.max(200, maxX - minX + 64);
    const treeH = Math.max(160, maxY - minY + 64);
    const scaleX = this.width / treeW;
    const scaleY = this.height / treeH;
    this.zoom = Math.max(0.45, Math.min(1.08, Math.min(scaleX, scaleY)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    this.panX = this.width / 2 - centerX * this.zoom;
    this.panY = this.height / 2 - centerY * this.zoom;
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.width = Math.max(320, rect.width);
    this.height = Math.max(300, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    if (this.layoutNodes.length > 0 && this.panX === 0 && this.panY === 0) {
      this.fitToView();
    }
  }

  private computeLayout(): void {
    this.layoutNodes = [];
    if (!this.rootAst) return;

    const NODE_W = 164;
    const NODE_H = 52;
    const H_GAP = 20;
    const V_GAP = 86;

    const leafSpan = new Map<string, number>();
    const measureSpan = (node: AstNode): number => {
      if (node.children.length === 0) {
        leafSpan.set(node.id, NODE_W + H_GAP);
        return NODE_W + H_GAP;
      }
      let sum = 0;
      for (const c of node.children) {
        sum += measureSpan(c);
      }
      const w = Math.max(NODE_W + H_GAP, sum);
      leafSpan.set(node.id, w);
      return w;
    };
    measureSpan(this.rootAst);

    const build = (
      node: AstNode,
      leftX: number,
      depth: number,
      parent: LayoutNode | null
    ): LayoutNode => {
      const spanW = leafSpan.get(node.id) ?? NODE_W + H_GAP;
      const cx = leftX + spanW / 2;
      const cy = 48 + depth * V_GAP;

      const ln: LayoutNode = {
        ast: node,
        x: cx,
        y: cy,
        w: NODE_W,
        h: NODE_H,
        depth,
        parent,
        children: [],
      };
      this.layoutNodes.push(ln);

      let cursorX = leftX;
      // Center children if parent span is wider than sum of children spans
      const childrenTotal = node.children.reduce(
        (acc, c) => acc + (leafSpan.get(c.id) ?? NODE_W + H_GAP),
        0
      );
      if (childrenTotal < spanW) {
        cursorX += (spanW - childrenTotal) / 2;
      }

      for (const c of node.children) {
        const cw = leafSpan.get(c.id) ?? NODE_W + H_GAP;
        const childLn = build(c, cursorX, depth + 1, ln);
        ln.children.push(childLn);
        cursorX += cw;
      }
      return ln;
    };

    build(this.rootAst, 0, 0, null);
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }

  private hitTest(wx: number, wy: number): LayoutNode | null {
    for (let i = this.layoutNodes.length - 1; i >= 0; i--) {
      const n = this.layoutNodes[i];
      if (wx >= n.x - n.w / 2 && wx <= n.x + n.w / 2 && wy >= n.y - n.h / 2 && wy <= n.y + n.h / 2) {
        return n;
      }
    }
    return null;
  }

  private bindEvents(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.panStartX = this.panX;
      this.panStartY = this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        if (Math.hypot(dx, dy) > 4) {
          this.dragMoved = true;
        }
        this.panX = this.panStartX + dx;
        this.panY = this.panStartY + dy;
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      if (sx >= 0 && sy >= 0 && sx <= this.width && sy <= this.height) {
        const world = this.screenToWorld(sx, sy);
        const hit = this.hitTest(world.x, world.y);
        this.hoveredId = hit ? hit.ast.id : null;
        this.canvas.style.cursor = hit ? 'pointer' : 'grab';
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (!this.dragMoved) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        if (sx >= 0 && sy >= 0 && sx <= this.width && sy <= this.height) {
          const world = this.screenToWorld(sx, sy);
          const hit = this.hitTest(world.x, world.y);
          if (hit) {
            this.selectedId = hit.ast.id;
            this.onSelectCallback(hit.ast);
          }
        }
      }
      this.canvas.style.cursor = this.hoveredId ? 'pointer' : 'grab';
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const nextZoom = Math.max(0.35, Math.min(2.2, this.zoom * factor));
        this.panX = sx - ((sx - this.panX) / this.zoom) * nextZoom;
        this.panY = sy - ((sy - this.panY) / this.zoom) * nextZoom;
        this.zoom = nextZoom;
      },
      { passive: false }
    );
  }

  private startLoop(): void {
    const tick = (ts: number): void => {
      this.render(ts);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public destroy(): void {
    cancelAnimationFrame(this.rafId);
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private render(ts: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Clear + subtle dot grid
    ctx.fillStyle = '#050812';
    ctx.fillRect(0, 0, this.width, this.height);

    const gridStep = 28 * this.zoom;
    if (gridStep > 10) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
      const offX = ((this.panX % gridStep) + gridStep) % gridStep;
      const offY = ((this.panY % gridStep) + gridStep) % gridStep;
      for (let gx = offX; gx < this.width; gx += gridStep) {
        for (let gy = offY; gy < this.height; gy += gridStep) {
          ctx.fillRect(gx, gy, 1.2, 1.2);
        }
      }
    }

    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    const pulseT = (ts * 0.0014) % 1;

    // 1. Draw Bezier parent -> child edges & animated light pulses
    for (const node of this.layoutNodes) {
      if (!node.parent) continue;
      const px = node.parent.x;
      const py = node.parent.y + node.parent.h / 2;
      const cx = node.x;
      const cy = node.y - node.h / 2;
      const midY = (py + cy) / 2;

      const isErrEdge = node.ast.status === 'error';
      const isHotEdge =
        this.pulseActive &&
        (this.activeKinds.has(node.ast.kind) || this.activeKinds.has(node.parent.ast.kind));

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.bezierCurveTo(px, midY, cx, midY, cx, cy);
      ctx.strokeStyle = isErrEdge
        ? 'rgba(244, 63, 94, 0.78)'
        : isHotEdge
          ? 'rgba(6, 182, 212, 0.85)'
          : 'rgba(139, 92, 246, 0.36)';
      ctx.lineWidth = isHotEdge || isErrEdge ? 2.1 : 1.35;
      ctx.stroke();

      // Traveling photon pulse along edge
      if (this.pulseActive || isErrEdge || node.ast.status === 'patched') {
        const t = (pulseT + node.depth * 0.17) % 1;
        const u = 1 - t;
        const bx =
          u * u * u * px +
          3 * u * u * t * px +
          3 * u * t * t * cx +
          t * t * t * cx;
        const by =
          u * u * u * py +
          3 * u * u * t * midY +
          3 * u * t * t * midY +
          t * t * t * cy;

        ctx.beginPath();
        ctx.arc(bx, by, isHotEdge ? 4.2 : 3.0, 0, Math.PI * 2);
        ctx.fillStyle = isErrEdge ? '#fb7185' : node.ast.status === 'patched' ? '#fbbf24' : '#38bdf8';
        ctx.shadowColor = isErrEdge ? '#f43f5e' : '#06b6d4';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 2. Draw AST Nodes
    for (const node of this.layoutNodes) {
      const { ast, x, y, w, h } = node;
      const left = x - w / 2;
      const top = y - h / 2;
      const pal = KIND_PALETTE[ast.kind];

      const isSelected = ast.id === this.selectedId;
      const isHovered = ast.id === this.hoveredId;
      const isTargetKind = this.pulseActive && this.activeKinds.has(ast.kind);
      const isHighlighted = this.highlightedNodeIds.has(ast.id);

      let strokeColor = pal.stroke;
      if (ast.status === 'error') strokeColor = '#f43f5e';
      else if (ast.status === 'patched') strokeColor = '#f59e0b';
      else if (ast.status === 'cached') strokeColor = '#10b981';

      if (isSelected || isTargetKind || isHighlighted || ast.status === 'error') {
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = isSelected ? 18 : 13;
      }

      const grad = ctx.createLinearGradient(left, top, left, top + h);
      grad.addColorStop(0, ast.status === 'error' ? '#3b0c18' : pal.top);
      grad.addColorStop(1, ast.status === 'error' ? '#1f070e' : pal.bottom);

      this.drawRoundedRect(ctx, left, top, w, h, 10);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = isSelected || isHighlighted ? 2.4 : isHovered ? 1.9 : 1.25;
      ctx.strokeStyle = isSelected ? '#f8fafc' : strokeColor;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Top micro-badge: NodeKind + status dot
      ctx.font = '600 9px "Fira Code", monospace';
      ctx.fillStyle = ast.status === 'error' ? '#fda4af' : pal.badge;
      ctx.textAlign = 'left';
      ctx.fillText(ast.kind.toUpperCase(), left + 9, top + 14);

      if (ast.status !== 'clean') {
        const tag =
          ast.status === 'cached'
            ? 'HIT'
            : ast.status === 'patched'
              ? 'PATCH'
              : ast.status === 'error'
                ? 'ERR'
                : 'OK';
        ctx.font = '700 8px "Fira Code", monospace';
        ctx.fillStyle =
          ast.status === 'error'
            ? '#fb7185'
            : ast.status === 'patched'
              ? '#fbbf24'
              : '#34d399';
        ctx.textAlign = 'right';
        ctx.fillText(tag, left + w - 9, top + 14);
      }

      // Main label (clipped safely)
      ctx.font = '600 11.5px "Outfit", sans-serif';
      ctx.fillStyle = '#f1f5f9';
      ctx.textAlign = 'left';
      const labelText = ast.label.length > 21 ? `${ast.label.slice(0, 19)}..` : ast.label;
      ctx.fillText(labelText, left + 9, top + 30);

      // Sub-info: Span + SHA prefix
      ctx.font = '400 9px "Fira Code", monospace';
      ctx.fillStyle = '#94a3b8';
      const subText = `L${ast.span.startLine} • #${ast.semanticHash.slice(0, 7)}`;
      ctx.fillText(subText, left + 9, top + 44);
    }

    ctx.restore();
  }
}
