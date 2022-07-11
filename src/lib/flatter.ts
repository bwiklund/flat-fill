import { Vec } from "./vec";
//@ts-ignore
import calcSdf from "bitmap-sdf";
import { orderBy } from "lodash";

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
  var sdfDebugImage = new ImageData(imgArr, w, h);

  // do the work, grow the pigments and merge ones that overlap without hitting lines first

  // start with the furthest pixels from lines and start filling
  // format is idx, distance
  // TODO this is probably slow and could have a more clever data layout on a native array
  var idxByDistance: [number, number][] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      idxByDistance.push([idx, distances[idx]]);
    }
  }

  var maxIdx = Math.pow(2, 32);

  var idxInOrder = orderBy(idxByDistance, (tup) => -tup[1]).map(
    (tup) => tup[0],
  );

  let idxPainting = new Uint32Array(w * h);
  for (var i = 0; i < idxInOrder.length; i++) {
    // TODO whats a clever cheap way to sample this "randomly" enough but without using memory to do it
    var idx = idxInOrder[i];

    // is reserved for unvisited idx's
    var x = idx % w;
    var y = Math.floor(idx / w);
    var anyNeighborColor = 0;
    var found = false;
    for (var ox = -1; ox <= 1; ox++) {
      for (var oy = -1; oy <= 1; oy++) {
        var xx = x + ox;
        var yy = y + oy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;

        var neighborPainted = idxPainting[yy * w + xx];
        if (neighborPainted !== 0) {
          anyNeighborColor = neighborPainted;
          found = true;
          break; // or do this in a randomized order?
        }
      }

      if (found) break;
    }

    idxPainting[idx] = found ? anyNeighborColor : Math.random() * maxIdx;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      var idx = y * w + x;
      var I = 4 * idx;
      imdata.data[I + 0] = (idxPainting[y * w + x] * 255) / maxIdx;
      imdata.data[I + 1] = (idxPainting[y * w + x] * 255) / maxIdx;
      imdata.data[I + 2] = (idxPainting[y * w + x] * 255) / maxIdx;
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
