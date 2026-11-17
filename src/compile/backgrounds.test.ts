// src/compile/backgrounds.test.ts
// Pure tests for background layer compilation: visibility, fast vs layered
// paths, per-layer image CSS, and compiled rules. No React, no DOM.
import { describe, expect, it } from 'vitest';
import { classFor } from './classFor';
import type { BackgroundLayer, Node, PageId, Project } from '../types';
import { compileStyles } from './compileStyles';
import {
  clampSlideshow,
  compileLayerRules,
  fastBackground,
  layerClass,
  layerImage,
  needsLayeredPath,
  visibleLayers,
} from './backgrounds';

const COLOR: BackgroundLayer = {
  id: 'bg-color', type: 'color', enabled: true, opacity: 1, blendMode: 'normal', color: '#ff0000',
};
const GRAD: BackgroundLayer = {
  id: 'bg-grad', type: 'gradient', enabled: true, opacity: 1, blendMode: 'normal',
  angle: 45, stops: [{ offset: 0, color: '#0000ff' }, { offset: 100, color: '#ffffff' }],
};
const HALF: BackgroundLayer = { ...COLOR, id: 'bg-half', opacity: 0.5 };
const MULTIPLY: BackgroundLayer = { ...COLOR, id: 'bg-multiply', blendMode: 'multiply' };
const DISABLED: BackgroundLayer = {
  ...COLOR, id: 'bg-disabled', type: 'image', enabled: false,
  src: 'disabled.png', size: 'cover', position: 'center', repeat: 'no-repeat',
};
const IMAGE: BackgroundLayer = {
  ...COLOR, id: 'bg-image', type: 'image', src: 'photo.jpg',
  size: 'cover', position: 'center', repeat: 'no-repeat',
};
const TINT: BackgroundLayer = {
  id: 'bg-tint', type: 'tint', enabled: true, opacity: 1, blendMode: 'normal', color: '',
};
const VIDEO: BackgroundLayer = {
  id: 'bg-video', type: 'video', enabled: true, opacity: 1, blendMode: 'normal',
  src: 'v.mp4', loop: true, muted: true, poster: 'poster.jpg',
};
const SLIDESHOW: BackgroundLayer = {
  id: 'bg-show', type: 'slideshow', enabled: true, opacity: 1, blendMode: 'normal',
  srcs: ['a.jpg', 'b.jpg'], interval: 3000,
};
const NOISE: BackgroundLayer = {
  id: 'bg-noise', type: 'noise', enabled: true, opacity: 1, blendMode: 'normal',
};

describe('visibleLayers', () => {
  it('drops layers with enabled === false', () => {
    expect(visibleLayers([COLOR, DISABLED, GRAD])).toEqual([COLOR, GRAD]);
  });

  it('keeps every enabled layer in stack order', () => {
    expect(visibleLayers([COLOR, GRAD])).toEqual([COLOR, GRAD]);
    expect(visibleLayers([])).toEqual([]);
  });
});

describe('needsLayeredPath', () => {
  it('is false for opaque, normal-blend color, gradient, image and tint layers', () => {
    expect(needsLayeredPath([COLOR, GRAD, IMAGE, TINT])).toBe(false);
  });

  it('is true when any visible layer has opacity below 1', () => {
    expect(needsLayeredPath([HALF])).toBe(true);
    expect(needsLayeredPath([COLOR, HALF])).toBe(true);
  });

  it('is true when any visible layer has a non-normal blend mode', () => {
    expect(needsLayeredPath([MULTIPLY])).toBe(true);
    expect(needsLayeredPath([COLOR, MULTIPLY])).toBe(true);
  });

  it('is true for video, slideshow and noise layers', () => {
    expect(needsLayeredPath([VIDEO])).toBe(true);
    expect(needsLayeredPath([SLIDESHOW])).toBe(true);
    expect(needsLayeredPath([NOISE])).toBe(true);
  });

  it('ignores disabled layers entirely', () => {
    expect(needsLayeredPath([DISABLED, COLOR])).toBe(false);
    expect(needsLayeredPath([DISABLED, HALF])).toBe(true);
    expect(needsLayeredPath([DISABLED])).toBe(false);
  });
});

describe('layerImage', () => {
  it('renders a color layer as linear-gradient(C, C)', () => {
    expect(layerImage(COLOR)).toBe('linear-gradient(#ff0000, #ff0000)');
  });

  it('renders a tint layer with the default rgba when color is empty', () => {
    expect(layerImage(TINT)).toBe("linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4))");
  });

  it('renders a gradient layer as linear-gradient(Ndeg, color offset%...)', () => {
    expect(layerImage(GRAD)).toBe('linear-gradient(45deg, #0000ff 0%, #ffffff 100%)');
  });

  it('renders an image layer as a quoted url', () => {
    expect(layerImage(IMAGE)).toBe('url("photo.jpg")');
    expect(layerImage(DISABLED)).toBe('url("disabled.png")');
  });

  it('renders a video layer as its poster url', () => {
    expect(layerImage(VIDEO)).toBe('url("poster.jpg")');
  });

  it('renders a slideshow layer as its first src', () => {
    expect(layerImage(SLIDESHOW)).toBe('url("a.jpg")');
  });

  it('renders a noise layer as an inline SVG feTurbulence data URI', () => {
    const img = layerImage(NOISE);
    expect(img).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(img).toMatch(/"\)$/);
    expect(img).toContain('feTurbulence');
    expect(img).toContain('baseFrequency');
    expect(img).toContain('0.8');
    expect(img).toContain('numOctaves');
    expect(img).toContain('2');
  });
});

describe('fastBackground', () => {
  it('joins visible layers top-first into one background list', () => {
    expect(fastBackground([COLOR, GRAD])).toBe(
      'linear-gradient(#ff0000, #ff0000), linear-gradient(45deg, #0000ff 0%, #ffffff 100%)',
    );
    // top-first: reversing the stack changes the output
    expect(fastBackground([GRAD, COLOR])).not.toBe(fastBackground([COLOR, GRAD]));
  });

  it('appends size/position/repeat for image layers only', () => {
    expect(fastBackground([IMAGE])).toBe('url("photo.jpg") center/cover no-repeat');
    expect(fastBackground([COLOR])).toBe('linear-gradient(#ff0000, #ff0000)');
  });

  it('drops disabled layers', () => {
    expect(fastBackground([COLOR, DISABLED, GRAD])).toBe(fastBackground([COLOR, GRAD]));
    expect(fastBackground([DISABLED])).toBe('');
  });
});

describe('layerClass', () => {
  it('is r-bgl- plus the same hash helper classFor uses', () => {
    expect(layerClass(COLOR)).toBe(`r-bgl-${classFor('bg-color').slice(2)}`);
    expect(layerClass(COLOR)).toMatch(/^r-bgl-[a-f0-9]{6,}$/);
  });

  it('differs from the element class (r-bgl- vs r-)', () => {
    expect(layerClass(COLOR)).not.toBe(classFor('bg-color'));
  });
});

describe('compileLayerRules', () => {
  it('emits one rule per visible layer: absolute fill with the layer image', () => {
    const out = compileLayerRules([COLOR, GRAD]);
    expect(out.split('\n')).toHaveLength(2);
    const cls = layerClass(COLOR);
    expect(out).toContain(`.${cls}{position:absolute;inset:0;background:linear-gradient(#ff0000, #ff0000)}`);
  });

  it('omits opacity at 1 and mix-blend-mode at normal', () => {
    const out = compileLayerRules([COLOR]);
    expect(out).not.toContain('opacity');
    expect(out).not.toContain('mix-blend-mode');
  });

  it('emits opacity below 1 and non-normal blend modes', () => {
    const out = compileLayerRules([HALF, MULTIPLY]);
    expect(out).toContain('opacity:0.5');
    expect(out).toContain('mix-blend-mode:multiply');
    expect(out).not.toContain('opacity:1');
  });

  it('drops disabled layers', () => {
    expect(compileLayerRules([COLOR, DISABLED])).toBe(compileLayerRules([COLOR]));
  });
});

function pageWithLayers(layers: BackgroundLayer[]): Node {
  return {
    id: 'page-1', type: 'page', parentId: null, children: [], styles: {}, hidden: {}, locked: false,
    title: 'Home', slug: 'home', backgroundLayers: layers,
  };
}

function cssFor(layers: BackgroundLayer[]): string {
  const page = pageWithLayers(layers);
  const project: Project = {
    id: 'proj-1', name: 'Roux Studio',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    pages: [{ id: 'pg-1', title: 'Home', slug: 'home', rootId: 'page-1' }],
    tokens: { byName: {} },
    blocks: [],
    globalHeaderId: null,
    globalFooterId: null,
  };
  return compileStyles(project, 'pg-1' as PageId, { [page.id]: page });
}

describe('image blur and brightness (layered path)', () => {
  const BLURRED: BackgroundLayer = { ...IMAGE, id: 'bg-blur', blur: 10 };

  it('needsLayeredPath is true for blur > 0 or brightness !== 1', () => {
    expect(needsLayeredPath([{ ...IMAGE, blur: 4 }])).toBe(true);
    expect(needsLayeredPath([{ ...IMAGE, brightness: 1.2 }])).toBe(true);
    expect(needsLayeredPath([IMAGE])).toBe(false);
    expect(needsLayeredPath([{ ...IMAGE, blur: 0 }])).toBe(false);
  });

  it('blur 10 adds filter:blur(10px) and inset:-20px so edges stay sharp', () => {
    const out = compileLayerRules([BLURRED]);
    const cls = layerClass(BLURRED);
    expect(out).toContain(`.${cls}{position:absolute;inset:-20px;`);
    expect(out).toContain('filter:blur(10px)');
    expect(out).not.toContain('inset:0');
  });

  it('brightness joins blur in the same filter', () => {
    const out = compileLayerRules([{ ...IMAGE, id: 'bg-bri', blur: 3, brightness: 1.2 }]);
    expect(out).toContain('filter:blur(3px)brightness(1.2)');
  });
});

describe('noise opacity and scale', () => {
  it('multiplies opacity by intensity', () => {
    const layer: BackgroundLayer = { ...NOISE, id: 'bg-noise-2', intensity: 0.5 };
    const out = compileLayerRules([layer]);
    const cls = layerClass(layer);
    expect(out).toContain(`.${cls}`);
    expect(out).toContain('opacity:0.5');
  });

  it('defaults intensity to 0.15', () => {
    const out = compileLayerRules([NOISE]);
    expect(out).toContain('opacity:0.15');
  });

  it('scale drives the noise baseFrequency', () => {
    expect(layerImage({ ...NOISE, scale: 0.3 })).toContain('baseFrequency%3D%220.3%22');
    expect(layerImage(NOISE)).toContain('baseFrequency%3D%220.8%22');
  });
});

describe('clampSlideshow', () => {
  it('clamps interval to >= 2000 and transition to [200, interval/2]', () => {
    expect(clampSlideshow({ ...SLIDESHOW, interval: 500, transition: 5000 })).toEqual({
      interval: 2000,
      transition: 1000,
    });
    expect(clampSlideshow({ ...SLIDESHOW, interval: 10000, transition: 100 })).toEqual({
      interval: 10000,
      transition: 200,
    });
    expect(clampSlideshow({ ...SLIDESHOW, interval: 10000 })).toEqual({
      interval: 10000,
      transition: 600,
    });
  });
});

describe('compileStyles integration', () => {
  it('emits one background list, top first, for color + gradient at opacity 1', () => {
    const out = cssFor([COLOR, GRAD]);
    expect(out).toContain(
      'background: linear-gradient(#ff0000, #ff0000), linear-gradient(45deg, #0000ff 0%, #ffffff 100%);',
    );
    // fast path: no per-layer rules (the shared .r-bg wrapper rule is
    // emitted by compileBaseStyles and is not per-layer)
    expect(out).not.toContain('r-bgl-');
  });

  it('emits the shared .r-bg rule exactly once', () => {
    const out = cssFor([COLOR]);
    expect(out.split('.r-bg{')).toHaveLength(2);
  });

  it('takes the layered path for a layer below opacity 1', () => {
    const out = cssFor([HALF]);
    const cls = classFor('page-1');
    expect(out).toMatch(new RegExp(`\\.${cls}\\s*\\{[^}]*position: relative;[^}]*isolation: isolate;`));
    const bgl = layerClass(HALF);
    expect(out).toContain(
      `.${bgl}{position:absolute;inset:0;background:linear-gradient(#ff0000, #ff0000);opacity:0.5}`,
    );
  });

  it('keeps a disabled layer out of the compiled CSS', () => {
    const out = cssFor([COLOR, DISABLED, GRAD]);
    expect(out).not.toContain('disabled.png');
    expect(out).not.toContain(layerClass(DISABLED));
    expect(out).toContain('linear-gradient(#ff0000, #ff0000)');
    expect(out).toContain('linear-gradient(45deg, #0000ff 0%, #ffffff 100%)');
  });
});
