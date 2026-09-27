import "server-only";
import { db } from "./db";
import { encryptSecret } from "./crypto";
import { checkKey, keyMode, PROVIDERS, type Provider } from "./gateways";

export async function saveGateway(businessId: string, input: { provider: Provider; secretKey: string; publicKey?: string | null; webhookHash?: string | null }) {
  const secretKey = input.secretKey.trim();
  const mode = keyMode(input.provider, secretKey);
  if (!mode) {
    return {
      ok: false as const,
      error: input.provider === "PAYSTACK"
        ? "Paystack secret keys start with sk_live_ (or sk_test_ for testing). Check you copied the secret key, not the public one."
        : "Flutterwave secret keys start with FLWSECK- (or FLWSECK_TEST- for testing).",
    };
  }
  const check = await checkKey(input.provider, secretKey);
  if (!check.ok) return { ok: false as const, error: check.error };
  const data = {
    publicKey: input.publicKey?.trim() || null,
    secretKeyEnc: encryptSecret(secretKey),
    webhookHashEnc: input.webhookHash?.trim() ? encryptSecret(input.webhookHash.trim()) : null,
    mode,
    enabled: true,
    verifiedAt: new Date(),
  };
  await db.gateway.upsert({
    where: { businessId_provider: { businessId, provider: input.provider } },
    create: { businessId, provider: input.provider, ...data },
    update: data,
  });
  return { ok: true as const, mode, name: PROVIDERS[input.provider].name };
}

export async function addBankAccount(businessId: string, a: { bankName: string; accountNumber: string; accountName: string }) {
  const count = await db.bankAccount.count({ where: { businessId } });
  return db.bankAccount.create({ data: { businessId, ...a, isDefault: count === 0 } });
}

export const NUBAN = /^\d{10}$/;
