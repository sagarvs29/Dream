import express from "express";
import { audit } from "../utils/audit.js";
import { setOtp, verifyOtp } from "../utils/otpStore.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

const isProd = process.env.NODE_ENV === "production";
const OTP_TTL_SEC = 300; // 5 minutes
// Simple cooldown between sends per identifier to avoid spam
const cooldown = new Map(); // key -> lastSendTs
function canSendNow(key) {
  const now = Date.now();
  const last = cooldown.get(key) || 0;
  if (now - last < 30_000) return false; // 30s cooldown
  cooldown.set(key, now);
  return true;
}

// Rate limiters
const sendLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const verifyLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

router.post("/sendPhoneOtp", sendLimiter, async (req, res) => {
  const { phone } = req.body || {};
  if (!/^\d{10}$/.test(phone || "")) return res.status(400).json({ message: "Invalid phone" });
  if (!canSendNow(`phone:${phone}`)) return res.status(429).json({ message: "Please wait before requesting another OTP" });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await setOtp(`phone:${phone}`, code, OTP_TTL_SEC);
  audit("OTP.Phone.Send", { phone });
  // Optional: send SMS via Twilio if configured
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      const twilio = (await import("twilio")).default;
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({ to: `+91${phone}`, from: process.env.TWILIO_FROM, body: `Your verification code is ${code}. It expires in 5 minutes.` });
    } catch (e) {
      console.warn("[OTP] SMS send failed:", e?.message || e);
    }
  }
  if (!isProd) {
    console.log(`[DEV] Phone OTP for ${phone}: ${code}`);
    return res.json({ ok: true, otp: code });
  }
  return res.json({ ok: true });
});

router.post("/verifyPhone", verifyLimiter, async (req, res) => {
  const { phone, otp } = req.body || {};
  if (!(await verifyOtp(`phone:${phone}`, otp))) return res.status(400).json({ message: "Invalid OTP" });
  audit("OTP.Phone.Verify", { phone });
  return res.json({ ok: true });
});

router.post("/sendEmailOtp", sendLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) return res.status(400).json({ message: "Invalid email" });
  if (!canSendNow(`email:${email}`)) return res.status(429).json({ message: "Please wait before requesting another OTP" });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await setOtp(`email:${email}`, code, OTP_TTL_SEC);
  audit("OTP.Email.Send", { email });
  // Optional: send email via SendGrid if configured
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
    try {
      const sg = await import("@sendgrid/mail");
      const sgMail = sg.default;
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({ to: email, from: process.env.SENDGRID_FROM, subject: "Your verification code", text: `Your verification code is ${code}. It expires in 5 minutes.` });
    } catch (e) {
      console.warn("[OTP] Email send failed:", e?.message || e);
    }
  }
  if (!isProd) {
    console.log(`[DEV] Email OTP for ${email}: ${code}`);
    return res.json({ ok: true, otp: code });
  }
  return res.json({ ok: true });
});

router.post("/verifyEmail", verifyLimiter, async (req, res) => {
  const { email, otp } = req.body || {};
  if (!(await verifyOtp(`email:${email}`, otp))) return res.status(400).json({ message: "Invalid OTP" });
  audit("OTP.Email.Verify", { email });
  return res.json({ ok: true });
});

export default router;
