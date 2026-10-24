import { useEffect, useRef, useCallback, useState } from 'react';

// ── Palette ────────────────────────────────────────────────────────────
const BG = '#000000';
const LIME = { r: 196, g: 242, b: 121 };
const PINK = { r: 255, g: 105, b: 180 };
const LINE_COLOR = { r: 110, g: 85, b: 110 };

// ── Types ──────────────────────────────────────────────────────────────

type RGB = { r: number; g: number; b: number };

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  baseSize: number;
  isPink: boolean;
  baseAlpha: number;
  phase: number;
  driftVx: number;
  driftVy: number;
  /** Index into SPECIAL_LABELS if this is a special node, else -1. */
  specialIdx: number;
}

interface SpecialLabel {
  text: string;
  color: RGB;
  description: string;
}

// Only 3 special nodes — restrained and purposeful.
const SPECIAL_LABELS: SpecialLabel[] = [
  {
    text: 'RB',
    color: LIME,
    description:
      'Regulation Bureau — monitors institutional compliance with AICTE norms and standards.',
  },
  {
    text: 'PGRC',
    color: PINK,
    description:
      'Public Grievance Redressal Cell — handles complaints from students, faculty, and the public.',
  },
  {
    text: 'PG-2026-1138',
    color: PINK,
    description:
      'Sample grievance routed through PGRC. This is a potential overlap awaiting human review.',
  },
];

// ── Info panel state exposed to React ──────────────────────────────────

export interface InfoPanelData {
  label: string;
  description: string;
  color: string;
  screenX: number;
  screenY: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function rgba(c: RGB, a: number) {
  return `rgba(${c.r},${c.g},${c.b},${clamp(a, 0, 1)})`;
}

function createParticles(
  w: number,
  h: number,
  specialCount: number,
): Particle[] {
  const area = w * h;
  const count = clamp(Math.round(area * 0.00048), 500, 1800);
  const particles: Particle[] = [];

  // Place specials spread across the visible area.
  const specialIndices = new Set<number>();
  const specialPositions: { x: number; y: number }[] = [];
  for (let s = 0; s < specialCount; s++) {
    const sx = w * 0.18 + Math.random() * w * 0.64;
    const sy = h * 0.15 + Math.random() * h * 0.60;
    specialPositions.push({ x: sx, y: sy });
  }

  for (let i = 0; i < count; i++) {
    const tx = Math.random() * w;
    const ty = Math.random() * h;
    const isPink = Math.random() < 0.32;
    const roll = Math.random();
    const size =
      roll < 0.12 ? 3 :
      roll < 0.50 ? 4 :
      roll < 0.85 ? 5 :
      6;
    const driftAngle = Math.random() * Math.PI * 2;
    const driftSpeed = 0.08 + Math.random() * 0.16;

    particles.push({
      x: tx,
      y: ty,
      baseX: tx,
      baseY: ty,
      size,
      baseSize: size,
      isPink,
      baseAlpha: 0.42 + Math.random() * 0.48,
      phase: Math.random() * Math.PI * 2,
      driftVx: Math.cos(driftAngle) * driftSpeed,
      driftVy: Math.sin(driftAngle) * driftSpeed,
      specialIdx: -1,
    });
  }

  // Assign special labels to particles closest to each desired position.
  for (let s = 0; s < specialPositions.length; s++) {
    const sp = specialPositions[s];
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < particles.length; i++) {
      if (specialIndices.has(i)) continue;
      const dx = particles[i].baseX - sp.x;
      const dy = particles[i].baseY - sp.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      specialIndices.add(bestIdx);
      particles[bestIdx].specialIdx = s;
      particles[bestIdx].baseSize = 5;
      particles[bestIdx].size = 5;
    }
  }

  return particles;
}

function buildNeighborGraph(
  particles: Particle[],
  maxDist: number,
): number[][] {
  const n = particles.length;
  const neighbors: number[][] = Array.from({ length: n }, () => []);
  const cell = maxDist;
  const buckets = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const key = `${Math.floor(particles[i].baseX / cell)},${Math.floor(particles[i].baseY / cell)}`;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }

  const offsets = [-1, 0, 1];
  const maxDistSq = maxDist * maxDist;

  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const cx = Math.floor(p.baseX / cell);
    const cy = Math.floor(p.baseY / cell);
    for (const ox of offsets) {
      for (const oy of offsets) {
        const list = buckets.get(`${cx + ox},${cy + oy}`);
        if (!list) continue;
        for (const j of list) {
          if (j <= i) continue;
          const q = particles[j];
          const dx = p.baseX - q.baseX;
          const dy = p.baseY - q.baseY;
          if (dx * dx + dy * dy <= maxDistSq) {
            neighbors[i].push(j);
          }
        }
      }
    }
  }

  return neighbors;
}

// ── Component ──────────────────────────────────────────────────────────

export function InteractivePixelNetwork() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Mouse position stored in canvas-local CSS coordinates.
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  const [infoPanel, setInfoPanel] = useState<InfoPanelData | null>(null);

  // Reduced motion check.
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  }, []);

  // Mouse / pointer tracking — convert viewport coords to canvas-local.
  const onPointerMove = useCallback((e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.x = e.clientX - rect.left;
    mouseRef.current.y = e.clientY - rect.top;
    mouseRef.current.active = true;
  }, []);

  const onPointerLeave = useCallback(() => {
    mouseRef.current.active = false;
  }, []);

  // Canvas click handler — detect special node hits.
  const clickPosRef = useRef<{
    x: number;
    y: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      clickPosRef.current = { x: cx, y: cy, clientX: e.clientX, clientY: e.clientY };
    },
    [],
  );

  // ── Main animation effect ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let cancelled = false;
    let particles: Particle[] = [];
    let neighbors: number[][] = [];
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;

    // Cursor interaction radii.
    const CURSOR_RADIUS = 180;
    const SPECIAL_LABEL_SHOW_RADIUS = 130;

    const resize = () => {
      const parent = canvas.parentElement;
      cssWidth = parent?.clientWidth ?? window.innerWidth;
      cssHeight = parent?.clientHeight ?? window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
      canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const maxDist = clamp(Math.min(cssWidth, cssHeight) * 0.06, 30, 60);
      particles = createParticles(
        cssWidth,
        cssHeight,
        SPECIAL_LABELS.length,
      );
      neighbors = buildNeighborGraph(particles, maxDist);
    };

    const draw = (now: number) => {
      if (cancelled) return;
      const secs = now / 1000;

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      const mouse = mouseRef.current;
      const reducedMotion = prefersReducedMotion.current;

      // ── Update positions with drift ────────────────────────────────
      for (const p of particles) {
        if (reducedMotion) {
          p.x = p.baseX;
          p.y = p.baseY;
        } else {
          p.x =
            p.baseX +
            Math.sin(secs * 0.3 + p.phase) * p.driftVx * 18 +
            Math.cos(secs * 0.2 + p.phase * 1.3) * p.driftVy * 12;
          p.y =
            p.baseY +
            Math.cos(secs * 0.3 + p.phase) * p.driftVy * 18 +
            Math.sin(secs * 0.2 + p.phase * 0.7) * p.driftVx * 12;
        }
      }

      // ── Handle click hit-test ──────────────────────────────────────
      const click = clickPosRef.current;
      if (click) {
        clickPosRef.current = null;
        let hitSpecial = false;
        for (const p of particles) {
          if (p.specialIdx < 0) continue;
          const dx = p.x - click.x;
          const dy = p.y - click.y;
          if (dx * dx + dy * dy < 22 * 22) {
            const spec = SPECIAL_LABELS[p.specialIdx];
            setInfoPanel({
              label: spec.text,
              description: spec.description,
              color: `rgb(${spec.color.r},${spec.color.g},${spec.color.b})`,
              screenX: click.clientX,
              screenY: click.clientY,
            });
            hitSpecial = true;
            break;
          }
        }
        if (!hitSpecial) {
          setInfoPanel(null);
        }
      }

      // ── Draw connection lines ──────────────────────────────────────
      ctx.lineWidth = 0.8;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const links = neighbors[i];
        if (links.length === 0) continue;

        for (const j of links) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.hypot(dx, dy);
          const proximity = 1 - dist / 68;
          if (proximity <= 0) continue;

          // Cursor proximity: highlight nearby connections.
          let cursorBoost = 0;
          if (mouse.active) {
            const midX = (p.x + q.x) / 2;
            const midY = (p.y + q.y) / 2;
            const cdx = midX - mouse.x;
            const cdy = midY - mouse.y;
            const cd = Math.sqrt(cdx * cdx + cdy * cdy);
            if (cd < CURSOR_RADIUS) {
              const t = 1 - cd / CURSOR_RADIUS;
              cursorBoost = t * t * 0.35;
            }
          }

          // Accent edges: edges involving special or pink particles.
          const isAccent =
            p.specialIdx >= 0 || q.specialIdx >= 0 || (p.isPink && q.isPink);
          if (isAccent) {
            const col = p.isPink || q.isPink ? PINK : LIME;

            ctx.strokeStyle = rgba(
              col,
              0.12 + proximity * 0.24 + cursorBoost,
            );
          } else {
            ctx.strokeStyle = rgba(
              LINE_COLOR,
              0.10 + proximity * 0.14 + cursorBoost * 0.8,
            );
          }

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      // ── Draw particles ─────────────────────────────────────────────
      for (const p of particles) {
        const color = p.isPink ? PINK : LIME;
        const breathe = reducedMotion
          ? 0
          : Math.sin(secs * 1.6 + p.phase) * 0.06;

        // Cursor interaction: enlarge and brighten nearby particles.
        let sizeBoost = 0;
        let alphaBoost = 0;
        if (mouse.active) {
          const cdx = p.x - mouse.x;
          const cdy = p.y - mouse.y;
          const cd = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cd < CURSOR_RADIUS) {
            // Smooth quadratic falloff — closest pixels grow most.
            const t = 1 - cd / CURSOR_RADIUS;
            const tSq = t * t;
            sizeBoost = tSq * 9;
            alphaBoost = tSq * 0.35;
          }
        }

        const alpha = clamp(p.baseAlpha + breathe + alphaBoost, 0, 1);
        const drawSize = Math.round(p.baseSize + sizeBoost);

        // Glow halo for pixels very close to cursor.
        if (sizeBoost > 3) {
          const glowAlpha = ((sizeBoost - 3) / 6) * 0.22;
          ctx.fillStyle = rgba(color, glowAlpha);
          const glowExtra = 2;
          ctx.fillRect(
            Math.round(p.x) - glowExtra,
            Math.round(p.y) - glowExtra,
            drawSize + glowExtra * 2,
            drawSize + glowExtra * 2,
          );
        }

        ctx.fillStyle = rgba(color, alpha);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), drawSize, drawSize);
      }

      // ── Draw special-node labels ───────────────────────────────────
      ctx.textBaseline = 'middle';
      for (const p of particles) {
        if (p.specialIdx < 0) continue;
        const spec = SPECIAL_LABELS[p.specialIdx];

        // Always render a slightly brighter pixel for special nodes.
        const specialGlow =0.30 + (reducedMotion ? 0 : Math.sin(secs * 1.2 + p.phase) * 0.12);
        ctx.fillStyle = rgba(spec.color, clamp(p.baseAlpha + specialGlow, 0, 1));
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, p.baseSize + 2, p.baseSize + 2);

        // Show label only when cursor is nearby (or always for reduced-motion).
        let showLabel = reducedMotion;
        if (mouse.active && !reducedMotion) {
          const cdx = p.x - mouse.x;
          const cdy = p.y - mouse.y;
          if (cdx * cdx + cdy * cdy < SPECIAL_LABEL_SHOW_RADIUS * SPECIAL_LABEL_SHOW_RADIUS) {
            showLabel = true;
          }
        }

        if (showLabel) {
          const labelText = spec.text;
          ctx.font = '600 10px "Plus Jakarta Sans", system-ui, sans-serif';
          const metrics = ctx.measureText(labelText);
          const padX = 6;
          const padY = 4;
          const lx = Math.round(p.x) + p.baseSize + 8;
          const ly = Math.round(p.y) + p.baseSize / 2;

          // Label background.
          ctx.fillStyle = 'rgba(26, 36, 29, 0.92)';
          ctx.fillRect(
            lx - padX,
            ly - 6 - padY,
            metrics.width + padX * 2,
            12 + padY * 2,
          );

          // Label border.
          ctx.strokeStyle = 'rgba(53, 71, 58, 0.7)';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            lx - padX,
            ly - 6 - padY,
            metrics.width + padX * 2,
            12 + padY * 2,
          );

          // Label text.
          ctx.fillStyle = rgba(spec.color, 0.9);
          ctx.fillText(labelText, lx, ly);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    // Set up listeners.
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', resize);

    resize();
    raf = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', resize);
    };
  }, [onPointerMove, onPointerLeave]);

  const dismissPanel = useCallback(() => setInfoPanel(null), []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        aria-hidden="true"
        onClick={handleCanvasClick}
        style={{ cursor: 'default' }}
      />

      {/* Dismissible info panel */}
      {infoPanel && (
        <InfoPanel data={infoPanel} onDismiss={dismissPanel} />
      )}
    </>
  );
}

// ── Info Panel ─────────────────────────────────────────────────────────

function InfoPanel({
  data,
  onDismiss,
}: {
  data: InfoPanelData;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Position near the click but stay within viewport.
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 60,
    left: clamp(data.screenX + 12, 16, window.innerWidth - 280),
    top: clamp(data.screenY - 40, 16, window.innerHeight - 120),
    maxWidth: 260,
  };

  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDismiss]);

  // Close on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    // Delay so the opening click doesn't immediately dismiss.
    const id = setTimeout(() => {
      window.addEventListener('pointerdown', handler);
    }, 80);
    return () => {
      clearTimeout(id);
      window.removeEventListener('pointerdown', handler);
    };
  }, [onDismiss]);

  return (
    <div
      ref={ref}
      style={style}
      className="border border-[#35473A] bg-[#1A241D]/95 px-4 py-3 shadow-lg backdrop-blur-sm"
      role="tooltip"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span
          className="font-mono text-xs font-semibold tracking-wider"
          style={{ color: data.color }}
        >
          {data.label}
        </span>
        <button
          onClick={onDismiss}
          className="ml-3 text-[#A6B7A8] transition hover:text-white"
          aria-label="Dismiss"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 3l8 8M11 3l-8 8" />
          </svg>
        </button>
      </div>
      <p className="text-xs leading-5 text-[#A6B7A8]">{data.description}</p>
    </div>
  );
}

export default InteractivePixelNetwork;
