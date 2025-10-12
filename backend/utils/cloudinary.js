import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load .env as early as possible so this module sees the variables at import time
dotenv.config();

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
