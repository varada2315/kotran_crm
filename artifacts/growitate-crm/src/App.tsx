import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "./contexts/auth-context";
import { useAuth } from "./contexts/use-auth";
import { WorkspaceProvider, useWorkspace } from "./contexts/workspace-context";

// Pages
import Login from "./pages/login";
import Register from "./pages/register";
import Workspaces from "./pages/workspaces";
import Clients from "./pages/clients";
import ClientDetail from "./pages/client-detail";
import Activities from "./pages/activities";
import AnalyticsDashboard from "./pages/analytics";
import RevenuePage from "./pages/revenue";
import { DashboardLayout } from "./components/layout/dashboard-layout";

// --- API FETCH INTERCEPTOR ---
// Automatically injects the JWT token from localStorage into all /api calls
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const token = localStorage.getItem("kotran_token");
  const [resource, config] = args;
  
  if (token && typeof resource === "string" && resource.startsWith("/api")) {
    const headers = new Headers(config?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return originalFetch(resource, { ...config, headers });
  } else if (token && resource instanceof Request && resource.url.includes("/api")) {
    resource.headers.set("Authorization", `Bearer ${token}`);
    return originalFetch(resource, config);
  }
  return originalFetch(...args);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    }
  }
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!token) setLocation("/login");
    else if (!activeWorkspaceId) setLocation("/workspaces");
  }, [isLoading, token, activeWorkspaceId]);

  if (isLoading) return null;
  if (!token || !activeWorkspaceId) return null;

  return <DashboardLayout>{children}</DashboardLayout>;
}

function RedirectRoot() {
  const { token, isLoading } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      setLocation("/login");
      } else if (!activeWorkspaceId) {
        setLocation("/workspaces");
      } else {
      setLocation("/revenue");
      }
  }, [isLoading, token, activeWorkspaceId]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* App Routes */}
      <Route path="/workspaces" component={Workspaces} />
      
      <Route path="/clients">
        <ProtectedRoute><Clients /></ProtectedRoute>
      </Route>

      <Route path="/revenue">
        <ProtectedRoute><RevenuePage /></ProtectedRoute>
      </Route>
      
      <Route path="/clients/:id">
        {(params) => <ProtectedRoute><ClientDetail id={Number(params.id)} /></ProtectedRoute>}
      </Route>
      
      <Route path="/activities">
        <ProtectedRoute><Activities /></ProtectedRoute>
      </Route>
      
      <Route path="/analytics">
        <ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>
      </Route>
      
      <Route path="/" component={RedirectRoot} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <WorkspaceProvider>
              <Router />
            </WorkspaceProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
