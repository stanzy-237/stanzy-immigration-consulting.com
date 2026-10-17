import React, { useRef, useEffect, useState, useCallback } from 'react';

const HALF_WINDOW = 8;
const FRICTION = 0.94;
const VELOCITY_STOP = 0.0001;
const KEY_STEP = 1;
// Position-based fold curve: each panel's angle depends on its distance from
// the viewport centre, so as scroll moves panels through the curve their
// angles "flow" continuously. Tuned to keep the byōbu fold look at rest.
const FOLD_FALLOFF_SIGMA2 = 1.2; // bell-curve width (in panels²) - small = effect concentrated at the centre
const FOLD_MIN_RATIO = 0.4; // angle scale at the centre (flatter)
const FOLD_MAX_RATIO = 1.0; // angle scale at the edges (full base fold)

export interface ByobuItem {
  image: string;
  alt?: string;
  label?: string;
}

export interface ByobuCarouselProps {
  items: ByobuItem[];
  panelWidth?: number;
  panelHeight?: number;
  foldAngle?: number;
  perspective?: number;
  background?: string;
  borderColor?: string;
  showLabels?: boolean;
  vignette?: boolean;
  autoplay?: boolean;
  autoplaySpeed?: number;
  className?: string;
  ariaLabel?: string;
}

export default function ByobuCarousel({
  items,
  panelWidth = 240,
  panelHeight = 380,
  foldAngle = 32,
  perspective = 850,
  background = '#0a0a0a',
  borderColor = 'rgba(255,255,255,0.08)',
  showLabels = true,
  vignette = true,
  autoplay = false,
  autoplaySpeed = 0.25,
  className,
  ariaLabel = 'Folded panel carousel',
}: ByobuCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [containerW, setContainerW] = useState(0);
  const slotCount = HALF_WINDOW * 2 + 1;
  const itemCount = items.length;

  const projWRef = useRef<number>(
    panelWidth * Math.cos((foldAngle * Math.PI) / 180),
  );

  const state = useRef({
    scroll: 0,
    velocity: 0,
    isDragging: false,
    pointerId: -1,
    lastPointerX: 0,
    lastPointerTime: 0,
    hovering: false,
    reducedMotion: false,
  });

  // Preload images so swapping src in RAF doesn't trigger a network blink
  useEffect(() => {
    items.forEach((it) => {
      const img = new window.Image();
      img.src = it.image;
    });
  }, [items]);

  useEffect(() => {
    const mq =
      typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    if (!mq) return;
    const update = () => {
      state.current.reducedMotion = mq.matches;
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setContainerW(rect.width);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (containerW === 0 || itemCount === 0) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (ts: number) => {
      const dt = Math.min(50, ts - lastTs);
      lastTs = ts;
      const s = state.current;

      if (!s.isDragging) {
        s.scroll += s.velocity * dt;
        s.velocity *= Math.pow(FRICTION, dt / 16);
        if (Math.abs(s.velocity) < VELOCITY_STOP) {
          if (autoplay && !s.hovering && !s.reducedMotion) {
            s.velocity = autoplaySpeed / 1000;
          } else {
            s.velocity = 0;
          }
        }
      }

      // Spacing and zigzag depth use the base angle so input mapping stays
      // stable while the per-panel angle flows.
      const baseAngleRad = (foldAngle * Math.PI) / 180;
      const baseProjW = panelWidth * Math.cos(baseAngleRad);
      // Subtle parity zigzag in depth - keeps the byōbu fold silhouette
      // without making alternating panels look noticeably mismatched in size.
      const baseDepthZ = (panelWidth * Math.sin(baseAngleRad)) / 3;
      // Edge panels recede so perspective makes them visibly smaller - the
      // "different heights / different perspectives" effect of a real byōbu.
      const recessionPerPanel = panelWidth * 0.16;
      projWRef.current = baseProjW;

      const startVi = Math.floor(s.scroll) - HALF_WINDOW;

      for (let k = 0; k < slotCount; k++) {
        const node = slotsRef.current[k];
        if (!node) continue;
        const vi = startVi + k;
        const domIdx = ((vi % itemCount) + itemCount) % itemCount;
        const parity = (((vi % 2) + 2) % 2) as 0 | 1;
        const item = items[domIdx];

        // Atomic content update - happens in the same tick as the transform.
        if (node.dataset.idx !== String(domIdx)) {
          node.dataset.idx = String(domIdx);
          const img = node.firstElementChild as HTMLImageElement | null;
          if (img && img.tagName === 'IMG') {
            if (img.src !== item.image) img.src = item.image;
            img.alt = item.alt ?? '';
          }
          const labelEl = node.querySelector('[data-label]') as HTMLElement | null;
          if (labelEl) labelEl.textContent = item.label ?? '';
        }

        if (node.dataset.parity !== String(parity)) {
          node.dataset.parity = String(parity);
          const shade = node.querySelector('[data-shade]') as HTMLElement | null;
          if (shade) {
            shade.style.background =
              parity === 0
                ? 'linear-gradient(90deg, transparent 0%, transparent 50%, rgba(0,0,0,0.45) 100%)'
                : 'linear-gradient(90deg, rgba(0,0,0,0.45) 0%, transparent 50%, transparent 100%)';
          }
        }

        // Each panel's fold angle depends on its distance from viewport
        // centre - so when scroll moves panels horizontally, every panel's
        // angle changes continuously, producing the "flowing fold" effect.
        const dist = vi - s.scroll;
        const flatness = Math.exp(-(dist * dist) / FOLD_FALLOFF_SIGMA2);
        const ratio = FOLD_MIN_RATIO + (FOLD_MAX_RATIO - FOLD_MIN_RATIO) * (1 - flatness);
        const sign = parity === 0 ? 1 : -1;
        const rot = sign * foldAngle * ratio;
        const tx = dist * baseProjW;
        const parityZ = parity === 0 ? 0 : baseDepthZ;
        const recession = -Math.abs(dist) * recessionPerPanel;
        const tz = parityZ + recession;
        node.style.transform = `translate3d(${tx}px, 0, ${tz}px) rotateY(${rot}deg)`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [containerW, itemCount, items, panelWidth, foldAngle, slotCount, autoplay, autoplaySpeed]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const s = state.current;
    s.isDragging = true;
    s.pointerId = e.pointerId;
    s.lastPointerX = e.clientX;
    s.lastPointerTime = performance.now();
    s.velocity = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = state.current;
    if (!s.isDragging) return;
    const dx = e.clientX - s.lastPointerX;
    const now = performance.now();
    const dt = Math.max(1, now - s.lastPointerTime);
    s.lastPointerX = e.clientX;
    s.lastPointerTime = now;
    const w = projWRef.current || 1;
    s.scroll -= dx / w;
    const inst = -dx / w / dt;
    s.velocity = s.velocity * 0.7 + inst * 0.3;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const s = state.current;
    if (!s.isDragging) return;
    s.isDragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const onMouseEnter = useCallback(() => {
    state.current.hovering = true;
  }, []);
  const onMouseLeave = useCallback(() => {
    state.current.hovering = false;
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const s = state.current;
    if (e.key === 'ArrowLeft') {
      s.scroll -= KEY_STEP;
      s.velocity = 0;
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      s.scroll += KEY_STEP;
      s.velocity = 0;
      e.preventDefault();
    }
  }, []);

  if (itemCount === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-clip touch-none select-none cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${className ?? ''}`}
      style={{ background }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
    >
      <div
        className="absolute inset-0 flex items-center"
        style={{ perspective: `${perspective}px`, perspectiveOrigin: '50% 50%' }}
        aria-hidden="true"
      >
        <div
          className="relative w-full"
          style={{ height: panelHeight, transformStyle: 'preserve-3d' }}
        >
          {Array.from({ length: slotCount }).map((_, k) => {
            const initialVi = k - HALF_WINDOW;
            const initialIdx = ((initialVi % itemCount) + itemCount) % itemCount;
            const initialItem = items[initialIdx];
            return (
              <div
                key={k}
                ref={(el) => {
                  slotsRef.current[k] = el;
                }}
                className="absolute top-0 left-1/2 will-change-transform overflow-clip"
                style={{
                  width: panelWidth,
                  height: panelHeight,
                  transformOrigin: '50% 50%',
                  marginLeft: -panelWidth / 2,
                  backfaceVisibility: 'hidden',
                  borderLeft: `1px solid ${borderColor}`,
                  borderRight: `1px solid ${borderColor}`,
                  boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)',
                  transform: 'translate3d(-99999px, 0, 0)',
                }}
              >
                <img
                  src={initialItem.image}
                  alt={initialItem.alt ?? ''}
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
                <div data-shade className="absolute inset-0 pointer-events-none" />
                {showLabels && (
                  <div
                    data-label
                    className="absolute inset-x-0 bottom-0 p-3 text-xs md:text-sm font-medium text-white/95 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none empty:hidden"
                  >
                    {initialItem.label ?? ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {vignette && (
        <>
          <div
            className="absolute inset-y-0 left-0 w-1/5 pointer-events-none"
            style={{ background: `linear-gradient(to right, ${background}, transparent)` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 right-0 w-1/5 pointer-events-none"
            style={{ background: `linear-gradient(to left, ${background}, transparent)` }}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}
