import { ImageResponse } from "next/og";

// App icons for the manifest and home screen, rendered once at build time from the same mark as the logo.
const FILES = { "icon-192.png": { size: 192, maskable: false }, "icon-512.png": { size: 512, maskable: false }, "icon-maskable-512.png": { size: 512, maskable: true } } as const;
type File = keyof typeof FILES;

export const dynamic = "force-static";
export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const spec = FILES[file as File] ?? FILES["icon-512.png"];
  const s = spec.size;
  // Maskable icons need their artwork inside the central 80% safe zone.
  const inner = spec.maskable ? s * 0.62 : s * 0.8;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: "flex", alignItems: "center", justifyContent: "center", background: "#0E7A55", borderRadius: spec.maskable ? 0 : s * 0.22 }}>
        <svg width={inner} height={inner} viewBox="6 8 20 16">
          <path d="M8 10.5c2.6-1.2 5.3-1.2 8 0v12c-2.7-1.2-5.4-1.2-8 0z" fill="#fff" opacity=".92" />
          <path d="M16 10.5c2.6-1.2 5.3-1.2 8 0v12c-2.7-1.2-5.4-1.2-8 0z" fill="#F2A541" />
          <path d="m18.2 16.6 1.7 1.7 3-3.4" stroke="#14201B" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: s, height: s },
  );
}
