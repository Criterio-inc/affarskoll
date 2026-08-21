import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { ErrorBoundary } from "@/components/error-boundary";
import { AiChat } from "@/components/ai/ai-chat";

// All app pages require auth, so skip static pre-rendering
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <MobileNav />
      <CommandPalette />
      <main id="main-content" className="flex-1 min-w-0 lg:ml-0 pt-14 lg:pt-0 pb-20 lg:pb-0">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
        >
          Hoppa till innehåll
        </a>
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
      <AiChat />
    </div>
  );
}
