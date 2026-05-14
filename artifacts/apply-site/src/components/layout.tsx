import { ReactNode } from "react";
import { Link } from "wouter";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.92 11.12C15.86 11.12 16.63 10.35 16.63 9.41C16.63 8.47 15.86 7.7 14.92 7.7C13.98 7.7 13.21 8.47 13.21 9.41C13.21 10.35 13.98 11.12 14.92 11.12Z" fill="currentColor"/>
                <path d="M9.08008 11.12C10.0201 11.12 10.7901 10.35 10.7901 9.41C10.7901 8.47 10.0201 7.7 9.08008 7.7C8.14008 7.7 7.37008 8.47 7.37008 9.41C7.37008 10.35 8.14008 11.12 9.08008 11.12Z" fill="currentColor"/>
                <path d="M19.7299 15.65C18.6699 16.92 16.9599 17.58 14.9999 17.58H8.99986C7.03986 17.58 5.32986 16.92 4.26986 15.65C3.89986 15.21 3.25986 15.17 2.81986 15.54C2.37986 15.91 2.33986 16.55 2.70986 16.99C4.10986 18.67 6.36986 19.58 8.99986 19.58H14.9999C17.6299 19.58 19.8899 18.67 21.2899 16.99C21.6599 16.55 21.6199 15.91 21.1799 15.54C20.7399 15.17 20.0999 15.21 19.7299 15.65Z" fill="currentColor"/>
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.43 14.28C17.3 14.47 17.1 14.58 16.89 14.58C16.76 14.58 16.63 14.54 16.51 14.46C14.77 13.3 11.89 13.06 9.38 13.32C9.07 13.35 8.78 13.13 8.75 12.82C8.72 12.51 8.94 12.22 9.25 12.19C12.18 11.88 15.43 12.16 17.49 13.52C17.76 13.69 17.82 14.05 17.43 14.28Z" fill="currentColor"/>
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">Staff Portal</span>
          </Link>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 py-12 flex flex-col relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        {children}
      </main>
      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>This is a community-run portal, not affiliated with Discord Inc.</p>
      </footer>
    </div>
  );
}
