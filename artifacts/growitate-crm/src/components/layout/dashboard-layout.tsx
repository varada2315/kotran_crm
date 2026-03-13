import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Building2, Users, ActivitySquare, BarChart3, LogOut, Briefcase, IndianRupee } from "lucide-react";
import { useAuth } from "@/contexts/use-auth";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const navItems = [
    { label: "Revenue", icon: IndianRupee, path: "/revenue" },
    { label: "Clients", icon: Users, path: "/clients" },
    { label: "Activities", icon: ActivitySquare, path: "/activities" },
    { label: "Analytics", icon: BarChart3, path: "/analytics" },
  ];

  return (
    <div className="min-h-screen w-full bg-background font-sans">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-bold text-foreground">Kotran</div>
                <div className="truncate text-sm text-muted-foreground">{activeWorkspace?.name || "CRM"}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <Link href="/workspaces">
                <Button variant="outline" className="rounded-xl border-border/60">
                  <Briefcase className="mr-2 h-4 w-4" />
                  Switch Workspace
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full border border-border/50 p-0 overflow-hidden">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {user?.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <nav className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-2 pb-1">
              {navItems.map((item) => {
                const isActive = location.startsWith(item.path);
                return (
                  <Link key={item.path} href={item.path}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className={`h-10 rounded-xl px-4 ${
                        isActive
                          ? "bg-primary/10 text-primary hover:bg-primary/15"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
