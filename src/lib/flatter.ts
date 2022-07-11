//@ts-ignore
import calcSdf from "bitmap-sdf";
import { rand } from "./mutil";

// strategy:
// turn the image into a signed distance field, where it's distance to the nearest line color pixel (just do a threshold? or do a low pass filter on the image first to normalize values for weirdly lit stuff like a picture of paper)
// do this:
// pick a random empty pixel. git it a new unused color index, and then follow that point towards the nearest line using the SDF.
// once you reach the lineart color, stop.
// if you hit a pixel that's already been colored in, stop, and change all your pixels to that color. OR, if this gives bad results, leave it as is, then merge the colors in another more tunable pass

export function flatter(img: HTMLImageElement) {
  let start = performance.now();
  let lap = start;

  function doLap(str: string) {
    let t2 = performance.now();
    console.log(str + " " + (t2 - lap));
    lap = t2;
  }

  let canvas = document.createElement("canvas");
  let w = (canvas.width = img.width);
  let h = (canvas.height = img.height);
  let ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  let imdata = ctx.getImageData(0, 0, canvas.width, canvas.height);

  doLap("create canvas");

  let radius = 100;
  let distances = calcSdf(canvas, { cutoff: 1, radius });

  doLap("calculate SDF");

  //show distances
  // let imgArr = new Uint8ClampedArray(w * h * 4);
  // for (let j = 0; j < h; j++) {
  //   for (let i = 0; i < w; i++) {
  //     imgArr[j * w * 4 + i * 4 + 0] = distances[j * w + i] * 255;
  //     imgArr[j * w * 4 + i * 4 + 1] = distances[j * w + i] * 255;
  //     imgArr[j * w * 4 + i * 4 + 2] = distances[j * w + i] * 255;
  //     imgArr[j * w * 4 + i * 4 + 3] = 255;
  //   }
  // }
  // let sdfDebugImage = new ImageData(imgArr, w, h);

  // do the work, grow the pigments and merge ones that overlap without hitting lines first

  // start with the furthest pixels from lines and start filling
  // format is idx, distance
  // TODO this is probably slow and could have a more clever data layout on a native array
  let idxByDistance: { idx: number; dist: number }[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      idxByDistance.push({ idx, dist: distances[idx] });
    }
  }

  doLap("gather pixels");

  // the native, in place method is about 2x speedup, and this is the slowest part of the algo atm
  // let idxInOrder = orderBy(idxByDistance, (tup) => -tup.dist);
  let idxInOrder = idxByDistance.sort((a, b) =>
    a.dist < b.dist ? 1 : a.dist > b.dist ? -1 : 0,
  );

  doLap("sort pixels by SDF distance");

  // memorize times that clumps of pixels meet that should be the same color,
  // so we can merge them efficiently at the very end, instead of having to keep bucket filling them as we go
  let remap: Record<number, number> = {};

  let idxPainting = new Uint32Array(w * h);
  let nextColorIdx = 1;

  // doing this like so to avoid allocating a LOT of little arrays
  let foundNeighbors = new Uint32Array(9);
  for (let i = 0; i < idxInOrder.length; i++) {
    let { idx, dist } = idxInOrder[i];

    let x = idx % w;
    let y = ~~(idx / w);

    let foundNeightborCount = 0;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        let xx = x + ox;
        let yy = y + oy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;

        let neighborPainted = idxPainting[yy * w + xx];
        if (neighborPainted !== 0) {
          foundNeighbors[foundNeightborCount++] = neighborPainted;
        }
      }
    }

    let gapSizePixels = 2;
    let gapSize = gapSizePixels / radius;
    let isntUnderGapThreshold = dist > gapSize;
    let largestIdx = 0;
    for (let ni = 0; ni < foundNeightborCount; ni++) {
      largestIdx = Math.max(largestIdx, foundNeighbors[ni]);
    }
    if (foundNeightborCount >= 2 && isntUnderGapThreshold) {
      for (let ni = 0; ni < foundNeightborCount; ni++) {
        // by always mapping to a larger idx we can traverse this more efficiently later
        // if (neightborIdx !== largestIdx) idxRemap[neightborIdx] = largestIdx;
        mapColorTo(foundNeighbors[ni], largestIdx);
      }
    }

    // this works for pixels that happen to start next to each other, but we also need a mapping of same colors for groups that collide
    idxPainting[idx] = foundNeightborCount > 0 ? largestIdx : nextColorIdx++;
    // idxPainting[idx] = found ? anyNeighborColor : i * maxIdx / idxInOrder.length;
  }

  doLap("traverse all pixels");

  // let finalColorLookup = times(nextColorIdx).map((n) => n + 1);
  // for (let set of sameColorSets) {
  //   let c = set[0];
  //   for (let idx of set) {
  //     c = set[idx];
  //   }
  // }

  console.log("remap needed #: " + Object.keys(remap).length);

  // this is tricky, because order can be weird. if we say a color is remapped, we gotta also traverse this data structure to the farthest leaf it's ALREADY possibly been remapped to, or island will not meet correctly all the time
  function mapColorTo(from: number, to: number) {
    if (from === to) return;
    remap[getFinalColorIdx(from)] = getFinalColorIdx(to);
  }

  // we have to recursively look through the replacement idx thing so this memoizes it
  // let finalLookup: Record<number, number> = {};
  function getFinalColorIdx(idx: number): number {
    if (!remap[idx]) return idx;
    if (remap[idx] === idx) return idx;

    return getFinalColorIdx(remap[idx]);
  }

  // let finalIdxToRealColor: Record<number, number> = [];
  // for (let y = 0; y < h; y++) {
  //   for (let x = 0; x < w; x++) {
  //     let paintIdx = getFinalColorIdx(idxPainting[y * w + x]);
  //     finalIdxToRealColor[paintIdx] = Math.max(
  //       finalIdxToRealColor[paintIdx] || 0,
  //       Math.sqrt(1 - mag(vec(x - w / 2, y)) / (w + h)),
  //     );
  //   }
  // }

  // ok so an untapped benefit of this method is that, because of the SDF, you know what the largest (well, widest) portion of any color is. so you can use that to modify the gap tolerance. big areas can allow larger gap closing, while small ones tolerate less.
  //

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let idx = y * w + x;
      let I = 4 * idx;
      // let paintIdx = idxPainting[y * w + x];
      let paintIdx = getFinalColorIdx(idxPainting[y * w + x]);
      imdata.data[I + 0] = ~~(rand(paintIdx + 0.1) * 100 + 155);
      imdata.data[I + 1] = ~~(rand(paintIdx + 0.11) * 100 + 155);
      imdata.data[I + 2] = ~~(rand(paintIdx + 0.111) * 100 + 155);
      // imdata.data[I + 0] = (paintIdx / nextColorIdx) * 255;
      // imdata.data[I + 1] = (paintIdx / nextColorIdx) * 255;
      // imdata.data[I + 2] = (paintIdx / nextColorIdx) * 255;

      // let clr = finalIdxToRealColor[paintIdx];
      // imdata.data[I + 0] = clr * 255;
      // imdata.data[I + 1] = clr * 255;
      // imdata.data[I + 2] = clr * 255;
      // imdata.data[I + 3] = 255;
    }
  }

  ctx.putImageData(imdata, 0, 0);

  doLap("chase down idx remaps and draw image");

  // ctx.putImageData(sdfDebugImage, 0, 0);

  // draw the flatted version. actually return both canvases so the user can toggle it
  ctx.globalCompositeOperation = "multiply";
  // ctx.drawImage(img, 0, 0);

  console.log("done in " + (performance.now() - start) + " total");

  return canvas;
}
