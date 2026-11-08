/* ==========================================================================
   Main JavaScript — scroll-reveal animation, back-to-top scroll, card videos
   ========================================================================== */

const BACK_TO_TOP_DURATION = 600;

function scrollToTop() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }

  const startY = window.scrollY;
  const startTime = performance.now();

  const step = (now) => {
    const t = Math.min((now - startTime) / BACK_TO_TOP_DURATION, 1);
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

    // "instant" stops the CSS scroll-behavior from smoothing each frame
    window.scrollTo({ top: startY * (1 - eased), behavior: "instant" });

    if (t < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

// Lazy images and videos have no height until they load, so they would all
// count as on screen at once and reveal before anyone sees them.
function whenSized(el, callback) {
  const selector = "video:not(.card__video), img[loading='lazy']";
  const media = el.matches(selector) ? el : el.querySelector(selector);
  const isVideo = media?.tagName === "VIDEO";

  if (!media || (isVideo ? media.readyState >= 1 : media.complete)) {
    callback();
    return;
  }

  media.addEventListener(isVideo ? "loadedmetadata" : "load", callback, { once: true });
  media.addEventListener("error", callback, { once: true });

  // Some browsers hold back video loading, e.g. in low power mode
  if (isVideo) setTimeout(callback, 3000);
}

const CARD_VIDEO_FADE = 300;

// Card videos play while their card is on screen (at least half visible) and
// pause when it scrolls away. On devices with a mouse or trackpad, hovering a
// card fades its video out to the still thumbnail and pauses it; moving away
// resumes it. The thumbnail stays up until a video is actually playing, so
// where autoplay is blocked (e.g. iOS Low Power Mode) it simply stays.
function setUpCardVideos() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover)").matches;
  if (reducedMotion) return;

  document.querySelectorAll(".card__video").forEach((video) => {
    const card = video.closest(".card");
    let onScreen = false;
    let hovered = false;
    let pauseTimer;

    const update = () => {
      clearTimeout(pauseTimer);
      if (onScreen && !hovered) {
        video.play().catch(() => {});
        if (!video.paused) video.classList.add("card__video--visible");
      } else {
        video.classList.remove("card__video--visible");
        // Pause once the fade back to the thumbnail has finished
        pauseTimer = setTimeout(() => video.pause(), hovered ? CARD_VIDEO_FADE : 0);
      }
    };

    video.addEventListener("playing", () => {
      if (onScreen && !hovered) video.classList.add("card__video--visible");
    });

    new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        update();
      },
      { threshold: 0.5 }
    ).observe(card);

    if (!canHover) return;
    const setHovered = (value) => () => {
      hovered = value;
      update();
    };
    card.addEventListener("mouseenter", setHovered(true));
    card.addEventListener("mouseleave", setHovered(false));
    card.addEventListener("focusin", setHovered(true));
    card.addEventListener("focusout", setHovered(false));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setUpCardVideos();

  document
    .querySelectorAll(".footer__back-to-top")
    .forEach((button) => button.addEventListener("click", scrollToTop));

  const reveals = document.querySelectorAll(".reveal");

  if (!reveals.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal--visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  reveals.forEach((el) => whenSized(el, () => observer.observe(el)));
});
