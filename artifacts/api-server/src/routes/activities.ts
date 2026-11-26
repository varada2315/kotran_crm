import { Router } from "express";
import { db, activitiesTable, clientsTable, isDatabaseEnabled } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { devStore, ensureDevStoreReady, nextActivityId, persistDevStore } from "../dev-store.js";

const router = Router({ mergeParams: true });

// Get all activities for a workspace
router.get("/", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const activities = devStore.activities
        .filter((activity) => activity.workspaceId === workspaceId)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 100);
      res.json(activities);
      return;
    }

    const activities = await db
      .select({
        id: activitiesTable.id,
        clientId: activitiesTable.clientId,
        workspaceId: activitiesTable.workspaceId,
        type: activitiesTable.type,
        description: activitiesTable.description,
        date: activitiesTable.date,
        clientName: clientsTable.clientName,
      })
      .from(activitiesTable)
      .leftJoin(clientsTable, eq(activitiesTable.clientId, clientsTable.id))
      .where(eq(activitiesTable.workspaceId, workspaceId))
      .orderBy(sql`${activitiesTable.date} DESC`)
      .limit(100);

    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get activities for a specific client
router.get("/clients/:clientId/activities", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const clientId = parseInt(req.params.clientId);

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const activities = devStore.activities
        .filter((activity) => activity.workspaceId === workspaceId && activity.clientId === clientId)
        .sort((a, b) => b.date.getTime() - a.date.getTime());
      res.json(activities);
      return;
    }

    const activities = await db
      .select()
      .from(activitiesTable)
      .where(and(eq(activitiesTable.clientId, clientId), eq(activitiesTable.workspaceId, workspaceId)))
      .orderBy(sql`${activitiesTable.date} DESC`);

    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Create activity for a client
router.post("/clients/:clientId/activities", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const clientId = parseInt(req.params.clientId);
    const { type, description, date } = req.body;

    if (!type) {
      res.status(400).json({ error: "Bad Request", message: "type is required" });
      return;
    }

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const activity = {
        id: nextActivityId(),
        clientId,
        workspaceId,
        type,
        description: description || null,
        date: date ? new Date(date) : new Date(),
        clientName: devStore.clients.find((client) => client.id === clientId)?.clientName,
      };
      devStore.activities.push(activity);
      const client = devStore.clients.find((entry) => entry.id === clientId);
      if (client) {
        client.lastActivityAt = new Date();
      }
      await persistDevStore();
      res.status(201).json(activity);
      return;
    }

    const [activity] = await db.insert(activitiesTable).values({
      clientId,
      workspaceId,
      type,
      description: description || null,
      date: date ? new Date(date) : new Date(),
    }).returning();

    // Update client lastActivityAt
    await db
      .update(clientsTable)
      .set({ lastActivityAt: new Date() })
      .where(eq(clientsTable.id, clientId));

    res.status(201).json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
