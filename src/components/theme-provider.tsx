"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/** next-themes drives the real `.dark` / (no class) toggle on <html>, and
 * globals.css defines every color as a CSS variable that changes between
 * `:root` and `.dark` - unlike the MVP's custom ThemeContext, which toggled
 * a class that no CSS ever actually responded to. Defaults to dark since
 * that's the primary look Kingsley designed around. */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} {...props}>
      {children}
    </NextThemesProvider>
  );
}
