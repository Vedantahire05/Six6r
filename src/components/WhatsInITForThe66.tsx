import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * "What's in it for the 66?" — a Tinder-style swipeable card deck.
 *
 * Renders 6 cards, one at a time. Drag (mouse or touch) swipes the active
 * card left/right with a Tinder-like tilt-and-fly-off animation; the arrow
 * buttons do the same programmatically. Swiping/advancing past the final
 * card calls `onComplete` instead of going out of bounds — the parent uses
 * that to switch over to whatever comes next (e.g. SixerScrollReveal).
 *
 * NOTE: the 6 card images (badge, crate, merch hamper, mystery can, event
 * pass, golden tickets) aren't included — point `image` at wherever you
 * export/crop them to. Defaults assume /public/whats-in-it/<name>.png.
 */

interface CardData {
  number: string;
  heading: [string, string];
  description: string;
  image: string;
  imageAlt: string;
}

const CARDS: CardData[] = [
  {
    number: "01",
    heading: ["YOUR BADGE", "OF HONOUR"],
    description:
      "YOU ARE ONE OF THE ORIGINAL 66. WE WILL MAKE SURE YOU HAVE SOMETHING SUPER COOL TO PROVE IT.",
    image: "/whats-in-it/badge.png",
    imageAlt: "SIX6R member badge",
  },
  {
    number: "02",
    heading: ["YOU'RE ON", "THE LIST"],
    description:
      "YOUR FIRST CRATE OF 24 SIX6R CANS IS ON US. YOU BRING THE PEOPLE. WE WILL BRING THE SIX6R.",
    image: "/whats-in-it/crate.png",
    imageAlt: "Crate of SIX6R cans",
  },
  {
    number: "03",
    heading: ["THE GOOD", "STUFF"],
    description:
      "A MERCH HAMPER MADE ONLY FOR THE FIRST 66. NOT FOR SALE. NOT FOR EVERYONE.",
    image: "/whats-in-it/merch.png",
    imageAlt: "SIX6R merch hamper",
  },
  {
    number: "04",
    heading: ["YOU TASTE IT", "FIRST"],
    description:
      "A MERCH HAMPER MADE ONLY FOR THE FIRST 66. NOT FOR SALE. NOT FOR EVERYONE.",
    image: "/whats-in-it/mystery-can.png",
    imageAlt: "Mystery SIX6R flavour can",
  },
  {
    number: "05",
    heading: ["YOU ARE ON", "THE LIST"],
    description: "SIX6R EVENT? YOUR NAME IS ALREADY ON THE GUEST LIST.",
    image: "/whats-in-it/event-pass.png",
    imageAlt: "SIX6R event all-access pass",
  },
  {
    number: "06",
    heading: ["BRING YOUR", "PEOPLE"],
    description:
      "EVERY FIRST 66 MEMBER GETS 2 GOLDEN TICKETS. BRING PEOPLE WHO BELONG—AND GET REWARDED.",
    image: "/whats-in-it/golden-tickets.png",
    imageAlt: "Two SIX6R golden tickets",
  },
];

const SWIPE_THRESHOLD = 100; // px of drag before it counts as a swipe
const EXIT_DURATION = 320; // ms — keep in sync with the transition below

type Direction = "left" | "right";

interface WhatsInItForThe66Props {
  /** Called once, when the user advances past the final card. */
  onComplete?: () => void;
}

export default function WhatsInItForThe66({
  onComplete,
}: WhatsInItForThe66Props) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<Direction | null>(null);

  const startXRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  const isFirst = index === 0;
  const isLast = index === CARDS.length - 1;
  const card = CARDS[index];

  const settle = useCallback(() => {
    setDragging(false);
    setDragX(0);
  }, []);

  // "left" = move forward through the deck (like a Tinder pass/next),
  // "right" = step back to the previous card.
  const advance = useCallback(
    (direction: Direction) => {
      if (exiting) return;

      if (direction === "left" && isLast) {
        setExiting("left");
        window.setTimeout(() => {
          setExiting(null);
          settle();
          onComplete?.();
        }, EXIT_DURATION);
        return;
      }

      if (direction === "left" && !isLast) {
        setExiting("left");
        window.setTimeout(() => {
          setIndex((i) => Math.min(i + 1, CARDS.length - 1));
          setExiting(null);
          settle();
        }, EXIT_DURATION);
        return;
      }

      if (direction === "right" && !isFirst) {
        setExiting("right");
        window.setTimeout(() => {
          setIndex((i) => Math.max(i - 1, 0));
          setExiting(null);
          settle();
        }, EXIT_DURATION);
        return;
      }

      // Can't go back past the first card — just snap back to center.
      settle();
    },
    [exiting, isFirst, isLast, onComplete, settle]
  );

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (exiting) return;
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || pointerIdRef.current !== e.pointerId) return;
    setDragX(e.clientX - startXRef.current);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;

    if (dragX <= -SWIPE_THRESHOLD) {
      advance("left");
    } else if (dragX >= SWIPE_THRESHOLD) {
      advance("right");
    } else {
      settle();
    }
  };

  // Card transform: follows the finger while dragging, flies off-screen
  // while exiting, snaps back to center otherwise.
  let transform = "translateX(0px) rotate(0deg)";
  let opacity = 1;
  let transition = "transform 250ms ease-out";

  if (exiting === "left") {
    transform = "translateX(-140%) rotate(-18deg)";
    opacity = 0;
    transition = `transform ${EXIT_DURATION}ms ease-in, opacity ${EXIT_DURATION}ms ease-in`;
  } else if (exiting === "right") {
    transform = "translateX(140%) rotate(18deg)";
    opacity = 0;
    transition = `transform ${EXIT_DURATION}ms ease-in, opacity ${EXIT_DURATION}ms ease-in`;
  } else if (dragging) {
    const rotate = dragX / 20;
    transform = `translateX(${dragX}px) rotate(${rotate}deg)`;
    transition = "none";
  }

  return (
    <section className="relative flex h-[100dvh] w-full flex-col items-center justify-center gap-6 overflow-hidden bg-black px-6 pt-20 pb-6 sm:px-10 sm:pt-24">
      {/* Section heading */}
      <h2 className="w-full max-w-md flex-none text-center text-2xl font-extrabold uppercase leading-[1.15] text-white sm:text-4xl">
        What's in it
        <br />
        for the <span className="text-[#3E86FF]">66?</span>
      </h2>

      {/* Card stack */}
      <div
        className="relative w-full max-w-xs flex-1 sm:max-w-sm"
        style={{ touchAction: "pan-y" }}
      >
        <div className="relative h-full max-h-[46vh] w-full sm:max-h-[50vh]">
          {/* Decorative stacked outlines behind the active card */}
          <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 rounded-2xl border border-[#3E86FF]/30" />
          <div className="absolute inset-0 -translate-x-2 translate-y-5 -rotate-1 rounded-2xl border border-[#3E86FF]/50" />

          {/* Active, draggable card */}
          <div
            role="group"
            aria-label={`Card ${card.number} of ${CARDS.length}: ${card.heading.join(
              " "
            )}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="absolute inset-0 flex cursor-grab select-none flex-col justify-between overflow-hidden rounded-2xl border-2 border-[#3E86FF] bg-[#050B18] p-4 active:cursor-grabbing sm:p-6"
            style={{ transform, opacity, transition }}
          >
            <div>
              <span className="block text-base font-extrabold text-[#3E86FF]">
                {card.number}
              </span>
              <span className="mt-1 block h-[3px] w-5 bg-[#3E86FF]" />

              <h3 className="mt-3 text-lg font-extrabold uppercase leading-tight text-white sm:text-2xl">
                {card.heading[0]}
                <br />
                {card.heading[1]}
              </h3>

              <p className="mt-2 max-w-[60%] text-xs font-medium leading-snug text-white/90 sm:text-sm">
                {card.description}
              </p>
            </div>

            <img
              src={card.image}
              alt={card.imageAlt}
              draggable={false}
              className="pointer-events-none absolute bottom-3 right-2 h-auto max-h-[50%] w-[40%] object-contain drop-shadow-2xl"
            />
          </div>
        </div>
      </div>

      {/* Swipe controls */}
      <div className="flex flex-none flex-col items-center gap-2">
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-[#3E86FF]">
          Swipe to explore
        </span>
        <div className="flex items-center gap-8">
          <button
            type="button"
            aria-label="Previous card"
            disabled={isFirst || exiting !== null}
            onClick={() => advance("right")}
            className="text-3xl leading-none text-[#3E86FF] transition-opacity disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            aria-label={isLast ? "Continue" : "Next card"}
            disabled={exiting !== null}
            onClick={() => advance("left")}
            className="text-3xl leading-none text-[#3E86FF] transition-opacity disabled:opacity-30"
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}