import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveBoard | Real-time Collaborative Task Manager",
  description:
    "A portfolio-grade real-time task board built with Next.js, Socket.io, Redis, and PostgreSQL.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
