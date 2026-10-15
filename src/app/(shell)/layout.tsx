import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { NavProvider } from "@/components/nav-context";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavProvider>
      {/* h-dvh = the visible height on phones (100vh is taller than the screen when the browser bar is showing) */}
      <div className="flex h-dvh overflow-hidden bg-[var(--bg)]">
        <Suspense fallback={<div className="hidden md:block w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg)]" />}>
          <Sidebar />
        </Suspense>
        <div className="flex flex-col flex-1 min-w-0 md:ml-64">
          <TopBar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14">{children}</main>
        </div>
      </div>
    </NavProvider>
  );
}
