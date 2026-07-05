import argon2 from 'argon2';

export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$OZdAdl8iEuXAYZ4ER12eQA$TfT3hd/xahfFPkFf7m7rREB3rwl/JRRweJSzoV869qc';

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
