CREATE TABLE IF NOT EXISTS users(
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items(
    id              SERIAL PRIMARY KEY,
    owner_id        INTEGER NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    category        TEXT NOT NULL CHECK (category IN ('oblacila', 'elektronika','knjige','sport','dom')),
    image_path      TEXT,
    status          TEXT NOT NULL DEFAULT 'available' CHECK (status in ('available', 'traded')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offers(
    id                  SERIAL  PRIMARY KEY,
    offered_item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    requested_item_id   INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status in ('pending', 'accepted', 'rejected')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (offered_item_id <> requested_item_id)
);

CREATE TABLE IF NOT EXISTS messages(
    id                  SERIAL PRIMARY KEY,
    offer_id            INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    sender_id           INTEGER NOT NULL REFERENCES users(id),
    body                TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS items_category_idx ON items(category);
CREATE INDEX IF NOT EXISTS items_owner_idx ON items(owner_id);
CREATE INDEX IF NOT EXISTS offers_offered_idx ON offers(offered_item_id);
CREATE INDEX IF NOT EXISTS offers_requested_idx ON offers(requested_item_id);
CREATE INDEX IF NOT EXISTS messages_offer_idx ON messages(offer_id);
