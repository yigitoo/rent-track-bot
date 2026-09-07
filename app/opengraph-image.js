import { ImageResponse } from "next/og";

export const alt = "Vedat Gayrimenkul — Kira takip paneli";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Panelle aynı palet: mürekkep zemin, kobalt vurgu.
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
          padding: "64px 78px",
          backgroundColor: "#0c1220",
          backgroundImage:
            "radial-gradient(900px 520px at 8% -12%, rgba(43,84,212,0.55), transparent 62%), radial-gradient(700px 480px at 96% 106%, rgba(15,122,132,0.35), transparent 60%)",
          color: "#e9edf7",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "58px",
              height: "58px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "17px",
              backgroundColor: "#2b54d4",
              color: "#ffffff",
              fontSize: "30px",
              fontWeight: 800,
            }}
          >
            V
          </div>
          <span style={{ fontSize: "31px", fontWeight: 800, letterSpacing: "-1.2px" }}>
            Vedat Gayrimenkul
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: "940px" }}>
          <span style={{ color: "#7f9dff", fontSize: "17px", fontWeight: 800, letterSpacing: "4px", textTransform: "uppercase" }}>
            Kira takip paneli
          </span>
          <span style={{ marginTop: "20px", fontSize: "74px", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-4px" }}>
            Kiranın akışı
          </span>
          <span style={{ color: "#7f9dff", fontSize: "74px", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-4px" }}>
            belli olsun.
          </span>
          <span style={{ marginTop: "26px", color: "#a4b0c7", fontSize: "23px" }}>
            Kiracı · Ödeme · Gider · Takvim · Rapor · Telegram
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#6e7c95", fontSize: "16px" }}>
          <span>rent-track-bot.vercel.app</span>
          <span style={{ width: "110px", height: "2px", backgroundColor: "#2b54d4" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
