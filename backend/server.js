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
import mentorAuthRoutes from "./routes/mentorAuthRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import postsRoutes from "./routes/postsRoutes.js";
import Admin from "./models/Admin.js";
import bcrypt from "bcryptjs";
import School from "./models/School.js";
import cloudinary from "./utils/cloudinary.js";



console.log("✅ authRoutes mounted on /api/auth");



dotenv.config();
const app = express();

// CORS configuration to support Vite dev servers and optional custom origin
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  process.env.WEB_ORIGIN
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow curl/postman
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
// Ensure preflight requests succeed with 204
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

const PORT = process.env.PORT || 5000;
app.use(express.json());
// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/auth", studentAuthRoutes);
app.use("/api/students", studentProfileRoutes);
app.use("/api/student", studentNetworkRoutes);
app.use("/api/mentor", mentorAuthRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/posts", postsRoutes);
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

app.get("/api/health", (req, res) => res.json({ ok: true }));

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
