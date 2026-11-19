"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = require("./db");
const redis_1 = require("./redis");
const auth_1 = require("./auth");
const app = (0, express_1.default)();
app.use(express_1.default.json());
//health check
app.get("/health", async (_req, res) => {
    try {
        await db_1.pool.query("SELECT 1");
        await redis_1.redis.ping();
        res.json({ status: "ok" });
    }
    catch {
        res.status(503).json({ error: "error" });
    }
});
app.use("/auth", auth_1.authRouter);
//test avtentikacije, dobimo uporabnikove podatke
app.get("/me", auth_1.requireAuth, async (req, res) => {
    const r = await db_1.pool.query("SELECT id, email, display_name FROM users where id = $1", [req.userId]);
    res.json(r.rows[0]);
});
//logamo napake da strežnik ne krepne
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Napaka strežnika" });
});
async function main() {
    await redis_1.redis.connect();
    const port = Number(process.env.PORT ?? 3000);
    app.listen(port, "127.0.0.1", (err) => {
        if (err) {
            console.error("Ne morem odpreti porta:", err.message);
            process.exit(1);
        }
        console.log(`API posluša na 127.0.0.1:${port}`);
    });
}
main();
