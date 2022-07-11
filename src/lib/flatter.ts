import { times } from "lodash";
import { vec, Vec } from "./vec";

interface Pigment {
  pos: Vec;
  size: number;
  color: string;
}

export function flatter(img: HTMLImageElement) {
  let canvas = document.createElement("canvas");
  let w = (canvas.width = img.width);
  let h = (canvas.height = img.height);
  let ctx = canvas.getContext("2d")!;

  ctx.drawImage(img, 0, 0);
  let id = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const pigToPixel = 0.01;
  const pigments = times(canvas.width * canvas.height * pigToPixel).map(() => ({
    color: `rgb(${~~(100 + 150 * Math.random())}, ${~~(
      100 +
      150 * Math.random()
    )}, ${~~(100 + 150 * Math.random())})`,
    pos: vec(w * Math.random(), h * Math.random()),
    size: 10,
  }));

  // do the work, grow the pigments and merge ones that overlap without hitting lines first

  for (var p of pigments) {
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  // draw the flatted version. actually return both canvases so the user can toggle it
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(img, 0, 0);

  return canvas;
}
