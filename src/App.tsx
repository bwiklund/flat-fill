import React from "react";
import styled from "@emotion/styled";
// import lofi from "./lofi.jpg";
import lofi from "./lofi_cleaner.png";
import { flatter } from "./lib/flatter";

const Wrap = styled.div`
  color: red;
`;

export function App() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [results, setResult] = React.useState<null | ReturnType<
    typeof flatter
  >>(null);

  const [settings, setSettings] = React.useState({ showLineart: false });

  React.useEffect(() => {
    let img = new Image();
    img.onload = () => {
      setResult(flatter(img));
    };
    img.src = lofi;
  }, []);

  React.useEffect(() => {
    if (results) {
      var canvas = canvasRef.current!;
      canvas.width = results.flats.width;
      canvas.height = results.flats.height;
      var ctx = canvas.getContext("2d")!;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(results.flats, 0, 0);

      if (settings.showLineart) {
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(results.lineArt, 0, 0);
      }
    }
  }, [results, settings]);

  return (
    <Wrap>
      <canvas
        onClick={() =>
          setSettings({ ...settings, showLineart: !settings.showLineart })
        }
        ref={canvasRef}
      />
    </Wrap>
  );
}
