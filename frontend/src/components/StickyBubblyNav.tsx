import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BookOpenText,
  ChartLineUp,
  Coins,
  FilmStrip,
  MagnifyingGlass,
  SquaresFour,
  UsersThree,
  type IconProps,
} from "@phosphor-icons/react";
import "./StickyBubblyNav.css";

export interface StickyBubblyNavItem {
  id: string;
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
}

const DEFAULT_BUBBLY_NAV_ITEMS: StickyBubblyNavItem[] = [
  { id: "dashboard", to: "/dashboard", label: "Dashboard", icon: SquaresFour },
  { id: "analyze", to: "/analyze", label: "Analyze Tip", icon: MagnifyingGlass },
  { id: "stocks", to: "/stocks", label: "Live Stocks", icon: ChartLineUp },
  { id: "pretend-money", to: "/pretend-money", label: "Pretend Money", icon: Coins },
  { id: "finfluencers", to: "/finfluencers", label: "Finfluencers", icon: UsersThree },
  { id: "corpus", to: "/corpus", label: "Demo Corpus", icon: FilmStrip },
  { id: "how-it-works", to: "/how-it-works", label: "How Checks Work", icon: BookOpenText },
];

export interface StickyBubblyNavProps {
  items?: StickyBubblyNavItem[];
  className?: string;
}

export function StickyBubblyNav({
  items = DEFAULT_BUBBLY_NAV_ITEMS,
  className = "",
}: StickyBubblyNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLElement | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const collapseTimerRef = useRef<number | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeRouteIndex = items.findIndex((item) =>
    item.to === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(item.to)
  );

  // Determine which bubble is currently stretched into a pill
  const stretchedIndex =
    hoveredIndex !== null ? hoveredIndex : activeRouteIndex >= 0 ? activeRouteIndex : 0;

  const centerIndex = (items.length - 1) / 2;

  function clearCollapseTimer() {
    if (collapseTimerRef.current !== null) {
      window.clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }

  function handleExpand() {
    clearCollapseTimer();
    setIsExpanded(true);
  }

  function handleScheduleCollapse(delayMs = 150) {
    clearCollapseTimer();
    collapseTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      setHoveredIndex(null);
    }, delayMs);
  }

  useEffect(() => {
    return () => clearCollapseTimer();
  }, []);

  // Scroll active/stretched item into view on narrow phone screens when expanded
  useEffect(() => {
    if (!isExpanded) return;
    const activeBtn = buttonRefs.current[stretchedIndex];
    if (activeBtn && typeof activeBtn.scrollIntoView === "function") {
      try {
        activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } catch {
        // Ignore in jsdom
      }
    }
  }, [isExpanded, stretchedIndex]);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isExpanded) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setIsExpanded(false);
        setHoveredIndex(null);
      }
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
        setHoveredIndex(null);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isExpanded]);

  function handleSelectDestination(item: StickyBubblyNavItem) {
    navigate(item.to);
    setIsExpanded(false);
    setHoveredIndex(null);
  }

  function handleItemKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = (index + 1) % items.length;
      setHoveredIndex(next);
      buttonRefs.current[next]?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = (index - 1 + items.length) % items.length;
      setHoveredIndex(prev);
      buttonRefs.current[prev]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsExpanded(false);
      setHoveredIndex(null);
    }
  }

  const activeItem = activeRouteIndex >= 0 ? items[activeRouteIndex] : items[0];
  const ActiveOrDefaultIcon = activeItem?.icon ?? ChartLineUp;

  return (
    <div className={`sticky-bubbly-nav-host ${className}`.trim()}>
      {/* SVG Filter Definition for Organic Gooey Coupling Between Adjacent Bubbles */}
      <svg className="sticky-bubbly-svg-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id="gooey-nav" x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 20 -8
              "
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <nav
        ref={containerRef}
        aria-label="Quick notch navigation"
        data-testid="sticky-bubbly-nav"
        onMouseEnter={handleExpand}
        onMouseLeave={() => handleScheduleCollapse(160)}
        onFocusCapture={handleExpand}
        onBlurCapture={(event) => {
          const nextFocused = event.relatedTarget as Node | null;
          if (!containerRef.current?.contains(nextFocused)) {
            handleScheduleCollapse(90);
          }
        }}
        className={`sticky-bubbly-notch ${
          isExpanded ? "sticky-bubbly-notch--expanded" : "sticky-bubbly-notch--resting"
        }`}
      >
        {/* Resting Layer — always mounted so enter AND exit morph smoothly with spring pop */}
        <button
          type="button"
          aria-label="Expand Tip Autopsy quick navigation notch"
          aria-expanded={isExpanded}
          aria-hidden={isExpanded}
          tabIndex={isExpanded ? -1 : 0}
          onClick={handleExpand}
          className={`sticky-bubbly-resting-trigger ${
            isExpanded ? "sticky-bubbly-resting-trigger--hidden" : ""
          }`}
        >
          <span className="sticky-bubbly-resting-handle" aria-hidden="true" />
          <span className="sticky-bubbly-resting-row">
            <span className="sticky-bubbly-resting-icon-badge" aria-hidden="true">
              <ActiveOrDefaultIcon size={16} weight="bold" />
            </span>
            <span className="sticky-bubbly-resting-label">{activeItem?.label ?? "Navigate"}</span>
          </span>
        </button>

        {/* Expanded Bubbly Track Layer — always mounted for continuous two-way spring animation */}
        <div
          aria-hidden={!isExpanded}
          className={`sticky-bubbly-track-wrap ${
            isExpanded ? "sticky-bubbly-track-wrap--open" : "sticky-bubbly-track-wrap--closed"
          }`}
        >
          <ul className="sticky-bubbly-list" role="menubar" aria-label="Tip Autopsy pages">
            {items.map((item, idx) => {
              const Icon = item.icon;
              const isCurrentRoute = idx === activeRouteIndex;
              const isStretched = isExpanded && idx === stretchedIndex;
              const isNeighborLeft = isExpanded && idx === stretchedIndex - 1;
              const isNeighborRight = isExpanded && idx === stretchedIndex + 1;
              const distFromCenter = Math.abs(idx - centerIndex);
              const signedOffsetFromCenter = idx - centerIndex;

              const stateClasses = [
                "sticky-bubbly-bubble",
                isCurrentRoute ? "sticky-bubbly-bubble--current" : "",
                isStretched ? "sticky-bubbly-bubble--stretched" : "",
                isNeighborLeft ? "sticky-bubbly-bubble--neighbor-left" : "",
                isNeighborRight ? "sticky-bubbly-bubble--neighbor-right" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const staggerStyle: CSSProperties = {
                "--bubble-dist": distFromCenter,
                "--bubble-signed": signedOffsetFromCenter,
              } as CSSProperties;

              return (
                <li
                  key={item.id}
                  className="sticky-bubbly-item-li"
                  role="none"
                  style={staggerStyle}
                >
                  <button
                    ref={(el) => {
                      buttonRefs.current[idx] = el;
                    }}
                    type="button"
                    role="menuitem"
                    aria-label={item.label}
                    aria-current={isCurrentRoute ? "page" : undefined}
                    tabIndex={isExpanded ? 0 : -1}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onFocus={() => setHoveredIndex(idx)}
                    onClick={() => handleSelectDestination(item)}
                    onKeyDown={(e) => handleItemKeyDown(e, idx)}
                    className={stateClasses}
                  >
                    <span className="sticky-bubbly-icon" aria-hidden="true">
                      <Icon size={18} weight={isStretched ? "bold" : "regular"} />
                    </span>
                    <span className="sticky-bubbly-label-wrap">
                      <span className="sticky-bubbly-label-inner">{item.label}</span>
                    </span>
                    {isCurrentRoute && (
                      <span className="sticky-bubbly-active-dot" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </div>
  );
}

export default StickyBubblyNav;
