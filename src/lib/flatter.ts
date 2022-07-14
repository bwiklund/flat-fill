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
  let radius = Math.sqrt(img.width * img.width + img.height * img.height) / 2;
  let gapSizePixels = 2.5;
  let gapSize01 = gapSizePixels / radius;

  let start = performance.now();
  let lap = start;

  function doLap(str: string) {
    let t2 = performance.now();
    console.log(str + " " + (t2 - lap));
    lap = t2;
  }

  let lineartCanvasOriginal = document.createElement("canvas");
  let w = (lineartCanvasOriginal.width = img.width);
  let h = (lineartCanvasOriginal.height = img.height);
  lineartCanvasOriginal.getContext("2d")!.drawImage(img, 0, 0);

  let lineartCanvas = document.createElement("canvas");
  lineartCanvas.width = img.width;
  lineartCanvas.height = img.height;
  lineartCanvas.getContext("2d")!.drawImage(img, 0, 0);
  threshold(lineartCanvas, w, h, 128, false);

  let inverseLineArtCanvas = document.createElement("canvas");
  inverseLineArtCanvas.width = img.width;
  inverseLineArtCanvas.height = img.height;
  inverseLineArtCanvas.getContext("2d")!.drawImage(img, 0, 0);
  threshold(inverseLineArtCanvas, w, h, 128, true);

  doLap("create canvases");

  let distances = calcSdf(lineartCanvas, { cutoff: 1, radius });

  doLap("calculate SDF");

  var idxInOrder = getSortedPixels(distances);

  // memorize times that clumps of pixels meet that should be the same color,
  // so we can merge them efficiently at the very end, instead of having to keep bucket filling them as we go
  let remap: Record<number, number> = {};

  let idxPainting = new Uint32Array(w * h);
  let nextColorIdx = 1;

  // doing this like so to avoid allocating a LOT of little arrays
  let foundNeighbors = new Uint32Array(9);
  for (let i = 0; i < idxInOrder.length; i++) {
    let { idx, dist } = idxInOrder[i];

    if (dist < gapSize01) {
      continue; //leave it empty, we'll trim out the lineart gaps last
    }

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

    let isntUnderGapThreshold = dist > gapSize01;
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

  let gapCanvas = getGapCanvas(idxPainting, w, h);
  let distancesInverse = calcSdf(gapCanvas, {
    cutoff: 1,
    radius,
  });
  var idxInOrderInv = getSortedPixels(distancesInverse).reverse();

  for (let i = 0; i < idxInOrderInv.length; i++) {
    let { idx, dist } = idxInOrderInv[i];

    // if (dist < gapSize01) {
    //   continue; //leave it empty, we'll trim out the lineart gaps last
    // }
    if (dist <= 0) {
      continue; //leave it empty, we'll trim out the lineart gaps last
    }

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

    let isntUnderGapThreshold = dist > gapSize01;
    let largestIdx = 0;
    for (let ni = 0; ni < foundNeightborCount; ni++) {
      largestIdx = Math.max(largestIdx, foundNeighbors[ni]);
    }
    if (foundNeightborCount >= 2 && isntUnderGapThreshold) {
      for (let ni = 0; ni < foundNeightborCount; ni++) {
        // by always mapping to a larger idx we can traverse this more efficiently later
        // if (neightborIdx !== largestIdx) idxRemap[neightborIdx] = largestIdx;
        // mapColorTo(foundNeighbors[ni], largestIdx);
      }
    }

    // this works for pixels that happen to start next to each other, but we also need a mapping of same colors for groups that collide
    idxPainting[idx] = largestIdx;
    // idxPainting[idx] = found ? anyNeighborColor : i * maxIdx / idxInOrder.length;
  }

  doLap("traverse all pixels");

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

  // ok so an untapped benefit of this method is that, because of the SDF, you know what the largest (well, widest) portion of any color is. so you can use that to modify the gap tolerance. big areas can allow larger gap closing, while small ones tolerate less.

  let flatCanvas = document.createElement("canvas");
  flatCanvas.width = img.width;
  flatCanvas.height = img.height;
  let flatCtx = flatCanvas.getContext("2d")!;
  let flatImgData = flatCtx.getImageData(
    0,
    0,
    flatCanvas.width,
    flatCanvas.height,
  );

  let finalColorsUsed: Record<number, true> = {};
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let idx = y * w + x;
      let I = 4 * idx;
      // let paintIdx = idxPainting[y * w + x];
      let paintIdx = getFinalColorIdx(idxPainting[y * w + x]);
      finalColorsUsed[paintIdx] = true;
      flatImgData.data[I + 0] = ~~(rand(paintIdx + 0.1) * 100 + 155);
      flatImgData.data[I + 1] = ~~(rand(paintIdx + 0.11) * 100 + 155);
      flatImgData.data[I + 2] = ~~(rand(paintIdx + 0.111) * 100 + 155);
      flatImgData.data[I + 3] = 255;
    }
  }
  flatCtx.putImageData(flatImgData, 0, 0);

  doLap("chase down idx remaps and draw image");

  // ctx.putImageData(sdfDebugImage, 0, 0);

  console.log("done in " + (performance.now() - start) + " total");
  console.log(
    "final flats layer contains unique colors: " +
      Object.keys(finalColorsUsed).length,
  );

  return { flats: flatCanvas, lineArt: lineartCanvasOriginal };
}

function threshold(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  threshold: number,
  flip: boolean,
) {
  let invCtx = canvas.getContext("2d")!;
  let invData = invCtx.getImageData(0, 0, canvas.width, canvas.height);
  var data = invData.data;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      var I = 4 * (j * w + i);
      var thresh = data[I]; // red good enough
      // eslint-disable-next-line
      var isThresh = thresh > threshold !== flip;
      data[I + 0] = isThresh ? 255 : 0;
      data[I + 1] = isThresh ? 255 : 0;
      data[I + 2] = isThresh ? 255 : 0;
      data[I + 3] = 255;
    }
  }
  invCtx.putImageData(invData, 0, 0);
}

// turn our colored in image into an image with the lines as white so we can close gaps. kinda wasteful atm
function getGapCanvas(
  arr: Uint32Array,
  w: number,
  h: number,
): HTMLCanvasElement {
  let canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  let ctx = canvas.getContext("2d")!;
  let id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = id.data;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      var idx = j * w + i;
      var I = 4 * idx;
      // eslint-disable-next-line
      var isGap = arr[idx] == 0;
      data[I + 0] = isGap ? 255 : 0;
      data[I + 1] = isGap ? 255 : 0;
      data[I + 2] = isGap ? 255 : 0;
      data[I + 3] = 255;
    }
  }
  ctx.putImageData(id, 0, 0);

  return canvas;
}

function getSortedPixels(distances: any) {
  let start = performance.now();
  let lap = start;

  function doLap(str: string) {
    let t2 = performance.now();
    console.log(str + " " + (t2 - lap));
    lap = t2;
  }

  let idxByDistance: { idx: number; dist: number }[] = [];
  for (let idx = 0; idx < distances.length; idx++) {
    idxByDistance.push({ idx, dist: distances[idx] });
  }

  doLap("gather pixels");

  // the native, in place method is about 2x speedup, and this is the slowest part of the algo atm
  // let idxInOrder = orderBy(idxByDistance, (tup) => -tup.dist);
  let idxInOrder = idxByDistance.sort((a, b) =>
    a.dist < b.dist ? 1 : a.dist > b.dist ? -1 : 0,
  );
  doLap("sort pixels by SDF distance");

  return idxInOrder;
}
