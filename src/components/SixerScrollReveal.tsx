import { useEffect, useRef, useState, useCallback } from "react";

/**
 * SIX5R scroll-driven "WANT IN?" waitlist reveal.
 *
 * As the user scrolls through this section, a stack of lines is revealed
 * one at a time. The active line gets a neon outline + glow, previously
 * revealed lines fall back to a dim translucent state, and the can in the
 * background crossfades to match the active line's color.
 *
 * Images live in /public, so they're referenced as root-relative string
 * paths (Vite serves public/ at "/") rather than imported as modules.
 */

type ColorKey = "blue" | "green" | "orange";
type CanKey = "classic" | "lime" | "peach";

interface Step {
  lines: string[];
  color: ColorKey;
  can: CanKey;
}

interface ColorConfig {
  ring: string;
  glow: string;
}

// ---- Content -----------------------------------------------------------
const STEPS: Step[] = [
  { lines: ["WANT IN?"], color: "blue", can: "classic" },
  { lines: ["NO PURCHASE"], color: "green", can: "lime" },
  { lines: ["NO SUBSCRIPTION"], color: "orange", can: "peach" },
  {
    lines: ["NO LONG ESSAY ABOUT", "WHY YOU ARE AMAZING"],
    color: "blue",
    can: "classic",
  },
  {
    lines: ["JUST TELL US A LITTLE", "ABOUT YOURSELF"],
    color: "green",
    can: "lime",
  },
];

// Root-relative paths — these resolve against /public/six6r-*.png
const CAN_IMAGES: Record<CanKey, string> = {
  classic: "/six6r-classic.png",
  lime: "/six6r-lime.png",
  peach: "/six6r-peach.png",
};

const COLORS: Record<ColorKey, ColorConfig> = {
  blue: {
    ring: "#3E86FF",
    glow: "rgba(62, 134, 255, 0.55)",
  },
  green: {
    ring: "#39E97A",
    glow: "rgba(57, 233, 122, 0.55)",
  },
  orange: {
    ring: "#FF6A3D",
    glow: "rgba(255, 106, 61, 0.55)",
  },
};

// How many viewport-heights of scroll each step gets. Higher = slower reveal.
const VH_PER_STEP = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default function App() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [stepProgress, setStepProgress] = useState(0); // 0..1 within active step
  const tickingRef = useRef(false);

  const handleScroll = useCallback(() => {
    if (tickingRef.current) return;
    tickingRef.current = true;

    requestAnimationFrame(() => {
      const el = sectionRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const scrollableHeight = rect.height - viewportH;

        const raw = scrollableHeight > 0 ? -rect.top / scrollableHeight : 0;
        const progress = clamp(raw, 0, 1);

        const rawIndex = progress * STEPS.length;
        const index = clamp(Math.floor(rawIndex), 0, STEPS.length - 1);
        const withinStep = clamp(rawIndex - index, 0, 1);

        setActiveStep(index);
        setStepProgress(withinStep);
      }
      tickingRef.current = false;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const activeCan = STEPS[activeStep].can;

  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-black"
      style={{ height: `${STEPS.length * VH_PER_STEP * 100}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* ---- Can art, crossfading between the three colorways ---- */}
        <div className="pointer-events-none absolute inset-0">
          {(Object.entries(CAN_IMAGES) as [CanKey, string][]).map(
            ([key, src]) => (
              <img
                key={key}
                src={src}
                alt=""
                aria-hidden="true"
                className="absolute -left-[18%] -top-[8%] h-[120%] w-auto max-w-none select-none object-contain transition-opacity duration-700 ease-out"
                style={{
                  opacity: key === activeCan ? 1 : 0,
                  transform: `rotate(${8 + stepProgress * 2}deg)`,
                  filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.6))",
                }}
              />
            )
          )}
          {/* Left-side gradient so text stays readable over the can */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
        </div>

        {/* ---- Revealed line stack ---- */}
        <div className="relative z-10 flex h-full w-full flex-col justify-center gap-4 px-6 sm:px-10 md:px-16">
          {STEPS.map((step, i) => {
            const isActive = i === activeStep;
            const isPast = i < activeStep;
            const isFuture = i > activeStep;
            const color = COLORS[step.color];

            return (
              <div
                key={i}
                className="w-full max-w-xl transition-all duration-500 ease-out"
                style={{
                  opacity: isFuture ? 0 : isPast ? 0.18 : 1,
                  transform: isFuture ? "translateY(16px)" : "translateY(0px)",
                }}
              >
                <div
                  className="inline-block rounded-md px-5 py-3 sm:px-6 sm:py-4 transition-all duration-500 ease-out"
                  style={
                    isActive
                      ? {
                          border: `2px solid ${color.ring}`,
                          boxShadow: `0 0 18px 2px ${color.glow}`,
                          background: "rgba(0,0,0,0.35)",
                        }
                      : {
                          border: "2px solid transparent",
                        }
                  }
                >
                  {step.lines.map((line, li) => (
                    <p
                      key={li}
                      className="font-sans text-xl font-extrabold uppercase leading-tight tracking-tight sm:text-2xl md:text-3xl"
                      style={{
                        color: isActive ? "#FFFFFF" : "#F5F5F5",
                        textShadow: isActive ? `0 0 12px ${color.glow}` : "none",
                      }}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}