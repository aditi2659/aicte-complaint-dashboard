import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitMerge, MousePointer2, Network } from 'lucide-react';
import { OverlapMatch } from '../../types';
import { useComplaints } from '../../context/ComplaintContext';
import { OverlapCompareModal } from './OverlapCompareModal';

interface ComplaintNetworkProps {
  overlaps: OverlapMatch[];
}
interface NetworkNode {
  id: string;
  label: string;
  bureau: string;
  x: number;
  y: number;
  phase: number;
}

const COLORS = {
  pink: '#FF8BCB',
  lime: '#C4F279',
  muted: '#515B50',
  white: '#E6EFE5',
};

type Point = { x: number; y: number };

// Bend each edge perpendicular to its direction. A vertical-only offset makes
// steep connections look almost perfectly straight, which caused the visual glitch.
const getCurveControlPoint = (
  a: Point,
  b: Point,
  width: number,
  height: number,
  edgeIndex: number
): Point => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = Math.min(34, Math.max(16, length * 0.09));
  const direction = edgeIndex % 2 === 0 ? 1 : -1;

  return {
    x: (a.x + b.x) / 2 + (-dy / length) * offset * direction,
    y: (a.y + b.y) / 2 + (dx / length) * offset * direction,
  };
};

export const ComplaintNetwork: React.FC<ComplaintNetworkProps> = ({ overlaps }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hoveredOverlapIdRef = useRef<string | null>(null);
  const animationTimeRef = useRef(0);
  const [selectedOverlap, setSelectedOverlap] = useState<OverlapMatch | null>(null);
  const [hoveredOverlapId, setHoveredOverlapId] = useState<string | null>(null);
  const { getComplaintById } = useComplaints();

  const network = useMemo(() => {
    const complaintIds = Array.from(
      new Set(overlaps.flatMap((overlap) => [overlap.complaintAId, overlap.complaintBId]))
    );

    const nodes: NetworkNode[] = complaintIds.map((id, index) => {
      const complaint = getComplaintById(id);
      const angle = -Math.PI / 2 + (index / Math.max(complaintIds.length, 1)) * Math.PI * 2;

      return {
        id,
        label: complaint?.caseNumber ?? id,
        bureau: complaint?.currentBureau ?? 'UNKNOWN',
        x: 0.5 + Math.cos(angle) * 0.34,
        y: 0.52 + Math.sin(angle) * 0.31,
        phase: index * 1.7,
      };
    });

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = overlaps
      .map((overlap) => ({
        overlap,
        source: nodeById.get(overlap.complaintAId),
        target: nodeById.get(overlap.complaintBId),
      }))
      .filter(
        (edge): edge is {
          overlap: OverlapMatch;
          source: NetworkNode;
          target: NetworkNode;
        } => Boolean(edge.source && edge.target)
      );

    return { nodes, edges };
  }, [overlaps, getComplaintById]);

  const strongestOverlap = useMemo(
    () =>
      overlaps.reduce<OverlapMatch | null>(
        (best, current) =>
          !best || current.similarityScore > best.similarityScore ? current : best,
        null
      ),
    [overlaps]
  );

  const unreviewedCount = overlaps.filter((overlap) => overlap.reviewStatus === 'UNREVIEWED').length;
  const confirmedCount = overlaps.filter((overlap) => overlap.reviewStatus === 'CONFIRMED_RELATED').length;
  const dismissedCount = overlaps.filter((overlap) => overlap.reviewStatus === 'DISMISSED').length;
  const selectedInsight = overlaps.find((overlap) => overlap.id === hoveredOverlapId) ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    resize();

    const getPoint = (node: NetworkNode, time: number) => ({
      x: node.x * width,
      y: node.y * height + Math.sin(time * 0.00045 + node.phase) * 5,
    });

    const draw = (time: number) => {
      animationTimeRef.current = time;
      ctx.clearRect(0, 0, width, height);

      // Fine grid inspired by the landing-page pixel network.
      ctx.save();
      ctx.strokeStyle = 'rgba(196, 242, 121, 0.045)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      const halo = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.48
      );
      halo.addColorStop(0, 'rgba(196, 242, 121, 0.045)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      // Draw each real overlap as a connection between its two complaints.
      network.edges.forEach(({ overlap, source, target }, edgeIndex) => {
        const a = getPoint(source, time);
        const b = getPoint(target, time);
        const active = hoveredOverlapIdRef.current === overlap.id;
        const color =
          overlap.reviewStatus === 'CONFIRMED_RELATED'
            ? COLORS.lime
            : overlap.reviewStatus === 'DISMISSED'
              ? COLORS.muted
              : COLORS.pink;
        const control = getCurveControlPoint(a, b, width, height, edgeIndex);
        const midX = control.x;
        const midY = control.y;

        ctx.save();
        ctx.globalAlpha = overlap.reviewStatus === 'DISMISSED' ? 0.3 : 0.78;
        ctx.strokeStyle = color;
        ctx.lineWidth = active ? 1.8 : 0.8;
        ctx.shadowColor = color;
        ctx.shadowBlur = active ? 12 : 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(midX, midY, b.x, b.y);
        ctx.stroke();
        ctx.restore();

        // Small glowing square particles travel along the connection.
        for (let particle = 0; particle < 4; particle++) {
          const progress = (time * 0.00012 + particle / 4 + edgeIndex * 0.13) % 1;
          const inverse = 1 - progress;
          const px = inverse * inverse * a.x + 2 * inverse * progress * midX + progress * progress * b.x;
          const py = inverse * inverse * a.y + 2 * inverse * progress * midY + progress * progress * b.y;

          ctx.save();
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.55 + Math.sin(time * 0.004 + particle) * 0.3;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
          ctx.fillRect(px - 2, py - 2, 4, 4);
          ctx.restore();
        }

        if (active) {
          ctx.save();
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = color;
          ctx.fillText(`${overlap.similarityScore}% MATCH`, midX, midY - 8);
          ctx.restore();
        }
      });

      // Draw complaint nodes and their labels.
      network.nodes.forEach((node) => {
        const point = getPoint(node, time);
        const highlighted = network.edges.some(
          (edge) =>
            (edge.source.id === node.id || edge.target.id === node.id) &&
            edge.overlap.id === hoveredOverlapIdRef.current
        );
        const bureauColor =
          node.bureau === 'PGRC' ? COLORS.pink : node.bureau === 'RB' ? COLORS.lime : '#75D6C5';

        ctx.save();
        ctx.shadowColor = bureauColor;
        ctx.shadowBlur = highlighted ? 18 : 8;
        ctx.fillStyle = bureauColor;
        ctx.fillRect(point.x - 4, point.y - 4, 8, 8);
        ctx.restore();

        ctx.fillStyle = `${bureauColor}99`;
        ctx.fillRect(point.x + 7, point.y - 5, 3, 3);
        ctx.fillRect(point.x - 8, point.y + 7, 2, 2);

        ctx.save();
        ctx.font = highlighted ? 'bold 10px monospace' : '9px monospace';
        ctx.textAlign = point.x > width * 0.75 ? 'right' : 'left';
        ctx.fillStyle = highlighted ? '#FFFFFF' : COLORS.white;
        const labelX = point.x > width * 0.75 ? point.x - 11 : point.x + 12;
        const shortLabel = node.label.length > 23 ? `${node.label.slice(0, 21)}…` : node.label;
        ctx.fillText(shortLabel, labelX, point.y - 7);
        ctx.font = '9px monospace';
        ctx.fillStyle = bureauColor;
        ctx.fillText(node.bureau, labelX, point.y + 7);
        ctx.restore();
      });

      // Decorative floating pixels.
      for (let i = 0; i < 46; i++) {
        const x = (i * 97.3 + Math.sin(time * 0.0003 + i) * 7) % Math.max(width, 1);
        const y = (i * 47.7 + Math.cos(time * 0.00025 + i) * 9) % Math.max(height, 1);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255,139,203,0.4)' : 'rgba(196,242,121,0.25)';
        ctx.fillRect(x, y, 2, 2);
      }

      animationId = window.requestAnimationFrame(draw);
    };

    animationId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, [network]);

  const findOverlapAt = (event: React.MouseEvent<HTMLCanvasElement>): OverlapMatch | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const time = animationTimeRef.current;
    let closestOverlap: OverlapMatch | null = null;
    let closestDistance = Infinity;

    const getAnimatedPoint = (node: NetworkNode): Point => ({
      x: node.x * rect.width,
      y: node.y * rect.height + Math.sin(time * 0.00045 + node.phase) * 5,
    });

    network.edges.forEach(({ overlap, source, target }, edgeIndex) => {
      const a = getAnimatedPoint(source);
      const b = getAnimatedPoint(target);
      const control = getCurveControlPoint(a, b, rect.width, rect.height, edgeIndex);

      // Sample the same quadratic curve used by the renderer so hover/click
      // detection follows the visible line, including its animated endpoints.
      for (let step = 0; step <= 32; step++) {
        const t = step / 32;
        const inverse = 1 - t;
        const px =
          inverse * inverse * a.x +
          2 * inverse * t * control.x +
          t * t * b.x;
        const py =
          inverse * inverse * a.y +
          2 * inverse * t * control.y +
          t * t * b.y;
        const distance = Math.hypot(x - px, y - py);

        if (distance < 18 && distance < closestDistance) {
          closestDistance = distance;
          closestOverlap = overlap;
        }
      }
    });

    return closestOverlap;
  };

  const handlePointerMove = (
    event: React.MouseEvent<HTMLCanvasElement>
    ) => {
    const overlap = findOverlapAt(event);
    const nextId = overlap?.id ?? null;

    hoveredOverlapIdRef.current = nextId;

    setHoveredOverlapId((previousId) =>
        previousId === nextId ? previousId : nextId
    );

    event.currentTarget.style.cursor = overlap ? 'pointer' : 'default';
    };

  return (
    <>
      <section className="overflow-hidden border border-[#35473A] bg-black">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#35473A] px-4 py-3">
          <div className="flex items-center gap-2">
            <Network size={15} className="text-[#C4F279]" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#C4F279]">
              Complaint Connection Network
            </h3>
            <span className="border border-[#FF8BCB]/40 bg-[#FF8BCB]/10 px-2 py-0.5 font-mono text-[9px] text-[#FF8BCB]">
              {network.edges.length} CONNECTIONS
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-[#A6B7A8]">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-[#FF8BCB]" /> Unreviewed</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-[#C4F279]" /> Confirmed</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 bg-[#515B50]" /> Dismissed</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
          {/* Animated network */}
          <div
            ref={wrapperRef}
            className="relative h-[340px] min-w-0 border-b border-[#35473A] lg:h-[380px] lg:border-b-0 lg:border-r"
          >
            <canvas
              ref={canvasRef}
              onMouseMove={handlePointerMove}
              onMouseLeave={() => {
                hoveredOverlapIdRef.current = null;
                setHoveredOverlapId(null);
                }}
              onClick={(event) => {
                const overlap = findOverlapAt(event);
                if (overlap) setSelectedOverlap(overlap);
              }}
              className="absolute inset-0 block h-full w-full"
              aria-label="Interactive network of related complaints. Click a connection to inspect the complaint pair."
              role="img"
            />

            {overlaps.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <GitMerge size={24} className="text-[#515B50]" />
                <p className="font-mono text-xs text-[#A6B7A8]">No complaint connections to visualize</p>
              </div>
            )}

            <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 font-mono text-[10px] text-[#A6B7A8]/80">
              <MousePointer2 size={11} /> Hover a connection, then click to inspect
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[9px] text-[#515B50]">
              LIVE RELATIONSHIP VIEW
            </div>
          </div>

          {/* Live insights panel */}
          <aside className="flex min-w-0 flex-col gap-4 bg-[#080A08] p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E6EFE5]">
                Network Insights
              </span>
              <span className="h-2 w-2 animate-pulse bg-[#C4F279]" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="border border-[#FF8BCB]/30 bg-[#FF8BCB]/[0.06] p-3">
                <div className="font-mono text-2xl font-bold text-[#FF8BCB]">{overlaps.length}</div>
                <div className="mt-1 text-[10px] text-[#A6B7A8]">Total connections</div>
              </div>
              <div className="border border-[#C4F279]/30 bg-[#C4F279]/[0.05] p-3">
                <div className="font-mono text-2xl font-bold text-[#C4F279]">{network.nodes.length}</div>
                <div className="mt-1 text-[10px] text-[#A6B7A8]">Linked complaints</div>
              </div>
              <div className="border border-[#35473A] bg-[#101510] p-3">
                <div className="font-mono text-xl font-bold text-[#FF8BCB]">{unreviewedCount}</div>
                <div className="mt-1 text-[10px] text-[#A6B7A8]">Awaiting review</div>
              </div>
              <div className="border border-[#35473A] bg-[#101510] p-3">
                <div className="font-mono text-xl font-bold text-[#C4F279]">{confirmedCount}</div>
                <div className="mt-1 text-[10px] text-[#A6B7A8]">Confirmed related</div>
              </div>
            </div>

            <div className="flex flex-1 flex-col border border-[#35473A] bg-[#101510] p-3">
              {(() => {
                const insight = selectedInsight ?? strongestOverlap;
                const isHovered = Boolean(selectedInsight);
                if (!insight) {
                  return (
                    <div className="flex min-h-32 flex-1 flex-col items-center justify-center text-center">
                      <Network size={22} className="mb-2 text-[#515B50]" />
                      <p className="font-mono text-xs text-[#A6B7A8]">No relationship data yet</p>
                    </div>
                  );
                }

                const complaintA = getComplaintById(insight.complaintAId);
                const complaintB = getComplaintById(insight.complaintBId);

                return (
                  <>
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#A6B7A8]">
                        {isHovered ? 'Selected connection' : 'Strongest match'}
                      </span>
                      <span className="font-mono text-sm font-bold text-[#FF8BCB]">
                        {insight.similarityScore}%
                      </span>
                    </div>

                    <div className="mb-3 h-1.5 overflow-hidden bg-[#252A24]">
                      <div
                        className="h-full bg-[#FF8BCB] transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, insight.similarityScore))}%` }}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="break-all font-mono text-[11px] text-[#C4F279]">
                        {complaintA?.caseNumber ?? insight.complaintAId}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#A6B7A8]">
                        <GitMerge size={12} className="shrink-0 text-[#FF8BCB]" /> Related to
                      </div>
                      <div className="break-all font-mono text-[11px] text-[#FF8BCB]">
                        {complaintB?.caseNumber ?? insight.complaintBId}
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[#35473A] pt-3">
                      <div className="mb-1 font-mono text-[9px] uppercase text-[#A6B7A8]">Detection reason</div>
                      <p className="text-[11px] leading-relaxed text-[#E6EFE5]">
                        {insight.reasons?.[0] ?? 'No detection reason provided.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedOverlap(insight)}
                      className="mt-4 w-full border border-[#FF8BCB]/50 bg-[#FF8BCB]/10 px-3 py-2 font-mono text-[10px] font-bold text-[#FF8BCB] transition-colors hover:bg-[#FF8BCB]/20"
                    >
                      Inspect & Compare →
                    </button>
                  </>
                );
              })()}
            </div>

            <div className="flex items-center justify-between border-t border-[#35473A] pt-3 font-mono text-[10px]">
              <span className="text-[#A6B7A8]">Dismissed matches</span>
              <span className="text-[#A6B7A8]">{dismissedCount}</span>
            </div>
          </aside>
        </div>
      </section>

      {selectedOverlap && (
        <OverlapCompareModal
          overlap={selectedOverlap}
          isOpen={true}
          onClose={() => setSelectedOverlap(null)}
        />
      )}
    </>
  );
};
