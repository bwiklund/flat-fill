export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function vec(x: number, y: number): Vec {
  return { x, y };
}

export function add(a: Vec, b: Vec): Vec {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}

export function sub(a: Vec, b: Vec): Vec {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

export function mult(a: Vec, n: number): Vec {
  return {
    x: a.x * n,
    y: a.y * n,
  };
}

export function mag(a: Vec): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}

export function normalize(a: Vec): Vec {
  return mult(a, 1 / mag(a));
}

export function roundVec(a: Vec): Vec {
  return { x: Math.round(a.x), y: Math.round(a.y) };
}

export function floorVec(a: Vec): Vec {
  return { x: Math.floor(a.x), y: Math.floor(a.y) };
}

export function lerpVec(a: Vec, b: Vec, n: number): Vec {
  return add(mult(a, 1 - n), mult(b, n));
}

export function moveTowardsVec(a: Vec, b: Vec, n: number): Vec {
  let diff = sub(b, a);
  let d = mag(diff);
  if (d !== 0) diff = mult(normalize(diff), Math.min(n, d));
  return add(a, diff);
}

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function multRect(r: Rect, n: number): Rect {
  return rect(r.x * n, r.y * n, r.w * n, r.h * n);
}

export function rectContaining(vecs: Vec[]): Rect {
  const xs = vecs.map(v => v.y);
  const ys = vecs.map(v => v.x);
  const t = Math.min.apply(null, xs);
  const b = Math.max.apply(null, xs);
  const l = Math.min.apply(null, ys);
  const r = Math.max.apply(null, ys);
  return { x: l, y: t, w: r - l, h: b - t };
}

export function contains(r: Rect, v: Vec): boolean {
  return v.x >= r.x && v.y >= r.y && v.x < r.x + r.w && v.y < r.y + r.h;
}

export function containsInclusive(r: Rect, v: Vec): boolean {
  return v.x >= r.x && v.y >= r.y && v.x <= r.x + r.w && v.y <= r.y + r.h;
}

export function rectsOverlapIncl(r1: Rect, r2: Rect): boolean {
  return !(
    r1.x + r1.w < r2.x ||
    r1.y + r1.h < r2.y ||
    r1.x > r2.x + r2.w ||
    r1.y > r2.y + r2.h
  );
}

export function rectsOverlapExcl(r1: Rect, r2: Rect): boolean {
  return !(
    r1.x + r1.w <= r2.x ||
    r1.y + r1.h <= r2.y ||
    r1.x >= r2.x + r2.w ||
    r1.y >= r2.y + r2.h
  );
}

export function rotate(v: Vec, radians: number): Vec {
  return {
    x: v.x * Math.cos(radians) - v.y * Math.sin(radians),
    y: v.x * Math.sin(radians) + v.y * Math.cos(radians),
  };
}
