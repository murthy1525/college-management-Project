import { Queryable } from "../../config/db";
import { nextPublicId } from "../../utils/idGenerator";
import { Department } from "./departments.types";

const SELECT_COLUMNS = "id, public_id, name, is_active, created_at, updated_at";

export async function findAll(db: Queryable, includeInactive: boolean): Promise<Department[]> {
  const { rows } = await db.query(
    `SELECT ${SELECT_COLUMNS} FROM departments
     ${includeInactive ? "" : "WHERE is_active = true"}
     ORDER BY name ASC`
  );
  return rows;
}

export async function findById(db: Queryable, id: string | number): Promise<Department | null> {
  const { rows } = await db.query(`SELECT ${SELECT_COLUMNS} FROM departments WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function insert(
  db: import("pg").PoolClient,
  data: { name: string }
): Promise<Department> {
  const publicId = await nextPublicId(db, "department", "DEPT");
  const { rows } = await db.query(
    `INSERT INTO departments (public_id, name) VALUES ($1, $2) RETURNING ${SELECT_COLUMNS}`,
    [publicId, data.name]
  );
  return rows[0];
}

export async function updateName(
  db: Queryable,
  id: string | number,
  name: string
): Promise<Department | null> {
  const { rows } = await db.query(
    `UPDATE departments SET name = $1, updated_at = now() WHERE id = $2 RETURNING ${SELECT_COLUMNS}`,
    [name, id]
  );
  return rows[0] ?? null;
}

export async function updateStatus(
  db: Queryable,
  id: string | number,
  isActive: boolean
): Promise<Department | null> {
  const { rows } = await db.query(
    `UPDATE departments SET is_active = $1, updated_at = now() WHERE id = $2 RETURNING ${SELECT_COLUMNS}`,
    [isActive, id]
  );
  return rows[0] ?? null;
}
