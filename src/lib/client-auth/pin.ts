import bcrypt from "bcryptjs";

const ROUNDS = 10;

/** PIN à 4 chiffres (1000–9999 pour éviter 0000). */
export function generatePinCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export function isValidLoginId(loginId: string): boolean {
  const id = loginId.trim().toLowerCase();
  return /^[a-z0-9]{2,4}-\d{3,4}$/.test(id) || /^\d{4,8}$/.test(id);
}
