// Root layout — sets HTML lang, loads global styles, wraps app in providers
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env["NEXT_PUBLIC_APP_NAME"] ?? "BLOKS",
  description: "파운더를 위한 AI 직원 운영 플랫폼",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
