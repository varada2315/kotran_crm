import React, { createContext, useContext, useState, useEffect } from "react";
import { Workspace } from "@workspace/api-client-react";

interface WorkspaceContextType {
  activeWorkspaceId: number | null;
  activeWorkspace: Workspace | null;
  setWorkspace: (workspace: Workspace) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);

  const normalizeWorkspace = (workspace: Workspace): Workspace => {
    if (workspace.id === 1) {
      return { ...workspace, name: "Growitate" };
    }

    if (workspace.id === 2) {
      return { ...workspace, name: "DeploidX CRM" };
    }

    return workspace;
  };
  
  useEffect(() => {
    const saved = localStorage.getItem("kotran_workspace");
    if (saved) {
      try {
        const parsed = normalizeWorkspace(JSON.parse(saved));
        setActiveWorkspace(parsed);
        localStorage.setItem("kotran_workspace", JSON.stringify(parsed));
      } catch (e) {
        // invalid JSON
      }
    }
  }, []);

  const setWorkspace = (workspace: Workspace) => {
    const normalized = normalizeWorkspace(workspace);
    setActiveWorkspace(normalized);
    localStorage.setItem("kotran_workspace", JSON.stringify(normalized));
  };

  return (
    <WorkspaceContext.Provider value={{ 
      activeWorkspaceId: activeWorkspace?.id ?? null, 
      activeWorkspace,
      setWorkspace 
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
