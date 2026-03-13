import { Router } from "express";
import { db, workspacesTable, clientsTable, isDatabaseEnabled } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { devStore } from "../dev-store.js";

const router = Router();

router.get("/", authenticateToken, async (_req, res) => {
  try {
    if (!isDatabaseEnabled) {
      res.json(
        devStore.workspaces.map((workspace) => ({
          ...workspace,
          clientCount: devStore.clients.filter((client) => client.workspaceId === workspace.id).length,
        })),
      );
      return;
    }

    const workspaces = await db.select().from(workspacesTable);
    
    const result = await Promise.all(
      workspaces.map(async (ws) => {
        const [{ clientCount }] = await db
          .select({ clientCount: count() })
          .from(clientsTable)
          .where(eq(clientsTable.workspaceId, ws.id));
        return { ...ws, clientCount: Number(clientCount) };
      })
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
