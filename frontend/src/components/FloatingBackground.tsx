import { useEffect, useRef, useState, useCallback } from 'react';

// ── Palettes (scroll zones) ───────────────────────────────────────────────────
// Zone 0 = cream (matches site bg), zones 1-3 shift on scroll
const PALETTES = [
  {
    bg:     '#F5F0E8',
    shirts: ['#FFFFFF', '#5BAD7F', '#E86050', '#E8B840', '#4A78B5'],
    mugs:   ['#E86050', '#E8B840', '#5BAD7F', '#4A78B5'],
    dots:   ['#E86050', '#E8B840', '#5BAD7F', '#4A78B5', '#E86060'],
  },
  {
    bg:     '#EEF2FF',
    shirts: ['#FFFFFF', '#90B4F7', '#C680E8', '#F48FB1', '#7DC8F7'],
    mugs:   ['#9575CD', '#5B9DE8', '#F06292', '#7986CB'],
    dots:   ['#7986CB', '#C680E8', '#5B9DE8', '#F48FB1'],
  },
  {
    bg:     '#F0FDF4',
    shirts: ['#FFFFFF', '#6ECF8B', '#80D0C4', '#C5DF68', '#FFCC80'],
    mugs:   ['#4DB6AC', '#81C784', '#AED581', '#4FC3F7'],
    dots:   ['#4CAF7D', '#80CBC4', '#AED581', '#4FC3F7'],
  },
  {
    bg:     '#FFF5F0',
    shirts: ['#FFFFFF', '#FFAB91', '#CE93D8', '#80DEEA', '#F48FB1'],
    mugs:   ['#FF8A65', '#BA68C8', '#4DD0E1', '#F06292'],
    dots:   ['#FF8A65', '#BA68C8', '#4DD0E1', '#F06292'],
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T extends readonly unknown[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Poisson-ish placement — rejects points that are too close together */
function scatter(n: number, W: number, H: number, minDist: number) {
  const pts: { x: number; y: number }[] = [];
  let tries = 0;
  while (pts.length < n && tries < n * 60) {
    tries++;
    const x = rnd(0.05, 0.95) * W;
    const y = rnd(0.05, 0.95) * H;
    if (pts.every((p) => Math.hypot(p.x - x, p.y - y) >= minDist)) {
      pts.push({ x, y });
    }
  }
  return pts;
}

type DotKind = 'ring' | 'dot' | 'plus' | 'wave';

function dotSVG(kind: DotKind, s: number): string {
  switch (kind) {
    case 'ring':
      return `<svg width="${s}" height="${s}" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`;
    case 'dot': {
      const d = Math.round(s * 0.7);
      return `<svg width="${d}" height="${d}" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="currentColor"/></svg>`;
    }
    case 'plus': {
      const t = Math.round(s * 1.1);
      return `<svg width="${t}" height="${t}" viewBox="0 0 14 14"><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
    }
    case 'wave': {
      const w = Math.round(s * 2.2);
      const wh = Math.round(s * 0.8);
      return `<svg width="${w}" height="${wh}" viewBox="0 0 28 11"><path d="M1 5.5 Q5 1 9 5.5 Q13 10 17 5.5 Q21 1 25 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
    }
  }
}

// ── Item / Dot data types ─────────────────────────────────────────────────────
interface Item {
  id: number; type: 'shirt' | 'mug';
  colorIdx: number; x: number; y: number;
  sz: number; rot: number; dy: number; dur: number; del: number;
}
interface Dot {
  id: number; kind: DotKind;
  colorIdx: number; x: number; y: number;
  s: number; dy: number; dur: number; del: number;
}

const DOT_KINDS: DotKind[] = ['ring', 'ring', 'ring', 'plus', 'plus', 'wave', 'wave', 'dot'];
const ITEM_PATTERN: Array<'shirt' | 'mug'> = [
  'shirt','mug','shirt','mug','shirt','shirt','mug','shirt','mug','shirt','mug','shirt','mug','shirt',
];

const SHIRT_URL = '/T-SHIRT.png';
const MUG_URL = '/CUP.png';

const SIZES = [60, 90, 120];

// ── Main component ────────────────────────────────────────────────────────────
interface FloatingBackgroundProps {
  /** Total floating items (shirts + mugs). Default 14 */
  itemCount?: number;
  /** Scatter symbols. Default 38 */
  dotCount?: number;
  /** Use as a fixed background for the whole page */
  fixed?: boolean;
  className?: string;
}

export default function FloatingBackground({
  itemCount = 14,
  dotCount = 38,
  fixed = false,
  className = '',
}: FloatingBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [palIdx, setPalIdx] = useState(0);
  const [items, setItems]   = useState<Item[]>([]);
  const [dots,  setDots]    = useState<Dot[]>([]);

  const build = useCallback((W: number, H: number) => {
    const itemPts = scatter(itemCount, W, H, 115);
    const newItems: Item[] = itemPts.map((p, i) => ({
      id: i,
      type:  ITEM_PATTERN[i % ITEM_PATTERN.length],
      colorIdx: Math.floor(Math.random() * 100),
      x: (p.x / W) * 100,
      y: (p.y / H) * 100,
      sz:  pick(SIZES),
      rot: parseFloat(rnd(-13, 13).toFixed(1)),
      dy:  parseFloat(rnd(-16, 16).toFixed(1)),
      dur: parseFloat(rnd(3.5, 7).toFixed(2)),
      del: parseFloat(rnd(-7, 0).toFixed(2)),
    }));

    const dotPts = scatter(dotCount, W, H, 42);
    const newDots: Dot[] = dotPts.map((p, i) => ({
      id: i,
      kind:  pick(DOT_KINDS),
      colorIdx: Math.floor(Math.random() * 100),
      x: (p.x / W) * 100,
      y: (p.y / H) * 100,
      s:   Math.round(rnd(8, 15)),
      dy:  parseFloat(rnd(-9, 9).toFixed(1)),
      dur: parseFloat(rnd(4, 9).toFixed(2)),
      del: parseFloat(rnd(-8, 0).toFixed(2)),
    }));

    setItems(newItems);
    setDots(newDots);
  }, [itemCount, dotCount]);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      build(entry.contentRect.width, entry.contentRect.height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [build]);

  // Scroll → palette
  useEffect(() => {
    let last = palIdx;
    const handler = () => {
      // Calculate progress across the entire page scrollable height
      const scrollTop = window.scrollY;
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );
      const winHeight = window.innerHeight;

      const maxScroll = docHeight - winHeight;
      // If page is not scrollable, default to 0
      const progress = maxScroll > 0 ? scrollTop / maxScroll : 0;

      const idx = Math.min(PALETTES.length - 1, Math.max(0, Math.floor(progress * PALETTES.length)));
      if (idx !== last) { last = idx; setPalIdx(idx); }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps



  const pal = PALETTES[palIdx];

  const baseClasses = fixed
    ? 'fixed inset-0 w-full h-full z-[-1] pointer-events-none'
    : 'relative overflow-hidden pointer-events-none';

  return (
    <div
      ref={containerRef}
      className={`${baseClasses} ${className}`}
      style={{ background: pal.bg, transition: 'background 1.3s ease' }}
    >
      {/* Scatter dots */}
      {dots.map((d) => {
        const color = pal.dots[d.colorIdx % pal.dots.length];
        return (
          <span
            key={d.id}
            className="absolute"
            style={{
              left: `${d.x.toFixed(1)}%`,
              top:  `${d.y.toFixed(1)}%`,
              transform: 'translate(-50%,-50%)',
              animation: `fb-bob ${d.dur}s ease-in-out ${d.del}s infinite`,
              color: color,
              transition: 'color 1.3s ease',
              // @ts-expect-error custom prop
              '--dy': `${d.dy}px`,
            }}
            dangerouslySetInnerHTML={{ __html: dotSVG(d.kind, d.s) }}
          />
        );
      })}

      {/* Floating t-shirts & mugs */}
      {items.map((item) => {
        const colors = item.type === 'shirt' ? pal.shirts : pal.mugs;
        const color = colors[item.colorIdx % colors.length];
        return (
          <span
            key={item.id}
            className="absolute"
            style={{
              left: `${item.x.toFixed(1)}%`,
              top:  `${item.y.toFixed(1)}%`,
              transform: 'translate(-50%,-50%)',
              animation: `fb-float ${item.dur}s ease-in-out ${item.del}s infinite`,
              // @ts-expect-error custom props
              '--r':  `${item.rot}deg`,
              '--dy': `${item.dy}px`,
              width: `${item.sz}px`,
              height: `${item.sz}px`,
            }}
          >
            {/* Using CSS mask to dynamically color the white PNGs */}
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: color,
                maskImage: `url(${item.type === 'shirt' ? SHIRT_URL : MUG_URL})`,
                WebkitMaskImage: `url(${item.type === 'shirt' ? SHIRT_URL : MUG_URL})`,
                maskSize: 'contain',
                WebkitMaskSize: 'contain',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskPosition: 'center',
                transition: 'background-color 1.3s ease',
              }}
            />
          </span>
        );
      })}

      <style>{`
        @keyframes fb-float {
          0%,100% { transform: translate(-50%,-50%) rotate(var(--r)); }
          50%      { transform: translate(-50%, calc(-50% + var(--dy))) rotate(var(--r)); }
        }
        @keyframes fb-bob {
          0%,100% { transform: translate(-50%,-50%); }
          50%      { transform: translate(-50%, calc(-50% + var(--dy))); }
        }
      `}</style>
    </div>
  );
}
