import jwt from "jsonwebtoken";

export function requireAdmin(req, res, next) {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.role) return res.status(403).json({ message: "Forbidden" });
    req.admin = decoded; // { sub, role, schoolId? }
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireServerAdmin(req, res, next) {
  requireAdmin(req, res, (err) => {
    if (err) return;
    if (req.admin.role !== "SERVER") return res.status(403).json({ message: "Server admin only" });
    next();
  });
}

export function requireSchoolAdmin(req, res, next) {
  requireAdmin(req, res, (err) => {
    if (err) return;
    if (req.admin.role !== "SCHOOL" || !req.admin.schoolId) return res.status(403).json({ message: "School admin only" });
    next();
  });
}
