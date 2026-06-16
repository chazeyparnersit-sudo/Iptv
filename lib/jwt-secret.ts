const secret = process.env.JWT_SECRET
if (!secret || secret.length < 32) {
  throw new Error("JWT_SECRET no configurado o < 32 chars")
}
export const SECRET = new TextEncoder().encode(secret)
