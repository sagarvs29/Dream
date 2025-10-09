import crypto from "crypto";

export function hashAadhaar(aadhaarNumber) {
  const salt = process.env.AADHAAR_SALT || "rotate-me";
  return crypto.createHash("sha256").update(String(aadhaarNumber) + salt).digest("hex");
}

export function makeStudentId() {
  const year = new Date().getFullYear();
  const rnd = Math.floor(100000 + Math.random() * 900000);
  return `STU${year}${rnd}`;
}
