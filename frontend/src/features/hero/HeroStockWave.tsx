import { useEffect, useRef, type RefObject } from "react";

interface BaseCandle {
  x: number;
  baseY: number;
  baseBodyHeight: number;
  wickTopOffset: number;
  wickBottomOffset: number;
  up: boolean;
  phase: number;
  speed: number;
  amp: number;
}

const BASE_CANDLES: BaseCandle[] = [
  { x: 24, baseY: 246, baseBodyHeight: 28, wickTopOffset: 16, wickBottomOffset: 18, up: true, phase: 0.2, speed: 1.1, amp: 12 },
  { x: 56, baseY: 232, baseBodyHeight: 24, wickTopOffset: 14, wickBottomOffset: 16, up: false, phase: 0.7, speed: 1.3, amp: 11 },
  { x: 88, baseY: 214, baseBodyHeight: 34, wickTopOffset: 18, wickBottomOffset: 16, up: true, phase: 1.1, speed: 0.95, amp: 14 },
  { x: 120, baseY: 204, baseBodyHeight: 26, wickTopOffset: 15, wickBottomOffset: 14, up: true, phase: 1.6, speed: 1.2, amp: 12 },
  { x: 152, baseY: 188, baseBodyHeight: 30, wickTopOffset: 16, wickBottomOffset: 16, up: true, phase: 2.0, speed: 1.05, amp: 15 },
  { x: 184, baseY: 168, baseBodyHeight: 38, wickTopOffset: 20, wickBottomOffset: 18, up: true, phase: 2.5, speed: 1.15, amp: 16 },
  { x: 216, baseY: 184, baseBodyHeight: 24, wickTopOffset: 14, wickBottomOffset: 16, up: false, phase: 3.1, speed: 1.25, amp: 11 },
  { x: 248, baseY: 156, baseBodyHeight: 40, wickTopOffset: 22, wickBottomOffset: 18, up: true, phase: 3.5, speed: 0.9, amp: 15 },
  { x: 280, baseY: 174, baseBodyHeight: 26, wickTopOffset: 15, wickBottomOffset: 15, up: false, phase: 4.0, speed: 1.18, amp: 12 },
  { x: 312, baseY: 192, baseBodyHeight: 28, wickTopOffset: 16, wickBottomOffset: 14, up: false, phase: 4.4, speed: 1.08, amp: 13 },
  { x: 344, baseY: 176, baseBodyHeight: 34, wickTopOffset: 18, wickBottomOffset: 16, up: true, phase: 4.9, speed: 1.22, amp: 14 },
  { x: 376, baseY: 164, baseBodyHeight: 30, wickTopOffset: 17, wickBottomOffset: 15, up: true, phase: 5.3, speed: 1.02, amp: 15 },
  { x: 408, baseY: 182, baseBodyHeight: 22, wickTopOffset: 14, wickBottomOffset: 14, up: false, phase: 5.8, speed: 1.28, amp: 11 },
  { x: 440, baseY: 200, baseBodyHeight: 26, wickTopOffset: 16, wickBottomOffset: 16, up: false, phase: 0.4, speed: 1.12, amp: 13 },
  { x: 472, baseY: 210, baseBodyHeight: 24, wickTopOffset: 14, wickBottomOffset: 15, up: false, phase: 0.9, speed: 0.98, amp: 12 },
  { x: 504, baseY: 196, baseBodyHeight: 28, wickTopOffset: 16, wickBottomOffset: 16, up: true, phase: 1.4, speed: 1.16, amp: 14 },
  { x: 536, baseY: 182, baseBodyHeight: 32, wickTopOffset: 18, wickBottomOffset: 14, up: true, phase: 1.9, speed: 1.06, amp: 15 },
  { x: 568, baseY: 198, baseBodyHeight: 22, wickTopOffset: 14, wickBottomOffset: 16, up: false, phase: 2.3, speed: 1.24, amp: 11 },
  { x: 600, baseY: 210, baseBodyHeight: 26, wickTopOffset: 15, wickBottomOffset: 16, up: false, phase: 2.8, speed: 1.04, amp: 12 },
  { x: 632, baseY: 202, baseBodyHeight: 28, wickTopOffset: 16, wickBottomOffset: 16, up: true, phase: 3.3, speed: 1.14, amp: 13 },
  { x: 664, baseY: 188, baseBodyHeight: 26, wickTopOffset: 15, wickBottomOffset: 15, up: true, phase: 3.8, speed: 1.2, amp: 14 },
  { x: 696, baseY: 180, baseBodyHeight: 24, wickTopOffset: 16, wickBottomOffset: 14, up: true, phase: 4.2, speed: 0.96, amp: 13 },
  { x: 728, baseY: 196, baseBodyHeight: 22, wickTopOffset: 14, wickBottomOffset: 15, up: false, phase: 4.7, speed: 1.18, amp: 11 },
  { x: 760, baseY: 188, baseBodyHeight: 28, wickTopOffset: 16, wickBottomOffset: 16, up: true, phase: 5.1, speed: 1.1, amp: 14 },
  { x: 792, baseY: 174, baseBodyHeight: 26, wickTopOffset: 15, wickBottomOffset: 15, up: true, phase: 5.6, speed: 1.25, amp: 15 },
  { x: 824, baseY: 190, baseBodyHeight: 24, wickTopOffset: 14, wickBottomOffset: 14, up: false, phase: 6.0, speed: 1.02, amp: 12 },
  { x: 856, baseY: 204, baseBodyHeight: 28, wickTopOffset: 16, wickBottomOffset: 16, up: false, phase: 0.5, speed: 1.15, amp: 13 },
  { x: 888, baseY: 214, baseBodyHeight: 22, wickTopOffset: 14, wickBottomOffset: 15, up: false, phase: 1.0, speed: 1.22, amp: 11 },
  { x: 920, baseY: 196, baseBodyHeight: 30, wickTopOffset: 17, wickBottomOffset: 16, up: true, phase: 1.5, speed: 1.0, amp: 15 },
  { x: 952, baseY: 178, baseBodyHeight: 34, wickTopOffset: 18, wickBottomOffset: 16, up: true, phase: 2.1, speed: 1.16, amp: 16 },
  { x: 984, baseY: 158, baseBodyHeight: 38, wickTopOffset: 20, wickBottomOffset: 18, up: true, phase: 2.6, speed: 0.94, amp: 15 },
  { x: 1016, baseY: 170, baseBodyHeight: 26, wickTopOffset: 15, wickBottomOffset: 15, up: false, phase: 3.0, speed: 1.24, amp: 12 },
  { x: 1048, baseY: 150, baseBodyHeight: 34, wickTopOffset: 18, wickBottomOffset: 16, up: true, phase: 3.6, speed: 1.08, amp: 16 },
  { x: 1080, baseY: 134, baseBodyHeight: 32, wickTopOffset: 18, wickBottomOffset: 16, up: true, phase: 4.1, speed: 1.18, amp: 15 },
  { x: 1112, baseY: 148, baseBodyHeight: 24, wickTopOffset: 14, wickBottomOffset: 14, up: false, phase: 4.5, speed: 1.04, amp: 12 },
  { x: 1144, baseY: 130, baseBodyHeight: 36, wickTopOffset: 20, wickBottomOffset: 18, up: true, phase: 5.0, speed: 1.12, amp: 16 },
  { x: 1176, baseY: 114, baseBodyHeight: 30, wickTopOffset: 18, wickBottomOffset: 15, up: true, phase: 5.5, speed: 0.98, amp: 15 },
  { x: 1208, baseY: 128, baseBodyHeight: 26, wickTopOffset: 16, wickBottomOffset: 15, up: false, phase: 5.9, speed: 1.2, amp: 12 },
  { x: 1240, baseY: 104, baseBodyHeight: 38, wickTopOffset: 22, wickBottomOffset: 18, up: true, phase: 0.3, speed: 1.06, amp: 16 },
  { x: 1272, baseY: 88, baseBodyHeight: 34, wickTopOffset: 20, wickBottomOffset: 16, up: true, phase: 0.8, speed: 1.14, amp: 15 },
  { x: 1304, baseY: 98, baseBodyHeight: 28, wickTopOffset: 16, wickBottomOffset: 15, up: false, phase: 1.3, speed: 1.22, amp: 13 },
  { x: 1336, baseY: 74, baseBodyHeight: 36, wickTopOffset: 22, wickBottomOffset: 18, up: true, phase: 1.8, speed: 0.96, amp: 15 },
  { x: 1368, baseY: 60, baseBodyHeight: 32, wickTopOffset: 20, wickBottomOffset: 16, up: true, phase: 2.4, speed: 1.12, amp: 14 },
  { x: 1400, baseY: 46, baseBodyHeight: 30, wickTopOffset: 18, wickBottomOffset: 16, up: true, phase: 2.9, speed: 1.04, amp: 14 },
  { x: 1432, baseY: 36, baseBodyHeight: 26, wickTopOffset: 16, wickBottomOffset: 14, up: true, phase: 3.4, speed: 1.18, amp: 13 },
];

const SVG_WIDTH = 1440;
const SVG_HEIGHT = 340;

function buildSmoothCurvePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  let d = `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export interface HeroStockBackdropProps {
  /** Ref to the Hero section container so pointer movement anywhere over the hero smoothly drives the chart without blocking buttons */
  interactionTargetRef: RefObject<HTMLElement | null>;
}

/**
 * Interactive, continuously animated rising sage candlestick field + smooth stock trend curve
 * matching ui-ux/hero.jpeg.
 * - Individual candles smoothly oscillate up and down at 60fps via direct SVG DOM refs (zero React re-renders).
 * - Moving the pointer across the hero creates a smooth magnetic lift, crosshair, and live illustrative tooltip.
 * - Clicking sends a gentle upward/downward ripple wave across the candles.
 * - Respects prefers-reduced-motion cleanly.
 */
export function HeroStockBackdrop({ interactionTargetRef }: HeroStockBackdropProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wickRefs = useRef<Array<SVGLineElement | null>>([]);
  const bodyRefs = useRef<Array<SVGRectElement | null>>([]);
  const curveStrokeRef = useRef<SVGPathElement | null>(null);
  const curveFillRef = useRef<SVGPathElement | null>(null);
  const crosshairRef = useRef<SVGLineElement | null>(null);
  const activeDotOuterRef = useRef<SVGCircleElement | null>(null);
  const activeDotInnerRef = useRef<SVGCircleElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipValueRef = useRef<HTMLSpanElement | null>(null);
  const tooltipDeltaRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const target = interactionTargetRef.current;
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let pointerXNorm: number | null = null;
    let pointerYNorm = 0.5;
    let smoothPointerX = -1;
    let pulseOriginX = -1;
    let pulseStartTime = -10;
    let isPageVisible = typeof document !== "undefined" ? !document.hidden : true;

    function updatePointerCoordinates(clientX: number, clientY: number) {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box || box.width <= 0) return;
      const xNorm = (clientX - box.left) / box.width;
      const yNorm = (clientY - box.top) / Math.max(box.height, 1);
      if (xNorm >= 0 && xNorm <= 1) {
        pointerXNorm = xNorm;
        pointerYNorm = Math.max(0, Math.min(1, yNorm));
      } else {
        pointerXNorm = null;
      }
      if (reducedMotion) {
        window.requestAnimationFrame(renderFrame);
      }
    }

    function handlePointerMove(event: PointerEvent) {
      updatePointerCoordinates(event.clientX, event.clientY);
    }

    function handleTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      updatePointerCoordinates(touch.clientX, touch.clientY);
    }

    function handlePointerLeave() {
      pointerXNorm = null;
      if (reducedMotion) {
        window.requestAnimationFrame(renderFrame);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      // Trigger a subtle wave pulse when user taps or clicks anywhere in the hero backdrop
      const box = containerRef.current?.getBoundingClientRect();
      if (!box || box.width <= 0) return;
      pulseOriginX = ((event.clientX - box.left) / box.width) * SVG_WIDTH;
      pulseStartTime = performance.now() / 1000;
      updatePointerCoordinates(event.clientX, event.clientY);
    }

    function handleVisibilityChange() {
      isPageVisible = !document.hidden;
      if (isPageVisible && !reducedMotion && frameId === 0) {
        frameId = window.requestAnimationFrame(renderFrame);
      }
    }

    if (target) {
      target.addEventListener("pointermove", handlePointerMove, { passive: true });
      target.addEventListener("touchmove", handleTouchMove, { passive: true });
      target.addEventListener("pointerleave", handlePointerLeave, { passive: true });
      target.addEventListener("touchend", handlePointerLeave, { passive: true });
      target.addEventListener("pointerdown", handlePointerDown, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let frameId = 0;

    const renderFrame = (nowMs: number) => {
      const t = reducedMotion ? 0 : nowMs / 1000;

      // Smoothly ease horizontal pointer tracking
      const targetSvgX = pointerXNorm !== null ? pointerXNorm * SVG_WIDTH : -1;
      if (targetSvgX >= 0) {
        smoothPointerX =
          smoothPointerX < 0 ? targetSvgX : smoothPointerX + (targetSvgX - smoothPointerX) * 0.16;
      } else {
        smoothPointerX = -1;
      }

      const curvePoints: Array<{ x: number; y: number }> = [];
      let closestCandleIndex = -1;
      let closestDist = Infinity;

      for (let i = 0; i < BASE_CANDLES.length; i++) {
        const c = BASE_CANDLES[i]!;

        // 1. Living up-and-down oscillation per candlestick
        const primaryWave = reducedMotion ? 0 : Math.sin(t * c.speed + c.phase) * c.amp;
        const secondaryBreath = reducedMotion
          ? 0
          : Math.cos(t * (c.speed * 0.65) + c.phase * 1.4) * (c.amp * 0.45);
        const bodyStretch = reducedMotion
          ? 0
          : Math.sin(t * (c.speed * 1.25) + c.phase) * 7;

        // 2. Interactive pointer magnetic response (candles lift or dip smoothly with user's cursor)
        let pointerBoost = 0;
        let proximity = 0;
        if (smoothPointerX >= 0) {
          const dist = Math.abs(c.x - smoothPointerX);
          if (dist < closestDist) {
            closestDist = dist;
            closestCandleIndex = i;
          }
          if (dist < 165) {
            proximity = Math.cos((dist / 165) * (Math.PI / 2));
            const verticalBias = (0.5 - pointerYNorm) * 44; // move cursor up -> candles rise; down -> dip
            pointerBoost = proximity * (verticalBias - 14);
          }
        }

        // 3. Click ripple wave radiating outward across candles
        let ripple = 0;
        const pulseAge = t - pulseStartTime;
        if (!reducedMotion && pulseOriginX >= 0 && pulseAge >= 0 && pulseAge < 2.2) {
          const dist = Math.abs(c.x - pulseOriginX);
          const waveFront = pulseAge * 720;
          const delta = Math.abs(dist - waveFront);
          if (delta < 140) {
            const decay = 1 - pulseAge / 2.2;
            ripple = -Math.cos((delta / 140) * (Math.PI / 2)) * 22 * decay;
          }
        }

        const bodyHeight = Math.max(14, c.baseBodyHeight + bodyStretch + proximity * 12);
        const bodyTop = Math.max(
          16,
          Math.min(SVG_HEIGHT - bodyHeight - 16, c.baseY + primaryWave + secondaryBreath + pointerBoost + ripple)
        );
        const wickTop = Math.max(6, bodyTop - c.wickTopOffset - proximity * 8);
        const wickBottom = Math.min(SVG_HEIGHT - 6, bodyTop + bodyHeight + c.wickBottomOffset + proximity * 4);

        const wickEl = wickRefs.current[i];
        const bodyEl = bodyRefs.current[i];
        const isRisingNow = primaryWave + pointerBoost + ripple < 0 ? true : c.up;
        const fill = proximity > 0.38 ? "#2E9E6B" : isRisingNow ? "#5BA484" : "#9BB2A7";
        const bodyOpacity = Math.min(0.88, (c.up ? 0.52 : 0.38) + proximity * 0.38);
        const wickOpacity = Math.min(0.92, 0.62 + proximity * 0.3);

        if (wickEl) {
          wickEl.setAttribute("y1", wickTop.toFixed(1));
          wickEl.setAttribute("y2", wickBottom.toFixed(1));
          wickEl.setAttribute("stroke", fill);
          wickEl.setAttribute("stroke-opacity", wickOpacity.toFixed(2));
        }
        if (bodyEl) {
          bodyEl.setAttribute("y", bodyTop.toFixed(1));
          bodyEl.setAttribute("height", bodyHeight.toFixed(1));
          bodyEl.setAttribute("fill", fill);
          bodyEl.setAttribute("fill-opacity", bodyOpacity.toFixed(2));
        }

        // Sample every 3rd candle (plus endpoints) for a sleek flowing trend curve right across the candle peaks
        if (i === 0 || i === BASE_CANDLES.length - 1 || i % 3 === 0) {
          curvePoints.push({ x: c.x, y: bodyTop + bodyHeight * 0.28 });
        }
      }

      const strokePath = buildSmoothCurvePath(curvePoints);
      if (curveStrokeRef.current) {
        curveStrokeRef.current.setAttribute("d", strokePath);
      }
      if (curveFillRef.current) {
        curveFillRef.current.setAttribute(
          "d",
          `${strokePath} L ${SVG_WIDTH} ${SVG_HEIGHT} L 0 ${SVG_HEIGHT} Z`
        );
      }

      // Interactive hover indicator & illustrative demo pill
      const showHover = smoothPointerX >= 0 && closestCandleIndex >= 0;
      if (showHover) {
        const activeCandle = BASE_CANDLES[closestCandleIndex]!;
        const bodyEl = bodyRefs.current[closestCandleIndex];
        const cy = bodyEl ? Number(bodyEl.getAttribute("y") ?? activeCandle.baseY) : activeCandle.baseY;

        if (crosshairRef.current) {
          crosshairRef.current.setAttribute("x1", activeCandle.x.toFixed(1));
          crosshairRef.current.setAttribute("x2", activeCandle.x.toFixed(1));
          crosshairRef.current.setAttribute("opacity", "0.45");
        }
        if (activeDotOuterRef.current) {
          activeDotOuterRef.current.setAttribute("cx", activeCandle.x.toFixed(1));
          activeDotOuterRef.current.setAttribute("cy", cy.toFixed(1));
          activeDotOuterRef.current.setAttribute("opacity", "0.35");
        }
        if (activeDotInnerRef.current) {
          activeDotInnerRef.current.setAttribute("cx", activeCandle.x.toFixed(1));
          activeDotInnerRef.current.setAttribute("cy", cy.toFixed(1));
          activeDotInnerRef.current.setAttribute("opacity", "1");
        }
        if (tooltipRef.current) {
          const pctX = (activeCandle.x / SVG_WIDTH) * 100;
          const clampedPctX = Math.max(10, Math.min(90, pctX));
          const pctY = Math.max(8, Math.min(72, (cy / SVG_HEIGHT) * 100 - 12));
          tooltipRef.current.style.opacity = "1";
          tooltipRef.current.style.left = `${clampedPctX}%`;
          tooltipRef.current.style.top = `${pctY}%`;
        }
        if (tooltipValueRef.current && tooltipDeltaRef.current) {
          const illustrativeLevel = (24200 + (SVG_HEIGHT - cy) * 3.4).toFixed(1);
          const pctMove = (((activeCandle.baseY - cy) / 240) * 10).toFixed(2);
          tooltipValueRef.current.textContent = `Demo Candle #${closestCandleIndex + 1} · ${illustrativeLevel}`;
          tooltipDeltaRef.current.textContent = `${Number(pctMove) >= 0 ? "+" : ""}${pctMove}%`;
        }
      } else {
        crosshairRef.current?.setAttribute("opacity", "0");
        activeDotOuterRef.current?.setAttribute("opacity", "0");
        activeDotInnerRef.current?.setAttribute("opacity", "0");
        if (tooltipRef.current) {
          tooltipRef.current.style.opacity = "0";
        }
      }

      if (!reducedMotion && isPageVisible) {
        frameId = window.requestAnimationFrame(renderFrame);
      } else {
        frameId = 0;
      }
    };

    frameId = window.requestAnimationFrame(renderFrame);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (target) {
        target.removeEventListener("pointermove", handlePointerMove);
        target.removeEventListener("touchmove", handleTouchMove);
        target.removeEventListener("pointerleave", handlePointerLeave);
        target.removeEventListener("touchend", handlePointerLeave);
        target.removeEventListener("pointerdown", handlePointerDown);
      }
    };
  }, [interactionTargetRef]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-x-0 top-[210px] z-10 h-[310px] overflow-visible sm:top-[225px] sm:h-[340px] lg:top-[232px] lg:h-[370px]"
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="heroBgWaveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B8E6A" stopOpacity="0.20" />
            <stop offset="75%" stopColor="#3B8E6A" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#FAF8F4" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="heroSecondaryStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#63A98A" stopOpacity="0.32" />
            <stop offset="50%" stopColor="#3B8E6A" stopOpacity="0.58" />
            <stop offset="100%" stopColor="#2A7A58" stopOpacity="0.78" />
          </linearGradient>
        </defs>

        {/* Interactive translucent ascending candlesticks */}
        <g>
          {BASE_CANDLES.map((c, idx) => {
            const fill = c.up ? "#5BA484" : "#9BB2A7";
            return (
              <g key={c.x}>
                <line
                  ref={(el) => {
                    wickRefs.current[idx] = el;
                  }}
                  x1={c.x}
                  y1={c.baseY - c.wickTopOffset}
                  x2={c.x}
                  y2={c.baseY + c.baseBodyHeight + c.wickBottomOffset}
                  stroke={fill}
                  strokeWidth="1.8"
                  strokeOpacity="0.62"
                  strokeLinecap="round"
                />
                <rect
                  ref={(el) => {
                    bodyRefs.current[idx] = el;
                  }}
                  x={c.x - 5.5}
                  y={c.baseY}
                  width="11"
                  height={c.baseBodyHeight}
                  rx="2.5"
                  fill={fill}
                  fillOpacity={c.up ? "0.52" : "0.38"}
                />
              </g>
            );
          })}
        </g>

        {/* Flowing trend fill + crisp translucent curve */}
        <path ref={curveFillRef} fill="url(#heroBgWaveFill)" />
        <path
          ref={curveStrokeRef}
          fill="none"
          stroke="url(#heroSecondaryStroke)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />

        {/* Interactive hover vertical crosshair & glowing node */}
        <line
          ref={crosshairRef}
          x1="0"
          x2="0"
          y1="10"
          y2={SVG_HEIGHT}
          stroke="#2E9E6B"
          strokeWidth="1.2"
          strokeDasharray="4 4"
          opacity="0"
        />
        <circle ref={activeDotOuterRef} cx="0" cy="0" r="11" fill="#3EC98A" opacity="0" />
        <circle
          ref={activeDotInnerRef}
          cx="0"
          cy="0"
          r="4.5"
          fill="#1F4D3A"
          stroke="#FFFFFF"
          strokeWidth="2"
          opacity="0"
        />
      </svg>

      {/* Lightweight interactive glass pill (updated directly via refs, zero re-renders) */}
      <div
        ref={tooltipRef}
        style={{ opacity: 0, transform: "translate(-50%, -100%)" }}
        className="pointer-events-none absolute z-30 hidden items-center gap-2 rounded-full border border-[rgba(74,124,100,0.28)] bg-[rgba(255,255,255,0.88)] px-3 py-1 text-[11px] font-semibold text-[#161A18] shadow-[0_6px_18px_rgba(22,26,24,0.1)] backdrop-blur-md transition-opacity duration-150 lg:inline-flex"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#2E9E6B]" />
        <span ref={tooltipValueRef} className="tabular-nums-lining">
          Demo Candle
        </span>
        <span ref={tooltipDeltaRef} className="tabular-nums-lining text-[#1F4D3A]">
          +0.00%
        </span>
        <span className="text-[10px] font-medium text-[#6E7771]">Illustrative</span>
      </div>
    </div>
  );
}

/**
 * Defines the objectBoundingBox SVG clipPath that sculpts the top edge of
 * the 5-card finfluencer strip along the glowing emerald stock wave curve,
 * matching ui-ux/hero.jpeg.
 */
export function HeroWaveClipDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <clipPath id="hero-wave-strip-clip" clipPathUnits="objectBoundingBox">
          <path d="M 0,0.43 C 0.09,0.23 0.16,0.16 0.24,0.20 C 0.32,0.24 0.39,0.26 0.45,0.17 C 0.50,0.09 0.56,0.06 0.62,0.17 C 0.67,0.27 0.72,0.28 0.77,0.19 C 0.82,0.10 0.87,0.26 0.93,0.15 C 0.97,0.09 0.99,0.04 1,0.02 L 1,1 L 0,1 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

/**
 * Glowing emerald stock line overlaid right along the clipped top edge of the
 * 5-card finfluencer showcase.
 */
export function HeroWaveBorderOverlay() {
  return (
    <svg
      viewBox="0 0 1440 360"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="heroGlowLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3B8E6A" />
          <stop offset="50%" stopColor="#3EC98A" />
          <stop offset="100%" stopColor="#34B87D" />
        </linearGradient>
        <filter id="heroLineGlow" x="-10%" y="-20%" width="120%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M 0,154.8 C 129.6,82.8 230.4,57.6 345.6,72 C 460.8,86.4 561.6,93.6 648,61.2 C 720,32.4 806.4,21.6 892.8,61.2 C 964.8,97.2 1036.8,100.8 1108.8,68.4 C 1180.8,36 1252.8,93.6 1339.2,54 C 1396.8,32.4 1425.6,14.4 1440,7.2"
        fill="none"
        stroke="url(#heroGlowLine)"
        strokeWidth="4.5"
        strokeLinecap="round"
        filter="url(#heroLineGlow)"
        opacity="0.72"
      />
      <path
        d="M 0,154.8 C 129.6,82.8 230.4,57.6 345.6,72 C 460.8,86.4 561.6,93.6 648,61.2 C 720,32.4 806.4,21.6 892.8,61.2 C 964.8,97.2 1036.8,100.8 1108.8,68.4 C 1180.8,36 1252.8,93.6 1339.2,54 C 1396.8,32.4 1425.6,14.4 1440,7.2"
        fill="none"
        stroke="#47D194"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
