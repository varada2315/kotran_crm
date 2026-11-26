import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, isDatabaseEnabled } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticateToken, generateToken, AuthRequest } from "../middleware/auth.js";
import { devStore, ensureDevStoreReady, nextUserId, persistDevStore } from "../dev-store.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Bad Request", message: "name, email, and password are required" });
      return;
    }

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const existing = devStore.users.find((user) => user.email === email);
      if (existing) {
        res.status(400).json({ error: "Bad Request", message: "Email already registered" });
        return;
      }

      const hashed = await bcrypt.hash(password, 10);
      const user = {
        id: nextUserId(),
        name,
        email,
        password: hashed,
        createdAt: new Date(),
      };
      devStore.users.push(user as typeof devStore.users[number]);
      await persistDevStore();
      const token = generateToken(user.id);
      res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: "user" } });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Bad Request", message: "Email already registered" });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ name, email, password: hashed }).returning();
    const token = generateToken(user.id);

    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Bad Request", message: "email and password are required" });
      return;
    }

    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const user = devStore.users.find((entry) => entry.email === email) as (typeof devStore.users)[number] | undefined;
      if (!user) {
        res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
        return;
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
        return;
      }

      const token = generateToken(user.id);
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role || "user" } });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!isDatabaseEnabled) {
      await ensureDevStoreReady();
      const user = devStore.users.find((entry) => entry.id === req.userId);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role || "user" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// --- Admin User Management ---

router.get("/users", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUser = isDatabaseEnabled 
      ? (await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1))[0]
      : devStore.users.find(u => u.id === req.userId);

    if (!currentUser || currentUser.role !== "admin") {
      res.status(403).json({ error: "Forbidden", message: "Admin access required" });
      return;
    }

    const users = isDatabaseEnabled 
      ? await db.select().from(usersTable)
      : devStore.users;

    res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/users", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentUser = isDatabaseEnabled 
      ? (await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1))[0]
      : devStore.users.find(u => u.id === req.userId);

    if (!currentUser || currentUser.role !== "admin") {
      res.status(403).json({ error: "Forbidden", message: "Admin access required" });
      return;
    }

    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Bad Request", message: "name, email, and password are required" });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);

    if (!isDatabaseEnabled) {
      const existing = devStore.users.find((user) => user.email === email);
      if (existing) {
        res.status(400).json({ error: "Bad Request", message: "Email already registered" });
        return;
      }

      const user = {
        id: nextUserId(),
        name,
        email,
        password: hashed,
        role: role || "user",
        createdAt: new Date(),
      };
      devStore.users.push(user as any);
      await persistDevStore();
      res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Bad Request", message: "Email already registered" });
      return;
    }

    const [newUser] = await db.insert(usersTable).values({ 
      name, 
      email, 
      password: hashed, 
      role: role || "user" 
    }).returning();

    res.status(201).json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
