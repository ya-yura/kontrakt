import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Operational Workspace",
  description: "MVP foundation for 223-FZ supplier operations"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

