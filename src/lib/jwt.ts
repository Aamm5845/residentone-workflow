import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface ClientApprovalTokenPayload {
  versionId: string;
  clientEmail: string;
  clientName: string;
  projectId: string;
  exp?: number;
}

export function generateClientApprovalToken(payload: Omit<ClientApprovalTokenPayload, 'exp'>): string {
  return jwt.sign(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days expiration
    },
    JWT_SECRET
  );
}

export function verifyClientApprovalToken(token: string): ClientApprovalTokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as ClientApprovalTokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = jwt.decode(token) as any;
    if (!payload || !payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}
