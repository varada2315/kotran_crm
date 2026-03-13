import type { Activity, Client, User, Workspace } from "@workspace/db";

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

let userIdCounter = 2;
let clientIdCounter = 3;
let activityIdCounter = 4;

export const devStore: {
  users: User[];
  workspaces: Workspace[];
  clients: DevClient[];
  activities: DevActivity[];
} = {
  users: [
    {
      id: 1,
      name: "Demo User",
      email: "demo@kotran.local",
      password: "",
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
      clientName: "Acme Growth",
      displayName: "Rohan",
      phone: "+91 9876543210",
      whatsapp: "+91 9876543210",
      email: "rohan@acmegrowth.com",
      notes: "Monthly SEO and content retainer.",
      leadStage: "won",
      opportunitySize: "Retainer",
      groups: null,
      purchasedItems: [
        { itemName: "SEO Retainer", quantity: 1, unitPrice: 35000, totalPrice: 35000 },
        { itemName: "Blog Writing", quantity: 4, unitPrice: 2500, totalPrice: 10000 },
      ],
      invoices: [],
      revenueTotal: 45000,
      createdAt: now(),
      lastActivityAt: now(),
    },
    {
      id: 2,
      workspaceId: 2,
      clientName: "CloudForge",
      displayName: "Neha",
      phone: "+91 9988776655",
      whatsapp: "+91 9988776655",
      email: "ops@cloudforge.dev",
      notes: "Hosting and infra management.",
      leadStage: "won",
      opportunitySize: "Infrastructure",
      groups: null,
      purchasedItems: [{ itemName: "Managed Hosting", quantity: 1, unitPrice: 22000, totalPrice: 22000 }],
      invoices: [],
      revenueTotal: 22000,
      createdAt: now(),
      lastActivityAt: now(),
    },
  ],
  activities: [
    {
      id: 1,
      clientId: 1,
      workspaceId: 1,
      type: "client_added",
      description: "Client Acme Growth was added to the CRM",
      date: now(),
      clientName: "Acme Growth",
    },
    {
      id: 2,
      clientId: 1,
      workspaceId: 1,
      type: "note",
      description: "Sent monthly performance summary.",
      date: now(),
      clientName: "Acme Growth",
    },
    {
      id: 3,
      clientId: 2,
      workspaceId: 2,
      type: "client_added",
      description: "Client CloudForge was added to the CRM",
      date: now(),
      clientName: "CloudForge",
    },
  ],
};

export function nextUserId() {
  return userIdCounter++;
}

export function nextClientId() {
  return clientIdCounter++;
}

export function nextActivityId() {
  return activityIdCounter++;
}
