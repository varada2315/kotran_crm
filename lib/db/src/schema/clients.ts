import { pgTable, serial, text, integer, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspacesTable.id),
  clientName: text("client_name").notNull(),
  displayName: text("display_name"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  notes: text("notes"),
  leadStage: text("lead_stage").notNull().default("new"),
  opportunitySize: text("opportunity_size"),
  groups: text("groups"),
  purchasedItems: text("purchased_items").notNull().default("[]"),
  invoices: text("invoices").notNull().default("[]"),
  revenueTotal: doublePrecision("revenue_total").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at"),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
