import { Pool } from "pg";
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// veljaven id za stolpec SERIAL (int4)
export const isId = (n: unknown): n is number =>
    Number.isInteger(n) && (n as number) > 0 && (n as number) <= 2147483647;
