import { createClient } from "redis";

// Redis-backed OTP store with in-memory fallback
const memory = new Map(); // key -> { code, expiresAt }
let redisClient = null;
let redisReady = false;

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;

async function ensureRedis() {
  if (!REDIS_URL || redisClient) return redisReady;
  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on("error", (err) => {
      console.warn("Redis error:", err?.message);
      redisReady = false;
    });
    await redisClient.connect();
    redisReady = true;
  } catch (e) {
    console.warn("Redis not available, using in-memory OTP store.");
    redisReady = false;
  }
  return redisReady;
}

export async function setOtp(key, code, ttlSec = 300) {
  const useRedis = await ensureRedis();
  if (useRedis) {
    await redisClient.set(key, code, { EX: ttlSec });
  } else {
    memory.set(key, { code, expiresAt: Date.now() + ttlSec * 1000 });
  }
}

export async function verifyOtp(key, code) {
  const useRedis = await ensureRedis();
  if (useRedis) {
    const stored = await redisClient.get(key);
    if (!stored || stored !== String(code)) return false;
    await redisClient.del(key);
    return true;
  }
  const rec = memory.get(key);
  if (!rec) return false;
  const ok = rec.code === String(code) && Date.now() < rec.expiresAt;
  if (ok) memory.delete(key);
  return ok;
}
