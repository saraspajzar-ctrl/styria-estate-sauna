import "server-only";
import { createHmac, randomInt } from "crypto";

// Crockford-ish alphabet with ambiguous characters (0/O, 1/I/L) removed, so
// codes are easy to read aloud or type from a phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUP_LENGTH = 4;
const GROUPS = 2;

/** Generates a random, human-friendly access code, e.g. "7KPM-Q2XD". */
export function generateAccessCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LENGTH; i++) {
      group += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

function pepper(): string {
  const value = process.env.ACCESS_CODE_PEPPER;
  if (!value) throw new Error("ACCESS_CODE_PEPPER is not set.");
  return value;
}

/**
 * Deterministic keyed hash (HMAC-SHA256) of an access code, used as the
 * lookup key in `stays.access_code_hash`. Deterministic (unlike bcrypt) so a
 * candidate code can be looked up with a single indexed equality query
 * instead of iterating every stay row. Security comes from the code's
 * entropy (~41 bits across 8 alphabet-32 characters) plus the server-only
 * pepper, which never reaches the database — a leaked hash table alone does
 * not let an attacker recover a code or forge a new valid hash.
 */
export function hashAccessCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  return createHmac("sha256", pepper()).update(normalized).digest("hex");
}

export function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase();
}
