import { Router } from "express";
import { db, clientsTable, activitiesTable } from "@workspace/db";
import { eq, and, ilike, isNull, sql } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

router.get("/", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { search, tab } = req.query as { search?: string; tab?: string };

    let conditions = [eq(clientsTable.workspaceId, workspaceId)];

    if (search) {
      conditions.push(ilike(clientsTable.clientName, `%${search}%`));
    }

    if (tab === "uncontacted") {
      conditions.push(eq(clientsTable.leadStage, "new"));
    } else if (tab === "followups") {
      conditions.push(eq(clientsTable.leadStage, "contacted"));
    }

    const clients = await db
      .select()
      .from(clientsTable)
      .where(and(...conditions))
      .orderBy(sql`${clientsTable.createdAt} DESC`);

    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { clientName, displayName, phone, whatsapp, email, notes, leadStage, opportunitySize, groups } = req.body;

    if (!clientName) {
      res.status(400).json({ error: "Bad Request", message: "clientName is required" });
      return;
    }

    const [client] = await db.insert(clientsTable).values({
      workspaceId,
      clientName,
      displayName: displayName || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      email: email || null,
      notes: notes || null,
      leadStage: leadStage || "new",
      opportunitySize: opportunitySize || null,
      groups: groups || null,
    }).returning();

    // Log client_added activity
    await db.insert(activitiesTable).values({
      clientId: client.id,
      workspaceId,
      type: "client_added",
      description: `Client ${clientName} was added to the CRM`,
      date: new Date(),
    });

    res.status(201).json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:clientId", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const clientId = parseInt(req.params.clientId);

    const [client] = await db
      .select()
      .from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!client) {
      res.status(404).json({ error: "Not Found", message: "Client not found" });
      return;
    }

    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:clientId", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const clientId = parseInt(req.params.clientId);
    const updates = req.body;

    const [client] = await db
      .update(clientsTable)
      .set({ ...updates, lastActivityAt: new Date() })
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.workspaceId, workspaceId)))
      .returning();

    if (!client) {
      res.status(404).json({ error: "Not Found", message: "Client not found" });
      return;
    }

    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:clientId", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const clientId = parseInt(req.params.clientId);

    await db
      .delete(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.workspaceId, workspaceId)));

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
