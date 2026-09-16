import { ImageResponse } from "next/og";

export const alt = "Build site. A portfolio under construction.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(180deg, #0d1b2e 0%, #071120 100%)",
          color: "#f1ece3",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#9aa6b8" }}>
          <span>Efe Ebomwonyi</span>
          <span>Design engineer</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 200, fontWeight: 800, lineHeight: 0.85, letterSpacing: -6 }}>
            BUILD SITE
          </div>
          <div style={{ marginTop: 28, fontSize: 34, color: "#f5b043" }}>
            A portfolio under construction.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
