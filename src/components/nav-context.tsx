"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

interface NavState {
  /** Mobile drawer open? (always false on desktop, where the sidebar is permanent) */
  open: boolean;
  openNav: () => void;
  closeNav: () => void;
}

const NavContext = createContext<NavState>({ open: false, openNav: () => {}, closeNav: () => {} });

export function NavProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Remember WHICH page the drawer was opened on: navigating anywhere auto-closes it, no effect needed.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  const openNav = useCallback(() => setOpenFor(pathname), [pathname]);
  const closeNav = useCallback(() => setOpenFor(null), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenFor(null);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // don't scroll the page behind the drawer
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const value = useMemo(() => ({ open, openNav, closeNav }), [open, openNav, closeNav]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export const useNav = () => useContext(NavContext);
