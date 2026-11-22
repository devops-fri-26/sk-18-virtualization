import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { pool, isId } from "./db";
import { requireAuth } from "./auth";


const CATEGORIES = ["oblacila", "elektronika", "knjige", "sport", "dom"];
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive:true });

// določanje končnice za varnost
const EXT: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
};

const upload = multer({
    storage:multer.diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex")+ EXT[file.mimetype]),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
        file.mimetype in EXT ? cb(null, true) : cb(new Error("Dovoljene so samo slike JPEG, PNG ali WEBP")),
});

function handleUpload(req: Request, res: Response, next: NextFunction){
    upload.single("image")(req,res, (err:unknown) => {
        if(err){
            const msg = err instanceof Error ? err.message : "Napaka pri nalaganju";
            return res.status(400).json({ error: msg });
        }
        next();
    });
}

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

// seznam izdelkov z filtri category in iskanjem
itemsRouter.get("/", async (req, res) => {
    const { category, q } = req.query;
    const where = ["i.status = 'available'"];
    const params: string[] = [];

    if(typeof category == "string" && category){
        params.push(category);
        where.push(`i.category = $${params.length}`);
    }
    if(typeof q == "string" && q){
        params.push(`%${q}%`);
        where.push(`(i.title ILIKE $${params.length} OR i.description ILIKE $${params.length})`);
    }

    const r = await pool.query(
        `SELECT i.id, i.title, i.category, i.image_path, i.created_at, u.display_name AS owner_name
        FROM items i JOIN users u ON u.id = i.owner_id
        WHERE ${where.join(" AND ")}
        ORDER BY i.created_at DESC`,
        params
    );
    res.json(r.rows);
})

// moji izdelki z statusi in zamenjavami
itemsRouter.get("/mine", async (req, res) => {
    const r = await pool.query(
        `SELECT id, title, description, category, image_path, status, created_at
        FROM items WHERE owner_id = $1 ORDER BY created_at DESC, id DESC`,
        [(req as any).userId]
    );
    res.json(r.rows);
})

// podrobnosti izdelka
itemsRouter.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if(!isId(id)) return res.status(400).json({ error: "Neveljaven id" });

    const r = await pool.query(
        `SELECT i.id, i.owner_id, i.title, i.description, i.category, i.image_path, i.status, i.created_at,
                u.display_name AS owner_name
        FROM items i JOIN users u ON u.id = i.owner_id
        WHERE i.id = $1`,
        [id]
    );
    if(!r.rows[0]) return res.status(404).json({ error: "Izdelek ne obstaja" });
    res.json(r.rows[0]);
});

//nov izdelek z neobvezno sliko
itemsRouter.post("/", handleUpload, async(req, res) => {
    const { title, description="", category } = req.body ?? {};
    const file = req.file;
    if(typeof title !== "string" || !title.trim() || typeof description !=="string" || !CATEGORIES.includes(category)){
        if(file) fs.unlink(file.path, () => {}); //slika je na disku, idelka ne bo
        return res.status(400).json({ error: `Neveljavni podatki (kategorija: ${CATEGORIES.join(", ")})`});
    }

    try {
        const r = await pool.query("INSERT INTO items (owner_id, title, description, category, image_path) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [(req as any).userId, title.trim(), description.trim(), category, file ? `/uploads/${file.filename}` : null]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) {
        if(file) fs.unlink(file.path, () => {}); // izdelek ni nastal, slike ne rabimo
        throw e;
    }
})

// brisanje samo za lastnika in če izdelek ni zamenjan
itemsRouter.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if(!isId(id)) return res.status(400).json({ error: "Neveljaven ID" });

    const r = await pool.query(
        "DELETE FROM items WHERE id = $1 AND owner_id = $2 AND status = 'available' RETURNING image_path",
        [id,  (req as any).userId]
    );
    if(r.rowCount === 0)
        {return res.status(404).json({ error: "Izdelek ne obstaja, ni vaš ali je že zamenjan" });
    }
    const img = r.rows[0].image_path;
    if(img) fs.unlink(path.join(UPLOAD_DIR, path.basename(img)), () => {});
    res.status(204).end();
})