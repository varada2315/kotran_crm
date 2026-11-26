import type { Activity, Client, User, Workspace } from "@workspace/db";
import { MongoClient, type Collection } from "mongodb";

export type PurchasedItem = {
  itemName: string;
  quantity?: number;
  unitPrice: number;
  totalPrice?: number;
};

export type InvoiceAttachment = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileDataUrl: string;
  uploadedAt?: string;
};

export type DevClient = Omit<Client, "purchasedItems" | "invoices" | "revenueTotal"> & {
  purchasedItems?: PurchasedItem[];
  invoices?: InvoiceAttachment[];
  revenueTotal?: number;
};

type DevActivity = Activity & { clientName?: string };

const now = () => new Date();
const mongoUri = process.env.mongo ?? process.env.MONGO_URL ?? process.env.MONGO_URI;
const MONGO_COLLECTION = "dev_store";
const MONGO_STATE_ID = "singleton";

let userIdCounter = 3;
let clientIdCounter = 3;
let activityIdCounter = 4;
let mongoClient: MongoClient | null = null;
let mongoCollection: Collection<MongoStoreDocument> | null = null;
let initPromise: Promise<void> | null = null;

type MongoStoreDocument = {
  _id: string;
  users: User[];
  workspaces: Workspace[];
  clients: DevClient[];
  activities: DevActivity[];
  counters: {
    userIdCounter: number;
    clientIdCounter: number;
    activityIdCounter: number;
  };
  updatedAt: Date;
};

export const devStore: {
  users: User[];
  workspaces: Workspace[];
  clients: DevClient[];
  activities: DevActivity[];
} = {
  users: [
    {
      id: 1,
      name: "Super User",
      email: "admin@kotran.crm",
      password: "$2b$10$G2qmjal7u2MbnkhWJaHIzuixbEGwX11yvimFNcJgNzFV19ahSJLGW", // admin123
      role: "admin",
      createdAt: now(),
    } as User,
    {
      id: 2,
      name: "Demo User",
      email: "demo@kotran.local",
      password: "$2b$10$G2qmjal7u2MbnkhWJaHIzuixbEGwX11yvimFNcJgNzFV19ahSJLGW", // admin123
      role: "user",
      createdAt: now(),
    } as User,
    {
      id: 3,
      name: "Manya",
      email: "manya@growitate.com",
      password: "$2b$10$SOB.PS9HQlzcnfqRk55/ruTktWvcFJHKLaXtp.dHsZSSbuo0WDXMm", // RYhg98cgs8WgC
      role: "user",
      createdAt: now(),
    } as User,
  ],
  workspaces: [
    { id: 1, name: "Growitate", slug: "growitate", description: "Marketing & Lead Management" },
    { id: 2, name: "DeploidX CRM", slug: "deploidx", description: "DevOps & Hosting Clients" },
  ],
  clients: [
    {
      id: 1,
      workspaceId: 1,
      clientName: "Her Healing",
      displayName: "Her Healing",
      phone: "+91 90000 00001",
      whatsapp: "+91 90000 00001",
      email: "contact@herhealing.com",
      notes: "January Sale",
      leadStage: "won",
      opportunitySize: "4200",
      groups: null,
      purchasedItems: [
        { itemName: "Consultation", quantity: 1, unitPrice: 4200, totalPrice: 4200 },
      ],
      invoices: [],
      revenueTotal: 4200,
      createdAt: new Date("2026-01-10T10:00:00Z"),
      lastActivityAt: new Date("2026-01-10T10:00:00Z"),
    },
    {
      id: 2,
      workspaceId: 1,
      clientName: "Black diamond",
      displayName: "Black diamond",
      phone: "+91 90000 00002",
      whatsapp: "+91 90000 00002",
      email: "info@blackdiamond.com",
      notes: "January Sale",
      leadStage: "won",
      opportunitySize: "16500",
      groups: null,
      purchasedItems: [
        { itemName: "Premium Package", quantity: 1, unitPrice: 16500, totalPrice: 16500 },
      ],
      invoices: [],
      revenueTotal: 16500,
      createdAt: new Date("2026-01-12T10:00:00Z"),
      lastActivityAt: new Date("2026-01-12T10:00:00Z"),
    },
    {
      id: 3,
      workspaceId: 1,
      clientName: "Jeff",
      displayName: "Jeff",
      phone: "+91 90000 00003",
      whatsapp: "+91 90000 00003",
      email: "jeff@example.com",
      notes: "January Sale",
      leadStage: "won",
      opportunitySize: "15100",
      groups: null,
      purchasedItems: [
        { itemName: "Ad Management", quantity: 1, unitPrice: 15100, totalPrice: 15100 },
      ],
      invoices: [],
      revenueTotal: 15100,
      createdAt: new Date("2026-01-15T10:00:00Z"),
      lastActivityAt: new Date("2026-01-15T10:00:00Z"),
    },
    {
      id: 4,
      workspaceId: 1,
      clientName: "Global wings",
      displayName: "Global wings",
      phone: "+91 90000 00004",
      whatsapp: "+91 90000 00004",
      email: "support@globalwings.com",
      notes: "January Sale",
      leadStage: "won",
      opportunitySize: "5920",
      groups: null,
      purchasedItems: [
        { itemName: "Logistics Setup", quantity: 1, unitPrice: 5920, totalPrice: 5920 },
      ],
      invoices: [],
      revenueTotal: 5920,
      createdAt: new Date("2026-01-20T10:00:00Z"),
      lastActivityAt: new Date("2026-01-20T10:00:00Z"),
    },
  ],
  activities: [
    {
      id: 1,
      clientId: 1,
      workspaceId: 1,
      type: "client_added",
      description: "Client Her Healing was added to the CRM",
      date: new Date("2026-01-10T10:00:00Z"),
      clientName: "Her Healing",
    },
    {
      id: 2,
      clientId: 2,
      workspaceId: 1,
      type: "client_added",
      description: "Client Black diamond was added to the CRM",
      date: new Date("2026-01-12T10:00:00Z"),
      clientName: "Black diamond",
    },
    {
      id: 3,
      clientId: 3,
      workspaceId: 1,
      type: "client_added",
      description: "Client Jeff was added to the CRM",
      date: new Date("2026-01-15T10:00:00Z"),
      clientName: "Jeff",
    },
    {
      id: 4,
      clientId: 4,
      workspaceId: 1,
      type: "client_added",
      description: "Client Global wings was added to the CRM",
      date: new Date("2026-01-20T10:00:00Z"),
      clientName: "Global wings",
    },
  ],
};

function toDate(value: unknown, fallback: Date | null = null): Date | null {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
}

function syncCountersFromStore() {
  userIdCounter = Math.max(1, ...devStore.users.map((user) => Number(user.id) || 0)) + 1;
  clientIdCounter = Math.max(1, ...devStore.clients.map((client) => Number(client.id) || 0)) + 1;
  activityIdCounter =
    Math.max(1, ...devStore.activities.map((activity) => Number(activity.id) || 0)) + 1;
}

function hydrateStore(doc: MongoStoreDocument) {
  devStore.users = (doc.users ?? []).map((user) => ({
    ...user,
    createdAt: toDate(user.createdAt, now()) ?? now(),
  })) as User[];

  devStore.workspaces = (doc.workspaces ?? []).map((workspace) => ({ ...workspace })) as Workspace[];

  devStore.clients = (doc.clients ?? []).map((client) => ({
    ...client,
    createdAt: toDate(client.createdAt, now()) ?? now(),
    lastActivityAt: toDate(client.lastActivityAt, null),
  })) as DevClient[];

  devStore.activities = (doc.activities ?? []).map((activity) => ({
    ...activity,
    date: toDate(activity.date, now()) ?? now(),
  })) as DevActivity[];

  const counters = doc.counters ?? {
    userIdCounter: NaN,
    clientIdCounter: NaN,
    activityIdCounter: NaN,
  };

  userIdCounter = Number.isFinite(counters.userIdCounter)
    ? counters.userIdCounter
    : Math.max(1, ...devStore.users.map((user) => Number(user.id) || 0)) + 1;
  clientIdCounter = Number.isFinite(counters.clientIdCounter)
    ? counters.clientIdCounter
    : Math.max(1, ...devStore.clients.map((client) => Number(client.id) || 0)) + 1;
  activityIdCounter = Number.isFinite(counters.activityIdCounter)
    ? counters.activityIdCounter
    : Math.max(1, ...devStore.activities.map((activity) => Number(activity.id) || 0)) + 1;
}

async function getMongoCollection() {
  if (!mongoUri) {
    return null;
  }

  if (mongoCollection) {
    return mongoCollection;
  }

  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  mongoCollection = mongoClient.db().collection<MongoStoreDocument>(MONGO_COLLECTION);
  return mongoCollection;
}

export async function ensureDevStoreReady() {
  if (!mongoUri) {
    return;
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const collection = await getMongoCollection();
        if (!collection) {
          return;
        }

        const existing = await collection.findOne({ _id: MONGO_STATE_ID });
        if (existing) {
          hydrateStore(existing);
        } else {
          syncCountersFromStore();
          await persistDevStore();
        }

        const adminEmail = "admin@kotran.crm";
        if (!devStore.users.some(u => u.email === adminEmail)) {
          devStore.users.push({
            id: userIdCounter++,
            name: "Super User",
            email: adminEmail,
            password: "$2b$10$G2qmjal7u2MbnkhWJaHIzuixbEGwX11yvimFNcJgNzFV19ahSJLGW", // admin123
            role: "admin",
            createdAt: now(),
          } as User);
        }

        const newUserEmail = "manya@growitate.com";
        if (!devStore.users.some(u => u.email === newUserEmail)) {
          devStore.users.push({
            id: userIdCounter++,
            name: "Manya",
            email: newUserEmail,
            password: "$2b$10$SOB.PS9HQlzcnfqRk55/ruTktWvcFJHKLaXtp.dHsZSSbuo0WDXMm", // RYhg98cgs8WgC
            role: "user",
            createdAt: now(),
          } as User);
        }
        await persistDevStore();
      } catch (error) {
        console.error("Mongo-backed dev store initialization failed; using in-memory only.", error);
      }
    })();
  }

  await initPromise;
}

export async function persistDevStore() {
  if (!mongoUri) {
    return;
  }

  try {
    const collection = await getMongoCollection();
    if (!collection) {
      return;
    }

    await collection.updateOne(
      { _id: MONGO_STATE_ID },
      {
        $set: {
          users: devStore.users,
          workspaces: devStore.workspaces,
          clients: devStore.clients,
          activities: devStore.activities,
          counters: {
            userIdCounter,
            clientIdCounter,
            activityIdCounter,
          },
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    console.error("Mongo-backed dev store persistence failed.", error);
  }
}

export function nextUserId() {
  return userIdCounter++;
}

export function nextClientId() {
  return clientIdCounter++;
}

export function nextActivityId() {
  return activityIdCounter++;
}
