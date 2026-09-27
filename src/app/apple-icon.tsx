import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon (iOS adds its own rounded corners, so this is a full square).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "#0E7A55" }}>
        <svg width={120} height={96} viewBox="6 8 20 16">
          <path d="M8 10.5c2.6-1.2 5.3-1.2 8 0v12c-2.7-1.2-5.4-1.2-8 0z" fill="#fff" opacity=".92" />
          <path d="M16 10.5c2.6-1.2 5.3-1.2 8 0v12c-2.7-1.2-5.4-1.2-8 0z" fill="#F2A541" />
          <path d="m18.2 16.6 1.7 1.7 3-3.4" stroke="#14201B" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
