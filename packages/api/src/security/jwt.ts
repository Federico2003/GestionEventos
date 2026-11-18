import { UnauthorizedError } from '../domain/errors';
import type { UserRole } from '../domain/types';

export interface JwtPayload {
  sub: string;
  userId: string;
  email?: string;
  name?: string;
  role: UserRole;
  jti: string;
  iat: number;
  exp: number;
}

export interface SignTokenInput {
  userId: string;
  role: UserRole;
  email?: string;
  name?: string;
  jti?: string;
  expiresInSeconds?: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PBKDF2_ITERATIONS = 100_000;
const VALID_ROLES: ReadonlyArray<UserRole> = ['admin', 'organizer', 'client'];

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);
  const maxLen = Math.max(bytesA.length, bytesB.length);
  let diff = bytesA.length ^ bytesB.length;
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (bytesA[i] ?? 0) ^ (bytesB[i] ?? 0);
  }
  return diff === 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signJwt(input: SignTokenInput, secret: string): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: input.userId,
    userId: input.userId,
    email: input.email,
    name: input.name,
    role: input.role,
    jti: input.jti ?? crypto.randomUUID(),
    iat: nowSec,
    exp: nowSec + (input.expiresInSeconds ?? 60 * 60 * 8)
  };

  const headerPart = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadPart = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerPart}.${payloadPart}`;

  const key = await importHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  const signaturePart = toBase64Url(new Uint8Array(signatureBuffer));

  return `${signingInput}.${signaturePart}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((p) => !p)) {
    throw new UnauthorizedError('Formato de token JWT inválido');
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const signingInput = `${headerPart}.${payloadPart}`;

  let header: { alg?: unknown; typ?: unknown };
  try {
    header = JSON.parse(decoder.decode(fromBase64Url(headerPart))) as {
      alg?: unknown;
      typ?: unknown;
    };
  } catch {
    throw new UnauthorizedError('Encabezado de token JWT inválido');
  }

  if (header.alg !== 'HS256') {
    throw new UnauthorizedError('Algoritmo JWT no soportado');
  }

  let isValid: boolean;
  try {
    const key = await importHmacKey(secret);
    const sigBytes = fromBase64Url(signaturePart);
    isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      toArrayBuffer(sigBytes),
      encoder.encode(signingInput)
    );
  } catch {
    throw new UnauthorizedError('Firma de token JWT inválida');
  }

  if (!isValid) {
    throw new UnauthorizedError('Firma de token JWT inválida');
  }

  let payload: Partial<JwtPayload>;
  try {
    payload = JSON.parse(decoder.decode(fromBase64Url(payloadPart))) as Partial<JwtPayload>;
  } catch {
    throw new UnauthorizedError('Carga útil de token JWT inválida');
  }

  if (
    typeof payload.userId !== 'string' ||
    !payload.userId ||
    typeof payload.jti !== 'string' ||
    !payload.jti ||
    typeof payload.role !== 'string' ||
    !VALID_ROLES.includes(payload.role as UserRole)
  ) {
    throw new UnauthorizedError('Reclamos requeridos del token JWT inválidos');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= nowSec) {
    throw new UnauthorizedError('El token JWT ha expirado');
  }

  return payload as JwtPayload;
}

async function derivePbkdf2Hash(
  password: string,
  saltBytes: Uint8Array,
  iterations: number
): Promise<string> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(saltBytes),
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );
  return toBase64Url(new Uint8Array(derivedBits));
}

export async function hashPassword(password: string, customSaltBytes?: Uint8Array): Promise<string> {
  const saltBytes = customSaltBytes ?? crypto.getRandomValues(new Uint8Array(16));
  const derivedHash = await derivePbkdf2Hash(password, saltBytes, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(saltBytes)}$${derivedHash}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length === 4 && parts[0] === 'pbkdf2') {
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 10_000) {
      return false;
    }
    try {
      const saltBytes = fromBase64Url(parts[2]);
      const computedHash = await derivePbkdf2Hash(password, saltBytes, iterations);
      return timingSafeEqualStr(computedHash, parts[3]);
    } catch {
      return false;
    }
  }

  // Compatibilidad con hashes heredados sha256$<salt>$<hash>
  if (parts.length === 3 && parts[0] === 'sha256') {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${parts[1]}:${password}`));
    const computed = `sha256$${parts[1]}$${toBase64Url(new Uint8Array(digest))}`;
    return timingSafeEqualStr(computed, storedHash);
  }

  return false;
}
