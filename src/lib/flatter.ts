import { Vec } from "./vec";
//@ts-ignore
import calcSdf from "bitmap-sdf";
import { orderBy, times } from "lodash";
import { rand } from "./mutil";

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

  //calculate distances
  let distances = calcSdf(canvas, { cutoff: 1, radius: 100 });

  //show distances
  let imgArr = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      imgArr[j * w * 4 + i * 4 + 0] = distances[j * w + i] * 255;
      imgArr[j * w * 4 + i * 4 + 1] = distances[j * w + i] * 255;
      imgArr[j * w * 4 + i * 4 + 2] = distances[j * w + i] * 255;
      imgArr[j * w * 4 + i * 4 + 3] = 255;
    }
  }
  let sdfDebugImage = new ImageData(imgArr, w, h);

  // do the work, grow the pigments and merge ones that overlap without hitting lines first

  // start with the furthest pixels from lines and start filling
  // format is idx, distance
  // TODO this is probably slow and could have a more clever data layout on a native array
  let idxByDistance: [number, number][] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      idxByDistance.push([idx, distances[idx]]);
    }
  }

  let maxIdx = Math.pow(2, 32);

  let idxInOrder = orderBy(idxByDistance, (tup) => -tup[1]);

  // memorize times that clumps of pixels meet that should be the same color,
  // so we can merge them efficiently at the very end, instead of having to keep bucket filling them as we go
  let sameColorSets: number[][] = [];

  let idxPainting = new Uint32Array(w * h);
  let nextColorIdx = 1;

  for (var i = 0; i < idxInOrder.length; i++) {
    let [idx, dist] = idxInOrder[i];

    let x = idx % w;
    let y = ~~(idx / w);
    let foundNeighbors: number[] = [];

    let rad = 1;
    for (var ox = -rad; ox <= rad; ox++) {
      for (var oy = -rad; oy <= rad; oy++) {
        let xx = x + ox;
        let yy = y + oy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;

        let neighborPainted = idxPainting[yy * w + xx];
        if (neighborPainted !== 0) {
          foundNeighbors.push(neighborPainted);
        }
      }
    }

    let gapSize = 5;
    var isntUnderGapThreshold = dist > gapSize;
    if (foundNeighbors.length >= 2 && isntUnderGapThreshold) {
      sameColorSets.push(foundNeighbors);
    }

    // this works for pixels that happen to start next to each other, but we also need a mapping of same colors for groups that collide
    idxPainting[idx] =
      foundNeighbors.length > 0 ? foundNeighbors[0] : nextColorIdx++;
    // idxPainting[idx] = found ? anyNeighborColor : i * maxIdx / idxInOrder.length;
  }

  // let finalColorLookup = times(nextColorIdx).map((n) => n + 1);
  // for (let set of sameColorSets) {
  //   var c = set[0];
  //   for (let idx of set) {
  //     c = set[idx];
  //   }
  // }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let idx = y * w + x;
      let I = 4 * idx;
      let paintIdx = idxPainting[y * w + x];
      // paintIdx = idxRemap[paintIdx] || paintIdx;
      imdata.data[I + 0] = rand(paintIdx + 0.1) * 127 + 127;
      imdata.data[I + 1] = rand(paintIdx + 0.2) * 127 + 127;
      imdata.data[I + 2] = rand(paintIdx + 0.3) * 127 + 127;
      imdata.data[I + 3] = 255;
    }
  }

  ctx.putImageData(imdata, 0, 0);
  // ctx.putImageData(sdfDebugImage, 0, 0);

  // draw the flatted version. actually return both canvases so the user can toggle it
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(img, 0, 0);

  return canvas;
}
