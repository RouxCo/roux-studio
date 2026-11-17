// src/export/runtime.ts
// Roux Studio — tree-shaken vanilla JS runtime source (spec §9.3).
//
// `runtimeSource(modules)` returns `null` when `modules` is empty (tree-shake
// everything away), otherwise a vanilla ES2019+ source string implementing
// only the requested modules. Each module is a small, self-contained block.
// The gzipped output must stay under 8 KB (spec §9.3 hard limit).
//
// Modules:
//   'animations' — IntersectionObserver scroll-in that adds `.is-in` to
//     elements marked with `data-animate`, unobserving after first trigger.
//   'video-lazy-load' — click-to-play poster facade for video layers: lazy
//     `src` within 200% of the viewport, pause offscreen.

const animationsSource = `
const obs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-in');
      obs.unobserve(entry.target);
    }
  });
});
document.querySelectorAll('[data-animate]').forEach((el) => obs.observe(el));
`;

const videoLazyLoadSource = `
const videos = document.querySelectorAll('video[data-src]');
const loadIfNear = () => {
  const limit = window.innerHeight * 2;
  videos.forEach((video) => {
    const rect = video.getBoundingClientRect();
    const near = rect.top < limit && rect.bottom > -limit;
    if (near && !video.src) {
      const src = video.getAttribute('data-src');
      if (src) { video.src = src; video.load(); }
    }
    if (!near && video.src && video.paused === false) video.pause();
  });
};
window.addEventListener('scroll', loadIfNear, { passive: true });
window.addEventListener('load', loadIfNear, { once: true });
videos.forEach((video) => {
  video.addEventListener('click', () => {
    if (video.paused) video.play();
  });
});
loadIfNear();
`;

const MODULES: Record<string, string> = {
  animations: animationsSource,
  'video-lazy-load': videoLazyLoadSource,
};

export function runtimeSource(modules: Set<string>): string | null {
  if (modules.size === 0) return null;

  const parts: string[] = [];
  for (const module of modules) {
    const source = MODULES[module];
    if (source) parts.push(source);
  }

  if (parts.length === 0) return null;
  return parts.join('\n').trim() + '\n';
}
