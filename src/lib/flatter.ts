import { times } from "lodash";
import { vec, Vec } from "./vec";

interface Pigment {
  pos: Vec;
  size: number;
  color: string;
}

// strategy:
// turn the image into a signed distance field, where it's distance to the nearest line color pixel (just do a threshold? or do a low pass filter on the image first to normalize values for weirdly lit stuff like a picture of paper)
// do this:
// pick a random empty pixel. git it a new unused color index, and then follow that point towards the nearest line using the SDF.
// once you reach the lineart color, stop.
// if you hit a pixel that's already been colored in, stop, and change all your pixels to that color. OR, if this gives bad results, leave it as is, then merge the colors in another more tunable pass

export function flatter(img: HTMLImageElement) {
  let canvas = document.createElement("canvas");
  let w = (canvas.width = img.width);
  let h = (canvas.height = img.height);
  let ctx = canvas.getContext("2d")!;

  ctx.drawImage(img, 0, 0);
  let imdata = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // do the work, grow the pigments and merge ones that overlap without hitting lines first

  for (var i = 0; i < w * h; i++) {
    // TODO whats a clever cheap way to sample this "randomly" enough but without using memory to do it
    var idx = i;
    var I = 4 * idx;
    var x = idx % w;
    var y = Math.floor(idx / w);
    imdata.data[I + 0] = Math.random() * 255;
    imdata.data[I + 1] = Math.random() * 255;
    imdata.data[I + 2] = Math.random() * 255;
    imdata.data[I + 3] = 255;
  }

  ctx.putImageData(imdata, 0, 0);

  // draw the flatted version. actually return both canvases so the user can toggle it
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(img, 0, 0);

  return canvas;
}
