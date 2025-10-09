import rateLimit from "express-rate-limit";

export const aadhaarVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
