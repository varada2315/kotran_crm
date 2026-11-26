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
import Workspaces from "./pages/workspaces";
import Clients from "./pages/clients";
import LeadsDashboard from "./pages/leads";
import ClientDetail from "./pages/client-detail";
import LeadDetail from "./pages/leads-detail";
import Activities from "./pages/activities";
import AnalyticsDashboard from "./pages/analytics";
import RevenuePage from "./pages/revenue";
import DailyTracker from "./pages/daily-tracker";
import AdminUsers from "./pages/admin-users";
import { DashboardLayout } from "./components/layout/dashboard-layout";

// --- API FETCH INTERCEPTOR ---
// Automatically injects the JWT token from localStorage into all /api calls
const API_PREFIX = "/api";
const originalFetch = window.fetch;

function isApiRequest(resource: RequestInfo | URL): boolean {
  const rawUrl =
    typeof resource === "string"
      ? resource
      : resource instanceof URL
        ? resource.toString()
        : resource.url;

  try {
    const parsed = new URL(rawUrl, window.location.origin);
    return parsed.pathname.startsWith(API_PREFIX);
  } catch {
    return rawUrl.startsWith(API_PREFIX);
  }
}

window.fetch = async (...args) => {
  const token = localStorage.getItem("kotran_token");
  const [resource, config] = args;

  if (!token || !isApiRequest(resource)) {
    return originalFetch(...args);
  }

  if (resource instanceof Request) {
    const headers = new Headers(resource.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const requestWithAuth = new Request(resource, { headers });
    return originalFetch(requestWithAuth, config);
  }

  const headers = new Headers(config?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return originalFetch(resource, { ...config, headers });
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    }
  }
});

function ProtectedRoute({ children, adminOnly }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { token, user, isLoading } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!token) setLocation("/login");
    else if (!activeWorkspaceId) setLocation("/workspaces");
    else if (adminOnly && user?.role !== "admin") setLocation("/leads");
  }, [isLoading, token, activeWorkspaceId, adminOnly, user]);

  if (isLoading) return null;
  if (!token || !activeWorkspaceId) return null;
  if (adminOnly && user?.role !== "admin") return null;

  return <DashboardLayout>{children}</DashboardLayout>;
}

function RedirectRoot() {
  const { token, user, isLoading } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      setLocation("/login");
    } else if (!activeWorkspaceId) {
      setLocation("/workspaces");
    } else {
      if (user?.role === "admin") {
        setLocation("/revenue");
      } else {
        setLocation("/leads");
      }
    }
  }, [isLoading, token, activeWorkspaceId, user]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* App Routes */}
      <Route path="/workspaces" component={Workspaces} />
      
      <Route path="/clients">
        <ProtectedRoute><Clients /></ProtectedRoute>
      </Route>

      <Route path="/leads">
        <ProtectedRoute><LeadsDashboard /></ProtectedRoute>
      </Route>

      <Route path="/revenue">
        <ProtectedRoute adminOnly><RevenuePage /></ProtectedRoute>
      </Route>
      
      <Route path="/clients/:id">
        {(params) => <ProtectedRoute><ClientDetail id={Number(params.id)} /></ProtectedRoute>}
      </Route>
      
      <Route path="/leads/:id">
        {(params) => <ProtectedRoute><LeadDetail id={Number(params.id)} /></ProtectedRoute>}
      </Route>
      
      <Route path="/activities">
        <ProtectedRoute><Activities /></ProtectedRoute>
      </Route>
      
      <Route path="/analytics">
        <ProtectedRoute adminOnly><AnalyticsDashboard /></ProtectedRoute>
      </Route>
      
      <Route path="/daily-tracker">
        <ProtectedRoute><DailyTracker /></ProtectedRoute>
      </Route>

      <Route path="/admin/users">
        <ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>
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
