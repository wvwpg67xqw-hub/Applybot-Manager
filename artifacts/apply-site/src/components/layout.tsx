import { ReactNode } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, LogIn } from "lucide-react";

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated, login, logout, isLoggingOut } = useAuth();

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : null;

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

          <div className="flex items-center gap-3">
            <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            </nav>

            {!isLoading && (
              isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full pl-2 pr-3 py-1 border border-border/40 bg-card/40 hover:bg-card/80 transition-colors text-sm font-medium">
                      <Avatar className="w-7 h-7">
                        {avatarUrl && <AvatarImage src={avatarUrl} alt={user.username} />}
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:inline">{user.username}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Signed in as <span className="font-semibold text-foreground">{user.username}</span>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={logout}
                      disabled={isLoggingOut}
                      className="text-rose-400 focus:text-rose-400 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  size="sm"
                  onClick={() => login()}
                  className="gap-2 font-semibold"
                  data-testid="button-login"
                >
                  <DiscordIcon />
                  Sign in with Discord
                  <LogIn className="w-3.5 h-3.5" />
                </Button>
              )
            )}
          </div>
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
