import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import workspacesRouter from "./workspaces.js";
import clientsRouter from "./clients.js";
import activitiesRouter from "./activities.js";
import analyticsRouter from "./analytics.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/workspaces", workspacesRouter);
router.use("/workspaces/:workspaceId/clients", clientsRouter);
router.use("/workspaces/:workspaceId", activitiesRouter);
router.use("/workspaces/:workspaceId/analytics", analyticsRouter);

export default router;
