import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1120 0%, #162032 100%)",
          borderRadius: 112,
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 88,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
            color: "#ffffff",
            fontSize: 196,
            fontWeight: 700,
            letterSpacing: "-0.04em",
          }}
        >
          Rp
        </div>
      </div>
    ),
    size,
  );
}
