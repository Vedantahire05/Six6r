import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * "What's in it for the 66?" — a Tinder-style swipeable card deck.
 *
 * Renders 6 cards as a real deck: the active card sits on top, with up to
 * two more cards stacked slightly behind/below it (scaled down, offset,
 * dimmed). Drag (mouse or touch) swipes the active card left/right with a
 * Tinder-like tilt-and-fly-off animation.
 *
 * Forward swipes (drag left / "next"): the deck behind the active card
 * animates forward in sync — the next card grows to full size and slides
 * into place as the front card flies off, so when the front card is gone
 * the next one is already sitting exactly where it needs to be.
 *
 * Backward swipes (drag right / "previous"): mirrored — the previous card
 * slides in from off-screen left and grows into the front position in
 * sync with the current card flying off to the right, landing exactly in
 * place the moment the current card is gone.
 *
 * The arrow buttons trigger the same animations programmatically. Swiping/
 * advancing past the final card calls `onComplete` instead of going out of
 * bounds — the parent uses that to switch over to whatever comes next
 * (e.g. SixerScrollReveal).
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

const SWIPE_THRESHOLD = 100; // px of drag before a slow drag counts as a swipe
const VELOCITY_THRESHOLD = 0.5; // px/ms — a fast flick counts even if short
const SNAP_BACK_DURATION = 380; // ms
const MAX_EXIT_DURATION = 320; // ms — slow flick
const MIN_EXIT_DURATION = 160; // ms — fast flick finishes quicker
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // slight overshoot on snap-back
const FLING_EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)"; // fast-start, smooth-out fling

// How the resting (non-active) stack cards are offset behind the front card.
const STACK_SCALE_STEP = 0.06; // each level back shrinks by this much
const STACK_Y_STEP = 16; // px each level back sits lower
const STACK_MIN_SCALE = 0.84;
const STACK_OPACITY_STEP = 0.35; // each level back dims by this much
const STACK_MIN_OPACITY = 0.35;

// How far off-screen the incoming "previous card" starts on a back-swipe,
// and how much it's rotated while entering — mirrors the exit fling values
// below so the entrance reads like the reverse of the exit.
const INCOMING_START_X = -160; // %
const INCOMING_START_ROTATE = -24; // deg

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
  const [exitDuration, setExitDuration] = useState(MAX_EXIT_DURATION);
  const [snapBack, setSnapBack] = useState(false);

  const startXRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  // Track the last couple of pointer samples so we can estimate flick speed.
  const lastSampleRef = useRef({ x: 0, t: 0 });
  const velocityRef = useRef(0); // px/ms, signed

  const isFirst = index === 0;
  const isLast = index === CARDS.length - 1;
  const card = CARDS[index];

  const settle = useCallback(() => {
    setDragging(false);
    setDragX(0);
    setSnapBack(false);
  }, []);

  // "left" = move forward through the deck (like a Tinder pass/next),
  // "right" = step back to the previous card.
  const advance = useCallback(
    (direction: Direction, duration: number = MAX_EXIT_DURATION) => {
      if (exiting) return;
      setExitDuration(duration);

      if (direction === "left" && isLast) {
        setExiting("left");
        window.setTimeout(() => {
          setExiting(null);
          settle();
          onComplete?.();
        }, duration);
        return;
      }

      if (direction === "left" && !isLast) {
        setExiting("left");
        window.setTimeout(() => {
          setIndex((i) => Math.min(i + 1, CARDS.length - 1));
          setExiting(null);
          settle();
        }, duration);
        return;
      }

      if (direction === "right" && !isFirst) {
        setExiting("right");
        window.setTimeout(() => {
          setIndex((i) => Math.max(i - 1, 0));
          setExiting(null);
          settle();
        }, duration);
        return;
      }

      // Can't go back past the first card — spring back to center.
      setSnapBack(true);
    },
    [exiting, isFirst, isLast, onComplete, settle]
  );

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (exiting) return;
    pointerIdRef.current = e.pointerId;
    startXRef.current = e.clientX;
    lastSampleRef.current = { x: e.clientX, t: performance.now() };
    velocityRef.current = 0;
    setSnapBack(false);
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || pointerIdRef.current !== e.pointerId) return;
    setDragX(e.clientX - startXRef.current);

    // Instantaneous velocity from the last two samples, smoothed a little.
    const now = performance.now();
    const dt = now - lastSampleRef.current.t;
    if (dt > 0) {
      const instant = (e.clientX - lastSampleRef.current.x) / dt;
      velocityRef.current = velocityRef.current * 0.7 + instant * 0.3;
    }
    lastSampleRef.current = { x: e.clientX, t: now };
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;

    const velocity = velocityRef.current;
    const isFastFlick = Math.abs(velocity) >= VELOCITY_THRESHOLD;
    const pastThreshold = Math.abs(dragX) >= SWIPE_THRESHOLD;
    // A fast flick wins even on a short drag; a slow deliberate drag still
    // needs to clear the distance threshold — same feel as Tinder.
    const shouldSwipe = isFastFlick || pastThreshold;
    const direction: Direction = (isFastFlick ? velocity : dragX) < 0 ? "left" : "right";

    if (shouldSwipe) {
      // Faster flicks finish their exit animation quicker.
      const speedFactor = Math.min(Math.abs(velocity) / 1.5, 1);
      const duration =
        MAX_EXIT_DURATION - speedFactor * (MAX_EXIT_DURATION - MIN_EXIT_DURATION);
      advance(direction, duration);
    } else {
      setSnapBack(true);
      settle();
    }
  };

  // Card transform: follows the finger 1:1 while dragging, springs back to
  // center on a cancelled drag, or flings off-screen on a committed swipe.
  // transformOrigin is pinned near the bottom so the rotation reads like the
  // card is pivoting off a thumb near the bottom edge, not spinning in place.
  let transform = "translateX(0px) rotate(0deg)";
  let opacity = 1;
  let transition = "none";

  if (exiting === "left") {
    transform = "translateX(-160%) rotate(-24deg)";
    opacity = 0;
    transition = `transform ${exitDuration}ms ${FLING_EASE}, opacity ${exitDuration}ms ease-out`;
  } else if (exiting === "right") {
    transform = "translateX(160%) rotate(24deg)";
    opacity = 0;
    transition = `transform ${exitDuration}ms ${FLING_EASE}, opacity ${exitDuration}ms ease-out`;
  } else if (dragging) {
    const rotate = dragX / 14;
    transform = `translateX(${dragX}px) rotate(${rotate}deg)`;
    transition = "none";
  } else if (snapBack) {
    transform = "translateX(0px) rotate(0deg)";
    transition = `transform ${SNAP_BACK_DURATION}ms ${SPRING_EASE}`;
  }

  // How far the FORWARD deck should "catch up" — 0 means the resting stack
  // offsets apply in full, 1 means the next card should already look like
  // the new front card. This is what makes the card behind visibly grow
  // forward while the front card is being dragged/flung away, instead of
  // just popping into place once the front card is gone. Only relevant
  // when swiping/dragging left (forward).
  let deckProgress = 0;
  if (exiting === "left") {
    deckProgress = 1;
  } else if (dragging && dragX < 0) {
    deckProgress = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);
  }

  // Mirror of deckProgress for going BACKWARD — 0 means the previous card
  // is fully hidden off-screen left, 1 means it should already look like
  // the new front card. Only relevant when swiping/dragging right (back).
  let backProgress = 0;
  if (exiting === "right") {
    backProgress = 1;
  } else if (dragging && dragX > 0) {
    backProgress = Math.min(dragX / SWIPE_THRESHOLD, 1);
  }

  // Transition for the resting stack cards AND the incoming previous card —
  // mirrors the front card's transition so the whole deck moves in
  // lockstep (instant while dragging, eased fling while exiting, springy
  // while snapping back).
  let stackTransition = "none";
  if (exiting) {
    stackTransition = `transform ${exitDuration}ms ${FLING_EASE}, opacity ${exitDuration}ms ${FLING_EASE}`;
  } else if (dragging) {
    stackTransition = "none";
  } else if (snapBack) {
    stackTransition = `transform ${SNAP_BACK_DURATION}ms ${SPRING_EASE}, opacity ${SNAP_BACK_DURATION}ms ${SPRING_EASE}`;
  }

  // Up to two cards stacked behind the active one (forward direction).
  const behindCards = CARDS.slice(index + 1, index + 3);
  // The one card that can slide in from the left (backward direction).
  const prevCard = !isFirst ? CARDS[index - 1] : null;

  // Incoming previous-card transform: starts off-screen left and tilted,
  // and interpolates to dead-center as backProgress goes 0 → 1 — the exact
  // reverse of how the front card flies out when going forward.
  const incomingX = INCOMING_START_X * (1 - backProgress); // -160% → 0%
  const incomingRotate = INCOMING_START_ROTATE * (1 - backProgress); // -24deg → 0deg
  const incomingOpacity = backProgress;

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
          {/* Resting cards behind the active one — these grow forward
              (scale up, slide up, brighten) as the front card is dragged
              or flung away going forward, so the deck reads as one
              continuous motion instead of the next card just popping into
              place. */}
          {behindCards
            .map((c, i) => {
              // i=0 is the very next card, i=1 the one after that.
              const level = i + 1;
              const effectiveLevel = Math.max(level - deckProgress, 0);
              const scale = Math.max(
                1 - effectiveLevel * STACK_SCALE_STEP,
                STACK_MIN_SCALE
              );
              const translateY = effectiveLevel * STACK_Y_STEP;
              const cardOpacity = Math.max(
                1 - effectiveLevel * STACK_OPACITY_STEP,
                STACK_MIN_OPACITY
              );

              return (
                <div
                  key={c.number}
                  aria-hidden="true"
                  className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-[#3E86FF] bg-[#050B18] p-4 sm:p-6"
                  style={{
                    transform: `translateY(${translateY}px) scale(${scale})`,
                    opacity: cardOpacity,
                    transition: stackTransition,
                    transformOrigin: "bottom center",
                    zIndex: 5 - level,
                    willChange: "transform, opacity",
                  }}
                >
                  <div>
                    <span className="block text-base font-extrabold text-[#3E86FF]">
                      {c.number}
                    </span>
                    <span className="mt-1 block h-[3px] w-5 bg-[#3E86FF]" />

                    <h3 className="mt-3 text-lg font-extrabold uppercase leading-tight text-white sm:text-2xl">
                      {c.heading[0]}
                      <br />
                      {c.heading[1]}
                    </h3>

                    <p className="mt-2 max-w-[60%] text-xs font-medium leading-snug text-white/90 sm:text-sm">
                      {c.description}
                    </p>
                  </div>

                  <img
                    src={c.image}
                    alt={c.imageAlt}
                    draggable={false}
                    className="pointer-events-none absolute bottom-3 right-2 h-auto max-h-[50%] w-[40%] object-contain drop-shadow-2xl"
                  />
                </div>
              );
            })
            .reverse()}

          {/* Incoming previous card — slides in from the left and grows
              into the front position as the active card is dragged or
              flung away going backward. Mirror image of the forward-stack
              animation above. Sits above the resting stack but below the
              active card, which stays on top while it flies off. */}
          {prevCard && (
            <div
              key={`incoming-${prevCard.number}`}
              aria-hidden="true"
              className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-[#3E86FF] bg-[#050B18] p-4 sm:p-6"
              style={{
                transform: `translateX(${incomingX}%) rotate(${incomingRotate}deg)`,
                opacity: incomingOpacity,
                transition: stackTransition,
                transformOrigin: "bottom center",
                zIndex: 8,
                willChange: "transform, opacity",
              }}
            >
              <div>
                <span className="block text-base font-extrabold text-[#3E86FF]">
                  {prevCard.number}
                </span>
                <span className="mt-1 block h-[3px] w-5 bg-[#3E86FF]" />

                <h3 className="mt-3 text-lg font-extrabold uppercase leading-tight text-white sm:text-2xl">
                  {prevCard.heading[0]}
                  <br />
                  {prevCard.heading[1]}
                </h3>

                <p className="mt-2 max-w-[60%] text-xs font-medium leading-snug text-white/90 sm:text-sm">
                  {prevCard.description}
                </p>
              </div>

              <img
                src={prevCard.image}
                alt={prevCard.imageAlt}
                draggable={false}
                className="pointer-events-none absolute bottom-3 right-2 h-auto max-h-[50%] w-[40%] object-contain drop-shadow-2xl"
              />
            </div>
          )}

          {/* Active, draggable card */}
          <div
            key={card.number}
            role="group"
            aria-label={`Card ${card.number} of ${CARDS.length}: ${card.heading.join(
              " "
            )}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="absolute inset-0 z-10 flex cursor-grab select-none flex-col justify-between overflow-hidden rounded-2xl border-2 border-[#3E86FF] bg-[#050B18] p-4 active:cursor-grabbing sm:p-6"
            style={{
              transform,
              opacity,
              transition,
              transformOrigin: "bottom center",
              willChange: "transform, opacity",
            }}
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