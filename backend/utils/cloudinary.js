import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env as early as possible so this module sees the variables at import time
dotenv.config();

// If Cloudinary envs are still missing, try loading backend/.env relative to this file
function ensureCloudinaryEnv() {
  const has = () => !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  if (has()) return;
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const backendEnvPath = path.resolve(__dirname, '../.env');
    dotenv.config({ path: backendEnvPath });
  } catch (_) {
    // ignore
  }
}

ensureCloudinaryEnv();

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  // Don't throw to avoid crashing the app; the upload route will validate and respond clearly.
  // This warning helps diagnose missing configuration during local/dev.
  console.warn(
    "[cloudinary] Missing env vars: " +
      [
        !CLOUDINARY_CLOUD_NAME && 'CLOUDINARY_CLOUD_NAME',
        !CLOUDINARY_API_KEY && 'CLOUDINARY_API_KEY',
        !CLOUDINARY_API_SECRET && 'CLOUDINARY_API_SECRET',
      ]
        .filter(Boolean)
        .join(', ')
  );
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

export default cloudinary;
