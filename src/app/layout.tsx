import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeDuel — Ranked coding battles",
  description: "Solve algorithm problems in competitive one-on-one coding duels.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
