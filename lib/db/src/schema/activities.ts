import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { workspacesTable } from "./workspaces";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").notNull().references(() => workspacesTable.id),
  type: text("type").notNull(),
  description: text("description"),
  date: timestamp("date").defaultNow().notNull(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({ id: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
