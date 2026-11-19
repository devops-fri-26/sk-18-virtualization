import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool } from "./db";
import { redis } from "./redis";

const TTL = Number(process.env.SESSTION_TTL_SECONDS ?? 86400);
const sessionKey = (token: string) => 'session:${token}';


// branje uporabnika iz authorizationa prek redisa
export async function requireAuth(req: Request, res: Response, next: NextFunction){
    const token = req.headers.authorization?.replace("Bearer ", "");
    if(!token) return res.status(401).json({ error: "Manjka žeton" });
    const userId = await redis.get(sessionKey(token));
    if(!userId) return res.status(401).json({ error: "Neveljavna ali potekla seja" });
    (req as any).userId = Number(userId);
    (req as any).token = token;
    next();
}

export const authRouter = Router();

authRouter.post("/register", async (req, res)=>{
    //console.log("register body:", req.body);
    const { email, password, displayName }= req.body ?? {};
    if(typeof email !== "string" || !email.includes("@")||
        typeof password !== "string" || password.length < 8 ||
        typeof displayName !== "string" || !displayName.trim()){
            return res.status(400).json({ error: "Neveljavni podatki, geslo mora bit dolgo vsaj 8 znakov"});
        }
    const hash = await bcrypt.hash(password, 10);
    try{
        const r = await pool.query(
            "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name",
            [email.toLowerCase(),hash, displayName.trim()]
        );
        res.status(201).json(r.rows[0]);
    } catch (e: any) {
        if(e.code === "23505") return res.status(409).json({ error: "Email je že registriran" });
        throw e;
    }
});


authRouter.post("/login", async (req, res) => {
    const {email, password} = req.body ?? {};
    if(typeof email !== "string" || typeof password !== "string"){
        return res.status(400).json({ error: "Neveljavni podatki" });
    }
    const r = await pool.query("SELECT id, password_hash FROM users WHERE email = $1", [email.toLowerCase()]);
    const user = r.rows[0];
    if(!user || !(await bcrypt.compare(password, user.password_hash))){
        return res.status(401).json({ error: "Napačen mail ali geslo "});
    }
    const token = crypto.randomBytes(32).toString("hex");
    await redis.set(sessionKey(token), String(user.id), { EX:TTL });
    res.json({ token })
});

authRouter.post("/logout", requireAuth, async (req, res)=>{
    await redis.del(sessionKey((req as any).token));
    res.status(204).end();
})
