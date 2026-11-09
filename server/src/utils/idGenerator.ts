import { PoolClient } from "pg";

const PAD_WIDTH_DEFAULT = 3;

/** Allocates the next sequential public_id for an entity type/year, e.g. STU2026001. */
export async function nextPublicId(
  client: PoolClient,
  entityType: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();

  // On first insert for this (entity_type, year), next_value=1 IS the allocated
  // sequence number. On conflict, bumping next_value by 1 and returning it also
  // IS the allocated number for this call — no extra bookkeeping needed.
  const { rows } = await client.query(
    `INSERT INTO id_sequences (entity_type, year, prefix, pad_width, next_value)
     VALUES ($1, $2, $3, $4, 1)
     ON CONFLICT (entity_type, year)
     DO UPDATE SET next_value = id_sequences.next_value + 1
     RETURNING next_value, pad_width`,
    [entityType, year, prefix, PAD_WIDTH_DEFAULT]
  );

  const allocated: number = rows[0].next_value;
  const padWidth: number = rows[0].pad_width;
  const sequence = String(allocated).padStart(padWidth, "0");
  return `${prefix}${year}${sequence}`;
}
