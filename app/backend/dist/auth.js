"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
exports.requireAuth = requireAuth;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("./db");
const redis_1 = require("./redis");
const TTL = Number(process.env.SESSTION_TTL_SECONDS ?? 86400);
const sessionKey = (token) => 'session:${token}';
// branje uporabnika iz authorizationa prek redisa
async function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token)
        return res.status(401).json({ error: "Manjka žeton" });
    const userId = await redis_1.redis.get(sessionKey(token));
    if (!userId)
        return res.status(401).json({ error: "Neveljavna ali potekla seja" });
    req.userId = Number(userId);
    req.token = token;
    next();
}
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/register", async (req, res) => {
    //console.log("register body:", req.body);
    const { email, password, displayName } = req.body ?? {};
    if (typeof email !== "string" || !email.includes("@") ||
        typeof password !== "string" || password.length < 8 ||
        typeof displayName !== "string" || !displayName.trim()) {
        return res.status(400).json({ error: "Neveljavni podatki, geslo mora bit dolgo vsaj 8 znakov" });
    }
    const hash = await bcryptjs_1.default.hash(password, 10);
    try {
        const r = await db_1.pool.query("INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name", [email.toLowerCase(), hash, displayName.trim()]);
        res.status(201).json(r.rows[0]);
    }
    catch (e) {
        if (e.code === "23505")
            return res.status(409).json({ error: "Email je že registriran" });
        throw e;
    }
});
exports.authRouter.post("/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Neveljavni podatki" });
    }
    const r = await db_1.pool.query("SELECT id, password_hash FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = r.rows[0];
    if (!user || !(await bcryptjs_1.default.compare(password, user.password_hash))) {
        return res.status(401).json({ error: "Napačen mail ali geslo " });
    }
    const token = crypto_1.default.randomBytes(32).toString("hex");
    await redis_1.redis.set(sessionKey(token), String(user.id), { EX: TTL });
    res.json({ token });
});
exports.authRouter.post("/logout", requireAuth, async (req, res) => {
    await redis_1.redis.del(sessionKey(req.token));
    res.status(204).end();
});
