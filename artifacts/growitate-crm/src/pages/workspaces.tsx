import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useGetWorkspaces } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Building2, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Workspaces() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { setWorkspace } = useWorkspace();
  const { data: workspaces, isLoading } = useGetWorkspaces();

  // If no workspaces returned from API, fallback to default ones as requested
  const displayWorkspaces = workspaces?.length ? workspaces : [
    { id: 1, name: "Growitate CRM", slug: "growitate", description: "Marketing & Lead Management", clientCount: 12 },
    { id: 2, name: "DeploidX CRM", slug: "deploidx", description: "DevOps & Hosting Clients", clientCount: 8 }
  ];

  const handleSelect = (ws: any) => {
    setWorkspace(ws);
    setLocation("/clients");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="py-6 px-8 border-b border-border bg-card">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 text-primary font-display font-bold text-xl">
            <Building2 className="w-6 h-6" />
            <span>Growitate</span>
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {user?.email}
          </div>
        </div>
      </header>

      <main className="flex-1 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center"
          >
            <h1 className="text-4xl font-display font-bold tracking-tight text-foreground mb-4">
              Select a Workspace
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the CRM environment you want to work in. Each workspace has its own clients, activities, and analytics.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {displayWorkspaces.map((ws, i) => (
              <motion.div
                key={ws.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card 
                  className="h-full border-2 border-border/50 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer group rounded-2xl overflow-hidden bg-card"
                  onClick={() => handleSelect(ws)}
                >
                  <CardHeader className="pb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-2xl group-hover:text-primary transition-colors">{ws.name}</CardTitle>
                    <CardDescription className="text-base">{ws.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                      <div className="text-sm font-medium text-muted-foreground">
                        {ws.clientCount} Active Clients
                      </div>
                      <div className="flex items-center text-primary font-semibold text-sm group-hover:translate-x-1 transition-transform">
                        Open <ArrowRight className="ml-1 w-4 h-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
