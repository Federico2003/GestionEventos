import { signJwt, type SignTokenInput } from '../../src/security/jwt';

export async function signTestToken(input: SignTokenInput, secret: string): Promise<string> {
  return signJwt(input, secret);
}
