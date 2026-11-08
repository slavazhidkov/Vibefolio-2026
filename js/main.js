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

function setUpCardVideos() {
  const canHover = window.matchMedia("(hover: hover)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canHover || reducedMotion) return;

  document.querySelectorAll(".card__video").forEach((video) => {
    const card = video.closest(".card");
    let active = false;
    let resetTimer;

    const show = () => {
      active = true;
      clearTimeout(resetTimer);
      if (!video.paused) video.classList.add("card__video--visible");
      video.play().catch(() => {});
    };

    const hide = () => {
      active = false;
      video.classList.remove("card__video--visible");
      resetTimer = setTimeout(() => {
        video.pause();
        video.currentTime = 0;
      }, CARD_VIDEO_FADE);
    };

    // Fade in on "playing", so the thumbnail stays up while the video loads
    video.addEventListener("playing", () => {
      if (active) video.classList.add("card__video--visible");
    });

    card.addEventListener("mouseenter", show);
    card.addEventListener("mouseleave", hide);
    card.addEventListener("focusin", show);
    card.addEventListener("focusout", hide);
  });
}

// Fades the selected nav link in when it changed since the last page (e.g.
// Work to About). Runs as the script loads, before the page is first drawn.
(function fadeInNewNavLink() {
  const active = document.querySelector(".header__nav-link--active");
  if (!active) return;
  const current = active.getAttribute("href");
  try {
    const previous = sessionStorage.getItem("navLink");
    if (previous && previous !== current) active.classList.add("header__nav-link--entering");
    sessionStorage.setItem("navLink", current);
  } catch (error) {
    // Storage blocked: skip the fade
  }
})();

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
