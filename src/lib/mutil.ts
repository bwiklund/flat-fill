/** It's clamp! */
export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(n, min));
}

/** Modulo the way it's actually supposed to work, excluding negative numbers */
export function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

/** Quantize a number to a given step size. */
export function quantize(n: number, stepSize: number) {
  return Math.floor(n / stepSize) * stepSize;
}

/** Serviceable, cheap 1d noise function, 0.0 to 1.0 */
export function rand(n: number) {
  return mod(Math.sin(n * 12.9898) * 43758.5453, 1);
}

/** Parabola from 0,0 to 0.5,1 to 1,0. For bunny hops. */
export function parabola(x: number) {
  return -4 * x * x + 4 * x + 0;
}

/** Triangle wave generator. 1hz, -1 to 1. */
export function triangleWave(t: number) {
  const mt = mod(t, 1);
  return mt < 0.5 ? -1 + mt * 4 : 3 - mt * 4;
}

/** Saw wave generator. 1hz, -1 to 1. */
export function sawWave(t: number) {
  const mt = mod(t, 1);
  return 2 * (mt - 0.5);
}

/** Lerp, unclamped */
export function lerp(a: number, b: number, i: number) {
  return a * (1 - i) + b * i;
}

export function remap(
  value: number,
  low1: number,
  high1: number,
  low2: number,
  high2: number,
) {
  return low2 + ((value - low1) * (high2 - low2)) / (high1 - low1);
}

/** Get a random array element using builtin `Math.random` */
export function randEl<T>(arr: Array<T>): T {
  return arr[Math.round(Math.random() * arr.length)];
}

/** Given probability of event per second, and deltaTime, sample to see if (at least!!! could be more!) one event happens in a time span?
 * @param {number} probabilityPerSecond - likelyhood of an event per unit time, 0.0 - 1.0.
 * @param {number} timeSpan - Length of time we're testing against. Typically deltaTime.
 */
export function randTime(
  probabilityPerSecond: number,
  timeSpan: number,
): boolean {
  return Math.random() > Math.pow(1 - probabilityPerSecond, timeSpan);
}

/** Do our darndest to create an AudioContext on desktop and ios safari */
export function makeAudioContext(): AudioContext | undefined {
  try {
    return new ((window as any).AudioContext ||
      (window as any).webkitAudioContext)();
  } catch {
    return;
  }
}

/** Read an image and count all the colors. */
export function getPalette(imgData: ImageData): { [s: string]: number } {
  let colors: { [s: string]: number } = {};
  let data = imgData.data;
  for (let I = 0; I < data.length; I += 4) {
    let hex = (
      (data[I + 3] << 24) |
      (data[I] << 16) |
      (data[I + 1] << 8) |
      data[I + 2]
    ).toString(16);
    if (!colors[hex]) {
      colors[hex] = 0;
    }
    colors[hex]++;
  }
  return colors;
}

/**
 * Size the canvas to fit with letterboxing on top or bottom to maintain aspect ratio.
 * css solutions for this kind of suck and have issues. this is working alonside pos rel and
 * some centering styles in the css sheet.
 **/
export function sizeToFitParentWithAspectRatio(
  el: HTMLCanvasElement,
  aspectRatio: number,
) {
  let parentSize = el.parentElement!.getBoundingClientRect();
  let w = parentSize.width;
  let h = parentSize.height;
  let elW = Math.min(w, h * aspectRatio);
  let elH = Math.min(h, w / aspectRatio);

  // // snap TODO make optional
  // let nativeH = 360;
  // elH = Math.floor(elH / nativeH) * nativeH;
  // elW = elH * aspectRatio;

  // elW = 480 * 3;
  // elH = 270 * 3;

  el.style.width = elW + "px";
  el.style.height = elH + "px";
}

export function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function strToSeed(str: string): number {
  return rand(+("0x" + cyrb53(str)));
}

// get the largest whole number scale multiplier that will result in a render target >= than this minX/minY.
// basically, this gives us good (evenly sized) screen pixels while guaranteeing a reasonable render target size.
export function getMinResolutionMultiplier(
  minX: number,
  minY: number,
  windowX: number,
  windowY: number,
) {
  return Math.max(1, Math.floor(Math.min(windowX / minX, windowY / minY)));
}

/** returns amplitude, for audio. */
export function dbToLin(n: number) {
  return Math.pow(10, n / 20);
}
