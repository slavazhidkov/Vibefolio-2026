/* ==========================================================================
   Photo wall (About page)

   - Scatters the photos in a loose grid: each photo gets its own cell and a
     random size and offset inside it, so photos never overlap. The "random"
     values are seeded, so the layout is the same on every visit.
   - Hover: the photo tilts towards the pointer, with a glare, a slight zoom
     and a shadow, driven by a spring.
   - Click: the photo opens at its real size (shrunk to fit the screen if
     needed). Clicking again, clicking outside or pressing Esc closes it.
   ========================================================================== */

(function () {
  const wall = document.querySelector(".photo-wall");
  if (!wall) return;

  const photos = [...wall.querySelectorAll(".photo-wall__item")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const PHOTO_SCALE = 1.2; // overall size of the preview photos

  const HOVER = {
    tilt: 12, // most a photo tilts, in degrees
    scale: 1.03,
    perspective: 1100,
    stiffness: 170,
    damping: 20,
  };

  /* ── Layout ─────────────────────────────────────────────────────────── */

  // Seeded random number between 0 and 1
  function random(seed) {
    let t = (seed + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const ratioOf = (photo) => {
    const img = photo.querySelector("img");
    return Number(img.getAttribute("width")) / Number(img.getAttribute("height")) || 1.5;
  };

  function layout() {
    const width = wall.clientWidth;
    if (!width) return;

    const columns = width >= 1000 ? 4 : width >= 600 ? 3 : 2;
    const gutter = columns === 2 ? 16 : 32;
    const rowGap = columns === 2 ? 32 : 48;
    const cell = (width - gutter * (columns - 1)) / columns;
    let top = 0;

    for (let start = 0; start < photos.length; start += columns) {
      const row = photos.slice(start, start + columns);
      let rowHeight = 0;

      row.forEach((photo, column) => {
        const index = start + column;
        const seed = index * 7 + columns * 101;
        const ratio = ratioOf(photo);

        // 79–120% of the cell, capped at the full cell so photos never
        // overlap. Upright photos are kept narrower so they don't tower over the row.
        let photoWidth = cell * (0.66 + random(seed) * 0.34) * PHOTO_SCALE;
        if (ratio < 1) photoWidth *= 0.8;
        photoWidth = Math.min(photoWidth, cell);

        const x = column * (cell + gutter) + random(seed + 1) * (cell - photoWidth);
        const drop = random(seed + 2) * cell * 0.45;

        photo.style.width = `${photoWidth}px`;
        photo.style.left = `${x}px`;
        photo.style.top = `${top + drop}px`;
        rowHeight = Math.max(rowHeight, drop + photo.offsetHeight);
      });

      top += rowHeight + rowGap;
    }

    wall.style.height = `${Math.max(top - rowGap, 0)}px`;
  }

  wall.classList.add("photo-wall--scattered");
  layout();

  let lastWidth = wall.clientWidth;
  new ResizeObserver(() => {
    if (wall.clientWidth === lastWidth) return;
    lastWidth = wall.clientWidth;
    layout();
  }).observe(wall);

  /* ── Hover: tilt, glare, zoom and shadow on a spring ────────────────── */

  function setUpHover(photo) {
    const frame = photo.querySelector(".photo-wall__frame");
    const keys = ["rotateX", "rotateY", "scale", "lift"];
    const now = { rotateX: 0, rotateY: 0, scale: 1, lift: 0 };
    const speed = { rotateX: 0, rotateY: 0, scale: 0, lift: 0 };
    const target = { ...now };
    let frameId = null;
    let lastTime = 0;

    const paint = () => {
      frame.style.transform =
        `perspective(${HOVER.perspective}px) rotateX(${now.rotateX}deg) ` +
        `rotateY(${now.rotateY}deg) scale(${now.scale})`;
      frame.style.setProperty("--lift", Math.min(Math.max(now.lift, 0), 1).toFixed(3));
    };

    const tick = (time) => {
      const elapsed = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      let moving = false;

      keys.forEach((key) => {
        for (let step = 0; step < 4; step += 1) {
          const dt = elapsed / 4;
          const force = (target[key] - now[key]) * HOVER.stiffness - speed[key] * HOVER.damping;
          speed[key] += force * dt;
          now[key] += speed[key] * dt;
        }
        if (Math.abs(target[key] - now[key]) > 0.0005 || Math.abs(speed[key]) > 0.001) moving = true;
        else {
          now[key] = target[key];
          speed[key] = 0;
        }
      });

      paint();
      frameId = moving ? requestAnimationFrame(tick) : null;
    };

    const start = () => {
      if (frameId !== null) return;
      lastTime = performance.now();
      frameId = requestAnimationFrame(tick);
    };

    frame.addEventListener("pointerenter", () => {
      target.scale = HOVER.scale;
      target.lift = 1;
      start();
    });

    frame.addEventListener("pointermove", (event) => {
      const box = frame.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      target.rotateY = (x - 0.5) * 2 * HOVER.tilt;
      target.rotateX = -(y - 0.5) * 2 * HOVER.tilt;
      frame.style.setProperty("--glare-x", `${x * 100}%`);
      frame.style.setProperty("--glare-y", `${y * 100}%`);
      start();
    });

    frame.addEventListener("pointerleave", () => {
      Object.assign(target, { rotateX: 0, rotateY: 0, scale: 1, lift: 0 });
      start();
    });
  }

  if (canHover && !reducedMotion) photos.forEach(setUpHover);

  /* ── Click: open the photo at its real size ─────────────────────────── */

  const arrow = (path) =>
    `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${path}" fill="none" ` +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const viewer = document.createElement("div");
  viewer.className = "photo-viewer";
  viewer.hidden = true;
  viewer.tabIndex = -1;
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-modal", "true");
  viewer.setAttribute("aria-label", "Photo. Use the arrow keys to browse, Escape to close.");
  viewer.innerHTML =
    '<img class="photo-viewer__image" alt="" />' +
    `<button class="photo-viewer__arrow photo-viewer__arrow--prev" type="button" aria-label="Previous photo">${arrow("M15 5l-7 7 7 7")}</button>` +
    `<button class="photo-viewer__arrow photo-viewer__arrow--next" type="button" aria-label="Next photo">${arrow("M9 5l7 7-7 7")}</button>` +
    `<button class="photo-viewer__arrow photo-viewer__close" type="button" aria-label="Close photo">${arrow("M6 6l12 12M18 6L6 18")}</button>`;
  document.body.append(viewer);

  let large = viewer.querySelector(".photo-viewer__image");
  let openPhoto = null;
  let closing = false;
  let switching = false;

  const thumbnailOf = (photo) => photo.querySelector("img");

  // Each photo gets a fresh image element. Reusing one and swapping its src
  // and size leaves the previous photo painted behind it in iOS Safari.
  const replaceImage = (startHidden) => {
    const image = document.createElement("img");
    image.className = "photo-viewer__image";
    if (startHidden) image.classList.add("photo-viewer__image--switching");
    large.replaceWith(image);
    large = image;
  };

  // Sizes the large image: real size, shrunk to fit the screen if needed
  const fitToScreen = (photo) => {
    const thumbnail = thumbnailOf(photo);
    const realWidth = Number(thumbnail.getAttribute("width"));
    const realHeight = Number(thumbnail.getAttribute("height"));
    // Leaves room for the arrows: beside the photo on wider screens, below it on phones
    const phone = window.innerWidth < 800;
    const side = phone ? 16 : 88;
    const vertical = phone ? 76 : 48;
    const fit = Math.min(
      1,
      (window.innerWidth - side * 2) / realWidth,
      (window.innerHeight - vertical * 2) / realHeight
    );
    large.src = thumbnail.currentSrc || thumbnail.src;
    large.alt = thumbnail.alt;
    large.style.width = `${realWidth * fit}px`;
    large.style.height = `${realHeight * fit}px`;
  };

  // Moves the large image so it sits exactly over the small one
  const coverThumbnail = (thumbnail) => {
    const from = thumbnail.getBoundingClientRect();
    const to = large.getBoundingClientRect();
    large.style.transform =
      `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`;
  };

  const isOnScreen = (element) => {
    const box = element.getBoundingClientRect();
    return box.bottom > 0 && box.top < window.innerHeight;
  };

  // Loads the photos either side, so browsing feels instant
  const preloadNeighbours = (photo) => {
    const index = photos.indexOf(photo);
    [index - 1, index + 1].forEach((i) => {
      const neighbour = photos[(i + photos.length) % photos.length];
      new Image().src = thumbnailOf(neighbour).currentSrc || thumbnailOf(neighbour).src;
    });
  };

  function open(photo) {
    replaceImage(false);
    fitToScreen(photo);
    openPhoto = photo;
    viewer.hidden = false;
    document.documentElement.classList.add("photo-viewer-open");

    if (!reducedMotion) {
      large.style.transition = "none";
      coverThumbnail(thumbnailOf(photo));
      large.getBoundingClientRect(); // apply the start position before animating
      large.style.transition = "";
    }
    photo.classList.add("photo-wall__item--open");
    requestAnimationFrame(() => {
      viewer.classList.add("photo-viewer--visible");
      large.style.transform = "";
    });
    preloadNeighbours(photo);
    viewer.focus();
  }

  // Shows the next (step 1) or previous (step -1) photo, wrapping at the ends
  function go(step) {
    if (!openPhoto || closing || switching) return;
    const index = photos.indexOf(openPhoto);
    const next = photos[(index + step + photos.length) % photos.length];
    switching = true;

    const swap = () => {
      openPhoto.classList.remove("photo-wall__item--open");
      next.classList.add("photo-wall__item--open");
      openPhoto = next;
      replaceImage(!reducedMotion);
      fitToScreen(next);
      preloadNeighbours(next);
      const image = large;
      const reveal = () => {
        image.getBoundingClientRect(); // start the fade from fully hidden
        image.classList.remove("photo-viewer__image--switching");
        switching = false;
      };
      image.decode ? image.decode().then(reveal, reveal) : reveal();
    };

    if (reducedMotion) {
      swap();
      return;
    }
    large.classList.add("photo-viewer__image--switching");
    setTimeout(swap, 150);
  }

  function close() {
    if (!openPhoto || closing) return;
    closing = true;
    const photo = openPhoto;

    const finish = () => {
      if (!closing) return;
      viewer.hidden = true;
      large.style.transition = "none";
      large.style.transform = "";
      large.classList.remove("photo-viewer__image--switching");
      large.getBoundingClientRect();
      large.style.transition = "";
      photo.classList.remove("photo-wall__item--open");
      document.documentElement.classList.remove("photo-viewer-open");
      // Focus returns to the small photo for keyboard users, without drawing the
      // focus ring at that moment (Safari ignores focusVisible, hence the class).
      // The ring comes back as soon as they press Tab or focus moves on.
      const frame = photo.querySelector(".photo-wall__frame");
      frame.classList.add("photo-wall__frame--quiet");
      frame.focus({ preventScroll: true, focusVisible: false });
      const restoreRing = (event) => {
        if (event.type === "keydown" && event.key !== "Tab") return;
        frame.classList.remove("photo-wall__frame--quiet");
        frame.removeEventListener("blur", restoreRing);
        document.removeEventListener("keydown", restoreRing, true);
      };
      frame.addEventListener("blur", restoreRing);
      document.addEventListener("keydown", restoreRing, true);
      openPhoto = null;
      closing = false;
    };

    viewer.classList.remove("photo-viewer--visible");
    if (reducedMotion) {
      finish();
      return;
    }
    // Shrink back into the small photo when it's on screen, otherwise just fade out
    if (isOnScreen(thumbnailOf(photo))) coverThumbnail(thumbnailOf(photo));
    else large.classList.add("photo-viewer__image--switching");
    setTimeout(finish, 450);
  }

  photos.forEach((photo) => {
    photo.querySelector(".photo-wall__frame").addEventListener("click", () => open(photo));
  });

  viewer.querySelector(".photo-viewer__close").addEventListener("click", (event) => {
    event.stopPropagation();
    close();
  });
  viewer.querySelector(".photo-viewer__arrow--prev").addEventListener("click", (event) => {
    event.stopPropagation();
    go(-1);
  });
  viewer.querySelector(".photo-viewer__arrow--next").addEventListener("click", (event) => {
    event.stopPropagation();
    go(1);
  });

  // Swipe left or right on touch screens; a tap still closes
  let swipeStart = null;
  let swiped = false;
  viewer.addEventListener("pointerdown", (event) => {
    swipeStart = event.pointerType === "mouse" ? null : event.clientX;
  });
  viewer.addEventListener("pointerup", (event) => {
    if (swipeStart === null) return;
    const distance = event.clientX - swipeStart;
    swipeStart = null;
    if (Math.abs(distance) > 50) {
      swiped = true;
      go(distance < 0 ? 1 : -1);
    }
  });

  viewer.addEventListener("click", () => {
    if (swiped) {
      swiped = false;
      return;
    }
    close();
  });

  document.addEventListener("keydown", (event) => {
    if (!openPhoto) return;
    if (event.key === "Escape") close();
    else if (event.key === "ArrowRight") go(1);
    else if (event.key === "ArrowLeft") go(-1);
    else return;
    event.preventDefault();
  });
})();
