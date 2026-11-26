import { Router } from "express";
import { db, clientsTable, activitiesTable, isDatabaseEnabled } from "@workspace/db";
import { eq, and, ilike, sql } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import {
  devStore,
  ensureDevStoreReady,
  nextActivityId,
  nextClientId,
  persistDevStore,
} from "../dev-store.js";

const router = Router({ mergeParams: true });

type PurchasedItem = {
  itemName: string;
  quantity?: number;
  unitPrice: number;
  totalPrice?: number;
};

type InvoiceAttachment = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileDataUrl: string;
  uploadedAt?: string;
  amount?: number;
};

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizePurchasedItems(value: unknown): PurchasedItem[] {
  const parsed = Array.isArray(value) ? value : safeJsonParse<unknown[]>(value, []);

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const quantity = Number(record.quantity ?? 1);
      const unitPrice = Number(record.unitPrice ?? record.cost ?? 0);
      const totalPrice = Number(
        record.totalPrice ?? (Number.isFinite(quantity) ? quantity : 1) * unitPrice,
      );

      if (!record.itemName || Number.isNaN(unitPrice) || Number.isNaN(totalPrice)) {
        return null;
      }

      return {
        itemName: String(record.itemName),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unitPrice,
        totalPrice,
      };
    })
    .filter((item): item is PurchasedItem => item !== null);
}

function normalizeInvoices(value: unknown): InvoiceAttachment[] {
  const parsed = Array.isArray(value) ? value : safeJsonParse<unknown[]>(value, []);

  return parsed
    .map((invoice) => {
      if (!invoice || typeof invoice !== "object") {
        return null;
      }

      const record = invoice as Record<string, unknown>;

      if (!record.fileName || !record.fileDataUrl) {
        return null;
      }

      return {
        fileName: String(record.fileName),
        mimeType: String(record.mimeType ?? "application/octet-stream"),
        sizeBytes: Number(record.sizeBytes ?? 0),
        fileDataUrl: String(record.fileDataUrl),
        uploadedAt: typeof record.uploadedAt === "string" ? record.uploadedAt : new Date().toISOString(),
        amount: Number(record.amount ?? 0),
      };
    })
    .filter((invoice): invoice is InvoiceAttachment => invoice !== null);
}

function computeRevenueTotal(invoices: InvoiceAttachment[]) {
  return invoices.reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
}

function serializeClient(client: Record<string, unknown>) {
  const purchasedItems = normalizePurchasedItems(client.purchasedItems);
  const invoices = normalizeInvoices(client.invoices);

  const result = {
    ...client,
    purchasedItems,
    invoices,
    revenueTotal: Number(client.revenueTotal ?? computeRevenueTotal(invoices)),
  };
  console.log("Serialized Client:", JSON.stringify(result, null, 2));
  return result;
}

router.get("/", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const { search, tab, period } = req.query as { search?: string; tab?: string; period?: string };
    const now = new Date();
    let startDate: Date | null = null;
    if (period) {
      if (period === "day") startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      else if (period === "week") startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (period === "year") startDate = new Date(now.getFullYear(), 0, 1);
      else if (period === "month") startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      let clients = devStore.clients.filter((client) => client.workspaceId === workspaceId);
      if (search) {
        clients = clients.filter((client) => client.clientName.toLowerCase().includes(search.toLowerCase()));
      }
      if (tab === "uncontacted") {
        clients = clients.filter((client) => client.leadStage === "new");
      } else if (tab === "followups") {
        clients = clients.filter((client) => client.leadStage === "contacted");
      }
      if (startDate) {
        clients = clients.filter((client) => client.createdAt >= startDate!);
      }
      clients.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      res.json(clients.map((client) => serializeClient(client)));
      return;
    }

    let conditions = [eq(clientsTable.workspaceId, workspaceId)];

    if (search) {
      conditions.push(ilike(clientsTable.clientName, `%${search}%`));
    }

    if (tab === "uncontacted") {
      conditions.push(eq(clientsTable.leadStage, "new"));
    } else if (tab === "followups") {
      conditions.push(eq(clientsTable.leadStage, "contacted"));
    }

    if (startDate) {
      conditions.push(sql`${clientsTable.createdAt} >= ${startDate}`);
    }

    const clients = await db
      .select()
      .from(clientsTable)
      .where(and(...conditions))
      .orderBy(sql`${clientsTable.createdAt} DESC`);

    res.json(clients.map((client) => serializeClient(client)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  try {
    console.log("POST /clients body:", JSON.stringify(req.body, null, 2));
    const workspaceId = parseInt(req.params.workspaceId);
    const {
      clientName,
      displayName,
      phone,
      whatsapp,
      email,
      notes,
      leadStage,
      opportunitySize,
      groups,
      purchasedItems,
      invoices,
      createdAt,
    } = req.body;

    const finalClientName = clientName || (phone ? `Client ${phone}` : "New Client");

    const normalizedPurchasedItems = normalizePurchasedItems(purchasedItems);
    const normalizedInvoices = normalizeInvoices(invoices);

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const client = {
        id: nextClientId(),
        workspaceId,
        clientName: finalClientName,
        displayName: displayName || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        email: email || null,
        notes: notes || null,
        leadStage: leadStage || "new",
        opportunitySize: opportunitySize || null,
        groups: groups || null,
        purchasedItems: normalizedPurchasedItems,
        invoices: normalizedInvoices,
        revenueTotal: Number(req.body.revenueTotal ?? computeRevenueTotal(normalizedInvoices)),
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        lastActivityAt: null,
      };
      devStore.clients.push(client);
      devStore.activities.push({
        id: nextActivityId(),
        clientId: client.id,
        workspaceId,
        type: "client_added",
        description: `Client ${finalClientName} was added to the CRM`,
        date: new Date(),
        clientName: finalClientName,
      });
      await persistDevStore();
      console.log("Created DevClient:", JSON.stringify(client, null, 2));
      res.status(201).json(serializeClient(client));
      return;
    }

    const [client] = await db.insert(clientsTable).values({
      workspaceId,
      clientName: finalClientName,
      displayName: displayName || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      email: email || null,
      notes: notes || null,
      leadStage: leadStage || "new",
      opportunitySize: opportunitySize || null,
      groups: groups || null,
      purchasedItems: JSON.stringify(normalizedPurchasedItems),
      invoices: JSON.stringify(normalizedInvoices),
      revenueTotal: Number(req.body.revenueTotal ?? computeRevenueTotal(normalizedInvoices)),
      createdAt: createdAt ? new Date(createdAt) : undefined,
    }).returning();

    // Log client_added activity
    await db.insert(activitiesTable).values({
      clientId: client.id,
      workspaceId,
      type: "client_added",
      description: `Client ${clientName} was added to the CRM`,
      date: new Date(),
    });

    res.status(201).json(serializeClient(client));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:clientId", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const clientId = parseInt(req.params.clientId);

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const client = devStore.clients.find((entry) => entry.id === clientId && entry.workspaceId === workspaceId);
      if (!client) {
        res.status(404).json({ error: "Not Found", message: "Client not found" });
        return;
      }
      res.json(serializeClient(client));
      return;
    }

    const [client] = await db
      .select()
      .from(clientsTable)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!client) {
      res.status(404).json({ error: "Not Found", message: "Client not found" });
      return;
    }

    res.json(serializeClient(client));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/:clientId", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const clientId = parseInt(req.params.clientId);
    const updates = { ...req.body } as Record<string, unknown>;
    const preparedUpdates: Record<string, unknown> = {
      ...updates,
      lastActivityAt: new Date(),
    };

    if ("purchasedItems" in updates) {
      const normalizedPurchasedItems = normalizePurchasedItems(updates.purchasedItems);
      preparedUpdates.purchasedItems = JSON.stringify(normalizedPurchasedItems);
    }

    if ("invoices" in updates) {
      const normalizedInvoices = normalizeInvoices(updates.invoices);
      preparedUpdates.invoices = JSON.stringify(normalizedInvoices);
      preparedUpdates.revenueTotal = computeRevenueTotal(normalizedInvoices);
    }

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const client = devStore.clients.find((entry) => entry.id === clientId && entry.workspaceId === workspaceId);
      if (!client) {
        res.status(404).json({ error: "Not Found", message: "Client not found" });
        return;
      }

      const nextPurchasedItems =
        "purchasedItems" in updates ? normalizePurchasedItems(updates.purchasedItems) : client.purchasedItems ?? [];
      const nextInvoices =
        "invoices" in updates ? normalizeInvoices(updates.invoices) : client.invoices ?? [];

      Object.assign(client, updates, {
        purchasedItems: nextPurchasedItems,
        invoices: nextInvoices,
        revenueTotal: computeRevenueTotal(nextInvoices),
        lastActivityAt: new Date(),
      });

      await persistDevStore();
      res.json(serializeClient(client));
      return;
    }

    const [client] = await db
      .update(clientsTable)
      .set(preparedUpdates)
      .where(and(eq(clientsTable.id, clientId), eq(clientsTable.workspaceId, workspaceId)))
      .returning();

    if (!client) {
      res.status(404).json({ error: "Not Found", message: "Client not found" });
      return;
    }

    res.json(serializeClient(client));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/:clientId", authenticateToken, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const clientId = parseInt(req.params.clientId);

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const clientIndex = devStore.clients.findIndex((entry) => entry.id === clientId && entry.workspaceId === workspaceId);
      if (clientIndex >= 0) {
        devStore.clients.splice(clientIndex, 1);
        devStore.activities = devStore.activities.filter((activity) => activity.clientId !== clientId);
      }
      await persistDevStore();
      res.status(204).send();
      return;
    }

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
