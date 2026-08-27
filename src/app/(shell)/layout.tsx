import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Suspense fallback={<div className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg)]" />}>
        <Sidebar />
      </Suspense>
      <div className="flex flex-col flex-1 min-w-0 ml-64">
        <TopBar />
        <main className="flex-1 overflow-y-auto pt-14">{children}</main>
      </div>
    </div>
  );
}
