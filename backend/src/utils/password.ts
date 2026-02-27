import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export const hashPassword = async (value: string): Promise<string> =>
  bcrypt.hash(value, SALT_ROUNDS);

export const comparePassword = async (
  plainValue: string,
  hashedValue: string
): Promise<boolean> => bcrypt.compare(plainValue, hashedValue);
