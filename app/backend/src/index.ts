import express, { Request, Response, NextFunction } from "express";
import { pool } from "./db";
import { redis } from "./redis";
import { authRouter, requireAuth } from "./auth";
import { itemsRouter, UPLOAD_DIR } from "./items";
import { offersRouter } from "./offers";
import { messagesRouter } from "./messages";

const app = express();
app.use(express.json());

//health check
app.get("/health", async (_req,res)=>{
    try{
        await pool.query("SELECT 1");
        await redis.ping();
        res.json({ status: "ok" });

    }catch{
        res.status(503).json({ error: "error" });
    }
});

app.use("/auth", authRouter);
app.use("/items", itemsRouter);
app.use("/offers", offersRouter);
app.use("/offers", messagesRouter);

// samo za development, na VM uploads mapo servira NGINX, zahtevek do APi ne pride
app.use("/uploads", express.static(UPLOAD_DIR));

//test avtentikacije, dobimo uporabnikove podatke
app.get("/me", requireAuth, async (req, res)=>{
    const r = await pool.query("SELECT id, email, display_name FROM users where id = $1", [(req as any).userId]);
    res.json(r.rows[0]);
});

//logamo napake da strežnik ne krepne
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(400).json({ error: "Napaka strežnika"});
});

async function main(){
    await redis.connect();
    const port = Number(process.env.PORT ?? 3000);
    app.listen(port, "127.0.0.1", (err?: Error) => {
        if(err) {
            console.error("Ne morem odpreti porta:", err.message);
            process.exit(1);
        }
        console.log(`API posluša na 127.0.0.1:${port}`);
    });
}
main();