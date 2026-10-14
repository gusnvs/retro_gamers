"use client";

import { useEffect, useRef } from "react";

export default function GLCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    import("@/gl/stage").then(({ initStage }) => {
      if (!cancelled && ref.current) initStage(ref.current);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return <canvas id="gl-stage" ref={ref} aria-hidden="true" />;
}
