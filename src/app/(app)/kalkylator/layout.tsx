import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 0.85,
  maximumScale: 5,
};

export default function KalkylatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
