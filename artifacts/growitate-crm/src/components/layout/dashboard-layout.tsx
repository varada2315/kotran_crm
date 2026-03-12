import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Building2, LayoutDashboard, Users, ActivitySquare, BarChart3, LogOut, Briefcase } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const navItems = [
    { label: "Clients", icon: Users, path: "/clients" },
    { label: "Activities", icon: ActivitySquare, path: "/activities" },
    { label: "Analytics", icon: BarChart3, path: "/analytics" },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shadow-sm z-10">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-display font-bold text-lg">
            <Building2 className="w-6 h-6" />
            <span>{activeWorkspace?.name || "CRM"}</span>
          </div>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.path);
            return (
              <Link key={item.path} href={item.path} className="block">
                <Button 
                  variant={isActive ? "secondary" : "ghost"} 
                  className={`w-full justify-start gap-3 h-11 transition-all ${
                    isActive 
                      ? "bg-primary/10 text-primary font-semibold hover:bg-primary/15" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border">
          <Link href="/workspaces" className="block">
            <Button variant="outline" className="w-full justify-start gap-2 h-10 border-border/60 hover:bg-muted text-muted-foreground">
              <Briefcase className="w-4 h-4" />
              Switch Workspace
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-20">
          <div className="md:hidden flex items-center gap-2 font-display font-bold text-lg text-primary">
            <Building2 className="w-6 h-6" />
            <span>{activeWorkspace?.name}</span>
          </div>
          
          <div className="flex-1" />
          
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden hover-elevate border border-border/50">
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
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
