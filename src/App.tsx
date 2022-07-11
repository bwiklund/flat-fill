import React from "react";
import styled from "@emotion/styled";
import lofi from "./lofi.jpg";
import { flatter } from "./lib/flatter";

const Wrap = styled.div`
  color: red;
`;

export function App() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    let img = new Image();
    img.onload = () => {
      var flattened = flatter(img);
      var canvas = canvasRef.current!;
      canvas.width = flattened.width;
      canvas.height = flattened.height;
      var ctx = canvas.getContext("2d")!;
      ctx.drawImage(flattened, 0, 0);
    };
    img.src = lofi;
  }, []);

  return (
    <Wrap>
      <canvas ref={canvasRef} />
    </Wrap>
  );
}
