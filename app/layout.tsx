import type { Metadata } from "next";
import { AppRouteShell } from "./components/app-route-shell";
import { IntlProvider } from "./components/intl-provider";
import { AppDataProvider } from "./hooks/use-app-data";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private",
  description: "Shaxsiy moliya, reja va odatlar boshqaruvi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  const stored = localStorage.getItem("private-theme") || "dark";
                  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
                  const theme = stored === "system" ? (prefersLight ? "light" : "dark") : stored;
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.style.colorScheme = theme;
                } catch {
                  document.documentElement.dataset.theme = "dark";
                  document.documentElement.style.colorScheme = "dark";
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--app-bg)] text-[var(--app-text)] transition-colors duration-300">
        <AppDataProvider>
          <IntlProvider>
            <AppRouteShell>{children}</AppRouteShell>
          </IntlProvider>
        </AppDataProvider>
      </body>
    </html>
  );
}
