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
  
  useEffect(() => {
    const saved = localStorage.getItem("growitate_workspace");
    if (saved) {
      try {
        setActiveWorkspace(JSON.parse(saved));
      } catch (e) {
        // invalid JSON
      }
    }
  }, []);

  const setWorkspace = (workspace: Workspace) => {
    setActiveWorkspace(workspace);
    localStorage.setItem("growitate_workspace", JSON.stringify(workspace));
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
