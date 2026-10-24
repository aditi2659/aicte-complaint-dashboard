import { useEffect, useRef } from 'react';

export interface PixelNetworkIntroProps {
  title?: string;
  subtitle?: string;
  durationMs?: number;
  onComplete: () => void;
}

type Particle = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  size: number;
  isPink: boolean;
  baseAlpha: number;
  appearAt: number;
  illuminate: boolean;
  /** Per-particle phase offset for breathing / pulsing (radians). */
  phase: number;
  /** Small drift velocity for post-settle organic motion. */
  driftVx: number;
  driftVy: number;
};

const BG = '#000000';
const LIME = { r: 196, g: 242, b: 121 };
const PINK = { r: 255, g: 105, b: 180 };
const LINE = { r: 255, g: 105, b: 180 };

export const DEFAULT_INTRO_TITLE = 'One system. Connected cases.';
export const DEFAULT_INTRO_SUBTITLE = 'Institution Complaint Monitoring Platform';
const DEFAULT_DURATION_MS = 4500;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function rgba(c: { r: number; g: number; b: number }, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function createParticles(width: number, height: number): Particle[] {
  const area = width * height;
  // Slightly denser than before for a richer field.
  const count = clamp(Math.round(area * 0.00068), 800, 2600);
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const tx = Math.random() * width;
    const ty = Math.random() * height;
    const scatter = 40 + Math.random() * 100;
    const angle = Math.random() * Math.PI * 2;
    const isPink = Math.random() < 0.20;
    const roll = Math.random();
    // Four size tiers: 2, 3, 4, 5 for visual depth.
    const size = roll < 0.08 ? 2 : roll < 0.38 ? 3 : roll < 0.72 ? 4 : 5;
    // Small random drift for subtle organic motion after settling.
    const driftAngle = Math.random() * Math.PI * 2;
    const driftSpeed = 0.08 + Math.random() * 0.18;

    particles.push({
      x: tx + Math.cos(angle) * scatter,
      y: ty + Math.sin(angle) * scatter,
      tx,
      ty,
      size,
      isPink,
      baseAlpha: 0.30 + Math.random() * 0.50,
      appearAt: Math.random() * 0.30,
      illuminate: Math.random() < (isPink ? 0.45 : 0.14),
      phase: Math.random() * Math.PI * 2,
      driftVx: Math.cos(driftAngle) * driftSpeed,
      driftVy: Math.sin(driftAngle) * driftSpeed,
    });
  }

  return particles;
}

function buildNeighborGraph(particles: Particle[], maxDist: number): number[][] {
  const n = particles.length;
  const neighbors: number[][] = Array.from({ length: n }, () => []);
  const cell = maxDist;
  const buckets = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const key = `${Math.floor(p.tx / cell)},${Math.floor(p.ty / cell)}`;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }

  const offsets = [-1, 0, 1];
  const maxDistSq = maxDist * maxDist;

  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const cx = Math.floor(p.tx / cell);
    const cy = Math.floor(p.ty / cell);
    for (const ox of offsets) {
      for (const oy of offsets) {
        const list = buckets.get(`${cx + ox},${cy + oy}`);
        if (!list) continue;
        for (const j of list) {
          if (j <= i) continue;
          const q = particles[j];
          const dx = p.tx - q.tx;
          const dy = p.ty - q.ty;
          if (dx * dx + dy * dy <= maxDistSq) {
            neighbors[i].push(j);
          }
        }
      }
    }
  }

  return neighbors;
}

/**
 * Select a small subset of edges to render in an accent color (lime or pink)
 * for subtle visual emphasis. Returns a Set of "i,j" keys.
 */
function pickAccentEdges(
  particles: Particle[],
  neighbors: number[][],
): Set<string> {
  const accents = new Set<string>();
  for (let i = 0; i < particles.length; i++) {
    // Only illuminate-flagged particles contribute accent edges.
    if (!particles[i].illuminate) continue;
    const links = neighbors[i];
    for (const j of links) {
      // ~20% of eligible edges get the accent treatment.
      if (Math.random() < 0.20) {
        accents.add(`${i},${j}`);
      }
    }
  }
  return accents;
}

export function PixelNetworkIntro({
  title = DEFAULT_INTRO_TITLE,
  subtitle = DEFAULT_INTRO_SUBTITLE,
  durationMs = DEFAULT_DURATION_MS,
  onComplete,
}: PixelNetworkIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      onCompleteRef.current();
      return;
    }

    const totalMs = durationMs;
    let raf = 0;
    let cancelled = false;
    let start = 0;
    let particles: Particle[] = [];
    let neighbors: number[][] = [];
    let accentEdges: Set<string> = new Set();
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;
    let completed = false;

    const finish = () => {
      if (completed || cancelled) return;
      completed = true;
      onCompleteRef.current();
    };

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

      const maxDist = clamp(Math.min(cssWidth, cssHeight) * 0.065, 32, 64);
      particles = createParticles(cssWidth, cssHeight);
      neighbors = buildNeighborGraph(particles, maxDist);
      accentEdges = pickAccentEdges(particles, neighbors);
    };

    const draw = (now: number) => {
      if (cancelled) return;
      if (!start) start = now;
      const elapsed = now - start;
      const t = clamp(elapsed / totalMs, 0, 1);
      // Seconds since start — used for breathing/pulsing oscillations.
      const secs = elapsed / 1000;

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // ── Phase timeline (adjusted for ~4.5 s total) ─────────────────
      const appearEnd = 0.18;       // Particles finish appearing
      const assembleEnd = 0.52;     // Particles finish settling
      const illuminateStart = 0.40; // Glow begins on select particles
      const textStart = 0.55;       // Title + subtitle fade in
      const fadeOutStart = 0.88;    // Everything fades out

      const assembleT = clamp((t - appearEnd) / (assembleEnd - appearEnd), 0, 1);
      const settle = easeOutCubic(assembleT);
      const illuminateT = clamp((t - illuminateStart) / 0.30, 0, 1);
      const lineAlphaScale =
        clamp((t - 0.18) / 0.32, 0, 1) * (1 - clamp((t - fadeOutStart) / 0.14, 0, 1));
      const particleFade = 1 - clamp((t - fadeOutStart) / 0.14, 0, 1);

      // How much post-settle drift to apply (ramps up after assembly).
      const driftStrength = clamp((t - assembleEnd) / 0.20, 0, 1);

      // ── Draw connection lines ──────────────────────────────────────
      ctx.lineWidth = 0.7;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const links = neighbors[i];
        if (links.length === 0) continue;

        // Compute current position of p.
        const basePx = p.x + (p.tx - p.x) * settle;
        const basePy = p.y + (p.ty - p.y) * settle;
        const px = basePx + p.driftVx * driftStrength * secs;
        const py = basePy + p.driftVy * driftStrength * secs;

        for (const j of links) {
          const q = particles[j];
          const baseQx = q.x + (q.tx - q.x) * settle;
          const baseQy = q.y + (q.ty - q.y) * settle;
          const qx = baseQx + q.driftVx * driftStrength * secs;
          const qy = baseQy + q.driftVy * driftStrength * secs;

          const dx = px - qx;
          const dy = py - qy;
          const dist = Math.hypot(dx, dy);
          const proximity = 1 - dist / 72;
          if (proximity <= 0) continue;

          const isAccent = accentEdges.has(`${i},${j}`);
          if (isAccent) {
            // Accent edge: use the colour of the more "special" particle.
            const accentColor = p.isPink || q.isPink ? PINK : LIME;
            const accentAlpha = (0.08 + proximity * 0.22) * lineAlphaScale;
            ctx.strokeStyle = rgba(accentColor, accentAlpha);
          } else {
            ctx.strokeStyle = rgba(LINE, (0.08 + proximity * 0.16) * lineAlphaScale);
          }

          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(qx, qy);
          ctx.stroke();
        }
      }

      // ── Draw particles ─────────────────────────────────────────────
      for (const p of particles) {
        const localT = clamp((t - p.appearAt) / 0.18, 0, 1);
        if (localT <= 0) continue;

        const basePx = p.x + (p.tx - p.x) * settle;
        const basePy = p.y + (p.ty - p.y) * settle;
        const px = basePx + p.driftVx * driftStrength * secs;
        const py = basePy + p.driftVy * driftStrength * secs;

        const color = p.isPink ? PINK : LIME;

        // Breathing: subtle sinusoidal alpha modulation.
        const breathe = Math.sin(secs * 1.8 + p.phase) * 0.08;
        const glow = p.illuminate ? 0.14 + illuminateT * 0.36 : 0;
        const alpha = clamp(
          (p.baseAlpha * easeOutCubic(localT) + glow + breathe) * particleFade,
          0,
          1,
        );

        ctx.fillStyle = rgba(color, alpha);
        ctx.fillRect(Math.round(px), Math.round(py), p.size, p.size);
      }

      // ── Text overlay ───────────────────────────────────────────────
      const overlay = overlayRef.current;
      if (overlay) {
        const textT = clamp((t - textStart) / 0.18, 0, 1);
        const outT = clamp((t - fadeOutStart) / 0.14, 0, 1);
        overlay.style.opacity = String(easeOutCubic(textT) * (1 - outT));
      }

      if (t >= 1) {
        finish();
        return;
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [durationMs]);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ backgroundColor: BG }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pixel-intro-title"
      aria-describedby="pixel-intro-subtitle"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full"
        aria-hidden="true"
      />
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
        style={{ opacity: 0 }}
      >
        <h1
          id="pixel-intro-title"
          className="max-w-3xl font-mono text-2xl font-bold tracking-tight sm:text-4xl"
          style={{ color: '#E6EFE5' }}
        >
          {title}
        </h1>
        <p
          id="pixel-intro-subtitle"
          className="mt-3 max-w-xl font-sans text-xs tracking-wide sm:text-sm"
          style={{ color: '#A6B7A8' }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export default PixelNetworkIntro;
