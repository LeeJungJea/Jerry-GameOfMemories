import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jerry Game of Memories",
  description: "Classic memory games with rankings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
