import { Router } from "express";
import { db, clientsTable, activitiesTable, isDatabaseEnabled } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { devStore, ensureDevStoreReady } from "../dev-store.js";

const router = Router({ mergeParams: true });

router.get("/", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId as string);
    const period = (req.query.period as string) || "month";
    const now = new Date();
    let startDate: Date;

    if (period === "day") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      // default to month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const clients = devStore.clients.filter((client) => client.workspaceId === workspaceId);
      const activities = devStore.activities.filter((activity) => activity.workspaceId === workspaceId);
      const stageCounts = new Map<string, number>();
      const typeCounts = new Map<string, number>();
      const monthCounts = new Map<string, number>();
      const oppCounts = new Map<string, number>();

      for (const client of clients) {
        if (client.createdAt < startDate) continue;
        stageCounts.set(client.leadStage, (stageCounts.get(client.leadStage) ?? 0) + 1);
        if (client.opportunitySize) {
          oppCounts.set(client.opportunitySize, (oppCounts.get(client.opportunitySize) ?? 0) + 1);
        }
        const month = client.createdAt.toLocaleString("en-US", { month: "short", year: "numeric" });
        monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
      }

      for (const activity of activities) {
        if (activity.date < startDate) continue;
        typeCounts.set(activity.type, (typeCounts.get(activity.type) ?? 0) + 1);
      }

      const filteredClients = clients.filter(c => c.createdAt >= startDate);

      res.json({
        totalClients: filteredClients.length,
        totalRevenue: filteredClients.reduce((sum, client) => sum + Number(client.revenueTotal ?? 0), 0),
        newClientsThisMonth: filteredClients.length,
        totalActivities: activities.filter(a => a.date >= startDate).length,
        activitiesThisMonth: activities.filter(a => a.date >= startDate).length,
        clientsByStage: Array.from(stageCounts.entries()).map(([stage, count]) => ({ stage, count })),
        activitiesByType: Array.from(typeCounts.entries()).map(([type, count]) => ({ type, count })),
        monthlyClients: Array.from(monthCounts.entries()).map(([month, count]) => ({ month, count })),
        monthlyRevenue: Array.from(monthCounts.keys()).map(month => ({
          month,
          revenue: clients
            .filter(c => c.createdAt.toLocaleString("en-US", { month: "short", year: "numeric" }) === month)
            .reduce((sum, c) => sum + Number(c.revenueTotal ?? 0), 0)
        })),
        topClients: clients
          .sort((a, b) => Number(b.revenueTotal ?? 0) - Number(a.revenueTotal ?? 0))
          .slice(0, 5)
          .map(c => ({ name: c.clientName, revenue: Number(c.revenueTotal ?? 0) })),
        opportunityBySize: Array.from(oppCounts.entries()).map(([size, count]) => ({ size, count })),
        wonClients: stageCounts.get("won") ?? 0,
        lostClients: stageCounts.get("lost") ?? 0,
      });
      return;
    }

    // Total clients
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(clientsTable)
      .where(and(eq(clientsTable.workspaceId, workspaceId), gte(clientsTable.createdAt, startDate)));

    const [{ totalRevenue }] = await db
      .select({ totalRevenue: sql<number>`coalesce(sum(${clientsTable.revenueTotal}), 0)` })
      .from(clientsTable)
      .where(and(eq(clientsTable.workspaceId, workspaceId), gte(clientsTable.createdAt, startDate)));

    // New this month
    const [{ newThisMonth }] = await db
      .select({ newThisMonth: sql<number>`count(*)` })
      .from(clientsTable)
      .where(and(
        eq(clientsTable.workspaceId, workspaceId),
        gte(clientsTable.createdAt, startDate)
      ));

    // Total activities
    const [{ totalActivities }] = await db
      .select({ totalActivities: sql<number>`count(*)` })
      .from(activitiesTable)
      .where(and(eq(activitiesTable.workspaceId, workspaceId), gte(activitiesTable.date, startDate)));

    // Activities this period
    const [{ activitiesThisMonth }] = await db
      .select({ activitiesThisMonth: sql<number>`count(*)` })
      .from(activitiesTable)
      .where(and(
        eq(activitiesTable.workspaceId, workspaceId),
        gte(activitiesTable.date, startDate)
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

    // Monthly new clients & revenue (last 6 months)
    const monthlyData = await db
      .select({
        month: sql<string>`TO_CHAR(${clientsTable.createdAt}, 'Mon YYYY')`,
        count: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${clientsTable.revenueTotal}), 0)`,
        minDate: sql`MIN(${clientsTable.createdAt})`,
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

    // Top clients by revenue
    const topClients = await db
      .select({
        name: clientsTable.clientName,
        revenue: sql<number>`${clientsTable.revenueTotal}`,
      })
      .from(clientsTable)
      .where(and(eq(clientsTable.workspaceId, workspaceId), gte(clientsTable.createdAt, startDate)))
      .orderBy(sql`${clientsTable.revenueTotal} DESC`)
      .limit(5);

    res.json({
      totalClients: Number(total),
      totalRevenue: Number(totalRevenue),
      newClientsThisMonth: Number(newThisMonth),
      totalActivities: Number(totalActivities),
      activitiesThisMonth: Number(activitiesThisMonth),
      clientsByStage: clientsByStage.map(s => ({ stage: s.stage, count: Number(s.count) })),
      activitiesByType: activitiesByType.map(a => ({ type: a.type, count: Number(a.count) })),
      monthlyClients: monthlyData.map(m => ({ month: m.month, count: Number(m.count) })),
      monthlyRevenue: monthlyData.map(m => ({ month: m.month, revenue: Number(m.revenue) })),
      topClients: topClients.map(c => ({ name: c.name, revenue: Number(c.revenue) })),
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
