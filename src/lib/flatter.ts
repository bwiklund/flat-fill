export function flatter(img: HTMLImageElement) {
  var canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  var ctx = canvas.getContext("2d")!;

  ctx.drawImage(img, 0, 0);
  var id = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // do the work

  // draw the flatted version. actually return both canvases so the user can toggle it
  ctx.drawImage(img, 0, 0);

  return canvas;
}
