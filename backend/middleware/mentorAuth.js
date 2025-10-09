import jwt from "jsonwebtoken";
import Teacher from "../models/Teacher.js";

export async function requireMentor(req, res, next) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "MENTOR") return res.status(403).json({ message: "Mentor token required" });
    const me = await Teacher.findById(decoded.sub).select("-passwordHash");
    if (!me || !me.active) return res.status(403).json({ message: "Mentor not active" });
    req.mentor = me;
    next();
  } catch (e) {
    res.status(401).json({ message: "Invalid token" });
  }
}
