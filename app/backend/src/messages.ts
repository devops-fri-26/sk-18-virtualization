import { Router } from "express";
import { pool } from "./db";
import { requireAuth } from "./auth";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);


// vrne stanje ponudbe če je uporabnik udeležen 
async function getOfferIfParticipant(offerId: number, userId: number){
    const r = await pool.query(
        `SELECT o.status
        FROM offers o
        JOIN items oi ON oi.id = o.offered_item_id
        JOIN items RI ON ri.id = o.requested_item_id
        WHERE o.id = $1 AND (oi.owner_id = $2 OR ri.owner_id = $2)`,
        [offerId, userId]
    );
    return r.rows[0] as { status: string } | undefined;
}

// sporočila ponudbe ?after=<id> vrne samo novejša
messagesRouter.get("/:id/messages", async (req, res) => {
    const offerId = Number(req.params.id);
    const after = req.query.after === undefined ? 0 : Number(req.query.after);
    if(!Number.isInteger(offerId) || !Number.isInteger(after)){
        return res.status(400).json({ error: "Neveljaven id" });
    }

    if(!(await getOfferIfParticipant(offerId, (req as any).userId))){
        return res.status(404).json({ error: "Ponudba ne obstaja ali niste del nje"});
    }

    const r = await pool.query(
        `SELECT m.id, m.sender_id, u.display_name AS sender_name, m.body, m.created_at
        FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.offer_id = $1 AND m.id > $2
        ORDER BY m.id`,
        [offerId, after]
    );
    res.json(r.rows);
});

// novo sporočilo
messagesRouter.post("/:id/messages", async (req, res) => {
    const offerId = Number(req.params.id);
    const { body } = req.body ?? {};
    if(!Number.isInteger(offerId)) return res.status(400).json({ error: "Neveljaven id" });
    if(typeof body !== "string" || !body.trim() || body.length >1000){
        return res.status(400).json({ error: "Sporočilo mora imeti med 1 in 1000 znakov" });
    }

    const userId = (req as any).userId;
    const offer = await getOfferIfParticipant(offerId, userId);
    if(!offer) return res.status(404).json({ error: "Ponudba ne obstaja ali niste del nje"});
    if(offer.status === "rejected"){
        return res.status(409).json({ error: "Ponudba je zavrnjena, pogovor je zaprt" });
    }

    const r = await pool.query(
        "INSERT INTO messages (offer_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id, sender_id, body, created_at",
        [offerId, userId, body.trim()]
    );
    res.status(201).json(r.rows[0]);
});