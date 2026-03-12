import { Router } from "express";
import { db, clientsTable, activitiesTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

router.get("/", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total clients
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(clientsTable)
      .where(eq(clientsTable.workspaceId, workspaceId));

    // New this month
    const [{ newThisMonth }] = await db
      .select({ newThisMonth: sql<number>`count(*)` })
      .from(clientsTable)
      .where(and(
        eq(clientsTable.workspaceId, workspaceId),
        gte(clientsTable.createdAt, startOfMonth)
      ));

    // Total activities
    const [{ totalActivities }] = await db
      .select({ totalActivities: sql<number>`count(*)` })
      .from(activitiesTable)
      .where(eq(activitiesTable.workspaceId, workspaceId));

    // Activities this month
    const [{ activitiesThisMonth }] = await db
      .select({ activitiesThisMonth: sql<number>`count(*)` })
      .from(activitiesTable)
      .where(and(
        eq(activitiesTable.workspaceId, workspaceId),
        gte(activitiesTable.date, startOfMonth)
      ));

    // Clients by stage
    const clientsByStage = await db
      .select({
        stage: clientsTable.leadStage,
        count: sql<number>`count(*)`,
      })
      .from(clientsTable)
      .where(eq(clientsTable.workspaceId, workspaceId))
      .groupBy(clientsTable.leadStage);

    // Won clients
    const wonEntry = clientsByStage.find(s => s.stage === "won");
    const wonClients = wonEntry ? Number(wonEntry.count) : 0;
    const lostEntry = clientsByStage.find(s => s.stage === "lost");
    const lostClients = lostEntry ? Number(lostEntry.count) : 0;

    // Activities by type
    const activitiesByType = await db
      .select({
        type: activitiesTable.type,
        count: sql<number>`count(*)`,
      })
      .from(activitiesTable)
      .where(eq(activitiesTable.workspaceId, workspaceId))
      .groupBy(activitiesTable.type);

    // Monthly new clients (last 6 months)
    const monthlyClients = await db
      .select({
        month: sql<string>`TO_CHAR(${clientsTable.createdAt}, 'Mon YYYY')`,
        count: sql<number>`count(*)`,
      })
      .from(clientsTable)
      .where(and(
        eq(clientsTable.workspaceId, workspaceId),
        gte(clientsTable.createdAt, new Date(now.getFullYear(), now.getMonth() - 5, 1))
      ))
      .groupBy(sql`TO_CHAR(${clientsTable.createdAt}, 'Mon YYYY')`)
      .orderBy(sql`MIN(${clientsTable.createdAt})`);

    // Opportunity size distribution (exclude null/empty)
    const opportunityBySize = await db
      .select({
        size: clientsTable.opportunitySize,
        count: sql<number>`count(*)`,
      })
      .from(clientsTable)
      .where(and(
        eq(clientsTable.workspaceId, workspaceId),
        sql`${clientsTable.opportunitySize} IS NOT NULL AND ${clientsTable.opportunitySize} != ''`
      ))
      .groupBy(clientsTable.opportunitySize)
      .orderBy(sql`count(*) DESC`);

    res.json({
      totalClients: Number(total),
      newClientsThisMonth: Number(newThisMonth),
      totalActivities: Number(totalActivities),
      activitiesThisMonth: Number(activitiesThisMonth),
      clientsByStage: clientsByStage.map(s => ({ stage: s.stage, count: Number(s.count) })),
      activitiesByType: activitiesByType.map(a => ({ type: a.type, count: Number(a.count) })),
      monthlyClients: monthlyClients.map(m => ({ month: m.month, count: Number(m.count) })),
      opportunityBySize: opportunityBySize.map(o => ({ size: o.size ?? "Unknown", count: Number(o.count) })),
      wonClients,
      lostClients,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
