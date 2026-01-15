import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import identityRoutes from "./routes/identityRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import schoolRoutes from "./routes/schoolRoutes.js";
import schoolsPortal from "./routes/portal/schools.js";
import studentsPortal from "./routes/portal/students.js";
import adminsPortal from "./routes/portal/admins.js";
import adminAuthRoutes from "./routes/portal/adminAuthRoutes.js";
import studentAuthRoutes from "./routes/studentAuthRoutes.js";
import serverAdminRoutes from "./routes/portal/serverAdminRoutes.js";
import schoolAdminRoutes from "./routes/portal/schoolAdminRoutes.js";
import enhancedProfileRoutes from "./routes/enhancedProfileRoutes.js";
import studentProfileRoutes from "./routes/studentProfileRoutes.js";
import studentNetworkRoutes from "./routes/portal/studentNetworkRoutes.js";
import studentProgressRoutes from "./routes/portal/studentProgressRoutes.js";
import studentInstitutionRoutes from "./routes/portal/studentInstitutionRoutes.js";
import studentQuizRoutes from "./routes/portal/studentQuizRoutes.js";
import mentorAuthRoutes from "./routes/mentorAuthRoutes.js";
import sponsorAuthRoutes from "./routes/sponsorAuthRoutes.js";
import sponsorRoutes from "./routes/sponsorRoutes.js";
import adminSponsorRoutes from "./routes/adminSponsorRoutes.js";
import studentSponsorshipRoutes from "./routes/studentSponsorshipRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import postsRoutes from "./routes/postsRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import libraryRoutes from "./routes/libraryRoutes.js";
import institutionRoutes from "./routes/institutionRoutes.js";
import feesRoutes from "./routes/feesRoutes.js";
import Admin from "./models/Admin.js";
import bcrypt from "bcryptjs";
import School from "./models/School.js";
import Resource from "./models/Resource.js";
import cloudinary from "./utils/cloudinary.js";



console.log("✅ authRoutes mounted on /api/auth");



dotenv.config();
const app = express();

// Validate essential env so we don't crash mid-request and return HTML error pages
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"]; // JWT_EXPIRES_IN is optional
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k] || String(process.env[k]).trim() === "");
if (missingEnv.length) {
  console.error(`Missing required env: ${missingEnv.join(", ")}`);
  console.error("Set these in Railway -> Backend service -> Variables (see backend/.env.example).");
  // Abort startup so clients don't hit partially configured server
  process.exit(1);
}

// CORS configuration to support Vite dev servers and optional custom origin(s)
// WEB_ORIGIN      - single origin (e.g. https://your-frontend.up.railway.app)
// WEB_ORIGIN_LIST - comma-separated list of origins
const extraOrigins = (process.env.WEB_ORIGIN_LIST || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  process.env.WEB_ORIGIN,
  ...extraOrigins,
]
  .filter(Boolean)
  .map((o) => o.replace(/\/$/, ""));

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow curl/postman
    const normalizedOrigin = (origin || '').replace(/\/$/, '');
    const allowDevTunnel = normalizedOrigin.includes('.devtunnels.ms');
    let originHost = '';
    try { originHost = new URL(normalizedOrigin).hostname; } catch { originHost = ''; }
    // Be permissive with Railway origins to avoid preflight failures between services
    const allowRailway = /\.up\.railway\.app$/i.test(originHost) || process.env.ALLOW_RAILWAY_ORIGINS === 'true';
    // Allow LAN-dev Vite served from 192.168.x.x:5173 (mobile testing)
    const isLanDev192 = /^http:\/\/192\.168\.\d+\.\d+:(5173|5174)$/.test(normalizedOrigin);
    const isLanDev10 = /^http:\/\/10\.\d+\.\d+\.\d+:(5173|5174)$/.test(normalizedOrigin);
    // Support 172.16.0.0 – 172.31.255.255 private range (common hotspot / VM networks)
    const isLanDev172 = /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:(5173|5174)$/.test(normalizedOrigin);
    if (allowedOrigins.includes(normalizedOrigin) || allowDevTunnel || allowRailway || isLanDev192 || isLanDev10 || isLanDev172) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

// CORS: handle both simple requests and preflight correctly
app.use(cors({ ...corsOptions, optionsSuccessStatus: 204 }));
// Extra safety: add explicit headers for all responses and reply to OPTIONS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowDevTunnel = origin?.includes?.('.devtunnels.ms');
  const isLanDev192 = typeof origin === 'string' && /^http:\/\/192\.168\.\d+\.\d+:(5173|5174)$/.test(origin);
  const isLanDev10 = typeof origin === 'string' && /^http:\/\/10\.\d+\.\d+\.\d+:(5173|5174)$/.test(origin);
  const isLanDev172 = typeof origin === 'string' && /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:(5173|5174)$/.test(origin);
  let originHost2 = '';
  try { originHost2 = new URL(origin || '').hostname; } catch { originHost2 = ''; }
  const isRailway = /\.up\.railway\.app$/i.test(originHost2);
  if (origin && (allowedOrigins.includes((origin || '').replace(/\/$/, '')) || allowDevTunnel || isRailway || isLanDev192 || isLanDev10 || isLanDev172)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PORT = process.env.PORT || 5000;
app.use(express.json());
// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/auth", studentAuthRoutes);
app.use("/api/students", studentProfileRoutes);
app.use("/api/student", studentNetworkRoutes);
app.use("/api/student", studentProgressRoutes);
app.use("/api/student", studentInstitutionRoutes);
app.use("/api/student", studentQuizRoutes);
app.use("/api/mentor", mentorAuthRoutes);
app.use("/api/sponsor/auth", sponsorAuthRoutes);
app.use("/api/sponsor", sponsorRoutes);
app.use("/api/admin", adminSponsorRoutes);
app.use("/api", studentSponsorshipRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/institution", institutionRoutes); // Institution Copilot domain routes
app.use("/api/fees", feesRoutes);
app.use("/api/identity", identityRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/school", schoolRoutes);
app.use("/api", enhancedProfileRoutes);
// Portal routes
app.use("/api/portal/schools", schoolsPortal);
app.use("/api/portal/students", studentsPortal);
app.use("/api/portal/admins", adminsPortal);
// New admin auth/management routes
app.use("/api/auth", adminAuthRoutes);
app.use("/api/server", serverAdminRoutes);
app.use("/api/school", schoolAdminRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true, env: { jwt: !!process.env.JWT_SECRET, mongo: !!process.env.MONGO_URI } }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    try {
      const c = cloudinary.config();
      console.log(`Cloudinary config: ${c?.cloud_name ? 'present' : 'missing'}`);
    } catch (_) {
      console.log('Cloudinary config: missing');
    }
    // Dev seed schools if none
    (async () => {
      try {
        const count = await School.countDocuments();
        if (count === 0) {
          await School.insertMany([
            { name: "IAb mlnds Central", code: "IAB001", address: "Central Campus", contactEmail: "central@iab.edu" },
            { name: "IAb mlnds North", code: "IAB002", address: "North Campus", contactEmail: "north@iab.edu" },
          ]);
          console.log("Seeded sample schools");
        }
      } catch (e) {
        console.warn("Seed skipped:", e.message);
      }
    })();
    // Seed a few library resources if none
    (async () => {
      try {
        const rc = await Resource.countDocuments();
        if (rc === 0) {
          await Resource.insertMany([
            {
              title: "Physics: Motion Basics",
              description: "An introduction to motion, speed, and acceleration with examples.",
              subject: "Science",
              tags: ["talent", "project"],
              gradeLevels: ["Class 8", "Class 9", "Class 10"],
              url: "https://example.com/physics-motion",
              thumbnail: "",
              popularity: 32,
            },
            {
              title: "Mathematics: Algebra Starter Kit",
              description: "Foundational algebra concepts with practice problems.",
              subject: "Math",
              tags: ["innovation"],
              gradeLevels: ["Class 9", "Class 10"],
              url: "https://example.com/algebra-basics",
              thumbnail: "",
              popularity: 27,
            },
            {
              title: "Science Project Ideas",
              description: "Hands-on science fair projects for students.",
              subject: "Science",
              tags: ["project", "achievement"],
              gradeLevels: ["Class 6", "Class 7", "Class 8"],
              url: "https://example.com/science-projects",
              thumbnail: "",
              popularity: 45,
            },
          ]);
          console.log("Seeded sample library resources");
        }
      } catch (e) {
        console.warn("Resource seed skipped:", e.message);
      }
    })();
    // Seed a server admin if none
    (async () => {
      const count = await Admin.countDocuments({ role: "SERVER" });
      if (count === 0) {
        const email = process.env.SEED_SERVER_ADMIN_EMAIL || "server.admin@example.com";
        const name = process.env.SEED_SERVER_ADMIN_NAME || "Server Admin";
        const pass = process.env.SEED_SERVER_ADMIN_PASSWORD || "ChangeMe@123";
        const passwordHash = await bcrypt.hash(pass, 10);
        await Admin.create({ name, email, passwordHash, role: "SERVER", isTempPassword: false });
        console.log(`Seeded SERVER admin: ${email}`);
      }
    })();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
  });

// Global JSON error handler to avoid sending HTML error pages to the frontend
// Keep this after route registrations
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err?.status || 500;
  const message = err?.message || "Internal Server Error";
  const payload = { error: message };
  if (process.env.NODE_ENV !== "production" && err?.stack) {
    payload.stack = err.stack;
  }
  res.status(status).json(payload);
});
