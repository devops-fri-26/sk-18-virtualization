import { Router } from "express";
import { pool, isId } from "./db";
import { requireAuth } from "./auth";

export const offersRouter = Router();
offersRouter.use(requireAuth);

//nova ponudba
offersRouter.post("/", async (req, res) => {
    const { offeredItemId, requestedItemId }= req.body ?? {};
    if(!isId(offeredItemId) || !isId(requestedItemId) || offeredItemId === requestedItemId){
        return res.status(400).json({ error: "Izbrati morate 2 različna izdelka" });
    }
    const userId = (req as any).userId;

    const r = await pool.query("SELECT id, owner_id, status FROM items WHERE id IN ($1, $2)",
        [offeredItemId, requestedItemId]
    );

    const offered = r.rows.find((i) => i.id === offeredItemId);
    const requested = r.rows.find((i) => i.id === requestedItemId);

    if(!offered || !requested) return res.status(404).json({ error: "Izdelek ne obstaja" });
    if(offered.owner_id !== userId) return res.status(403).json({ error: "Ponudite lahko samo svoj izdelek" });
    if(requested.owner_id === userId) return res.status(400).json({ error: "Ne morete zahtevati svojega izdelka" });
    if(offered.status !== "available" || requested.status !== "available"){
        return res.status(409).json({ error: "Izdelek ni več na voljo"});
    }

    try{
        const ins = await pool.query(
            "INSERT INTO offers (offered_item_id, requested_item_id) VALUES ($1, $2) RETURNING *",
            [offeredItemId, requestedItemId]
        );
        res.status(201).json(ins.rows[0]);
    }catch (e:any){
        if(e.code == "23505") return res.status(409).json({ error: "Ta ponudba že obstaja" });
        throw e;
    }
});

//moje ponudbe  ?box=received ali ?box=sent
offersRouter.get("/", async (req, res) => {
    const sent = req.query.box === "sent";
    const me = sent ? "oi.owner_id" : "ri.owner_id";
    const other = sent ? "ri.owner_id" : "oi.owner_id";

    const r = await pool.query(
        `SELECT o.id, o.status, o.created_at,
                oi.id AS offered_item_id, oi.title as offered_title, oi.image_path AS offered_image,
                ri.id AS requested_item_id, ri.title AS requested_title, ri.image_path AS requested_image,
                u.display_name AS other_user
        FROM offers o
        JOIN items oi ON oi.id = o.offered_item_id
        JOIN items ri ON ri.id = o.requested_item_id
        JOIN users u ON u.id = ${other}
        WHERE ${me} = $1
        ORDER by o.created_at DESC`,
        [(req as any).userId]
    );
    res.json(r.rows);
})

offersRouter.patch("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body ?? {};
    if(!isId(id) || (status !== "accepted" && status !== "rejected")){
        return res.status(400).json({ error: "Neveljaven id ali status" });
    }

    const userId = (req as any).userId;

    if(status === "rejected"){
        const r = await pool.query(`
            UPDATE offers o SET status = 'rejected'
            FROM items ri
            WHERE o.id = $1 AND ri.id = o.requested_item_id AND ri.owner_id = $2 AND o.status = 'pending'
            RETURNING o.id, o.status`, [id, userId]);
        if(r.rowCount === 0){
            return res.status(404).json({ error: "Ponudba ne obstaja, je že zaključena, ali ni navezana na vas" });
        }
        return res.json(r.rows[0]);
    }

    const o = await pool.query(
        `SELECT o.offered_item_id, o.requested_item_id
        FROM offers o JOIN items RI ON ri.id = o.requested_item_id
        WHERE o.id = $1 AND ri.owner_ID = $2`,
        [id, userId]
    );
    if(!o.rows[0]){
        return res.status(404).json({ error: "Ponudba ne obstaja ali ni za vas"});
    }
    const ids = [o.rows[0].offered_item_id, o.rows[0].requested_item_id];

    //transakcija za zapis
    const client = await pool.connect();
    try{
        await client.query("BEGIN");

        //zaklenemo oba izdelka po vrsti id, da se ne zakleneta med sabo
        const items = await client.query(
            "SELECT status FROM items WHERE id = ANY($1) ORDER BY id FOR UPDATE", [ids]
        );

        //ponudbo sprejmemo če čaka
        const acc = await client.query(
            "UPDATE offers SET status = 'accepted' WHERE id = $1 AND status = 'pending' RETURNING id", [id]
        );

        if(items.rowCount !== 2 || items.rows.some((i) => i.status !== "available") || acc.rowCount === 0){
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Ponudba ni več veljavna" });
        }

        //zamenjamo status obem izdelkom
        await client.query("UPDATE items SET status = 'traded' WHERE id = ANY($1)", [ids]);

        //druge čakajoče ponudbe postanejo brezpredmetne
        await client.query(
            `UPDATE offers SET status = 'rejected'
            WHERE status = 'pending' AND (offered_item_id = ANY($1) OR requested_item_id = ANY($1))`, [ids]
        );

        await client.query("COMMIT");
        res.json({ id, status:"accepted" });
    }catch(e){
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
});