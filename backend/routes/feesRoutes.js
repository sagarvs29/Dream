import express from "express";
import FeePlan from "../models/FeePlan.js";
import Student from "../models/Student.js";
import { requireSchoolAdmin } from "../middleware/adminAuth.js";
import { buildFeeReportCsv } from "../utils/report.js";

const router = express.Router();

// ==================== FEE PLANS (Class-wise) ====================
// List fee plans for the school
router.get("/plans", requireSchoolAdmin, async (req, res) => {
  try {
    const { year, classLevel, section } = req.query;
    const q = { school: req.admin.schoolId };
    if (year) q.academicYear = Number(year);
    if (classLevel) q.classLevel = classLevel;
    if (section) q.section = section;
    const plans = await FeePlan.find(q).sort({ academicYear: -1, classLevel: 1, section: 1 });
    res.json({ plans });
  } catch (e) {
    res.status(500).json({ message: "Failed to list plans", error: e.message });
  }
});

// Create fee plan
router.post("/plans", requireSchoolAdmin, async (req, res) => {
  try {
    const { academicYear, classLevel, totalAnnualFee } = req.body || {};
    if (!academicYear || !classLevel || totalAnnualFee === undefined) return res.status(400).json({ message: "academicYear, classLevel and totalAnnualFee are required" });
    // Prevent duplicate or edits: if a plan already exists for year+class, reject
    const existing = await FeePlan.findOne({ school: req.admin.schoolId, academicYear: Number(academicYear), classLevel });
    if (existing) return res.status(409).json({ message: "Fee plan already locked for this class/year" });
    const total = Number(totalAnnualFee || 0);
    if (!(total >= 0)) return res.status(400).json({ message: "totalAnnualFee must be a non-negative number" });
    // Auto-split into 3 terms, handling remainder
    const base = Math.floor(total / 3);
    const rem = total - base * 3;
    const t1 = base + (rem > 0 ? 1 : 0);
    const t2 = base + (rem > 1 ? 1 : 0);
    const t3 = base;
    const components = [
      { name: "Term 1", amount: t1 },
      { name: "Term 2", amount: t2 },
      { name: "Term 3", amount: t3 },
    ];
    const plan = await FeePlan.create({ school: req.admin.schoolId, academicYear: Number(academicYear), classLevel, frequency: "Annual", components });
    res.status(201).json({ plan, preview: { total, terms: [t1, t2, t3] } });
  } catch (e) {
    res.status(500).json({ message: "Failed to create plan", error: e.message });
  }
});

// Update fee plan
router.put("/plans/:id", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await FeePlan.findOne({ _id: id, school: req.admin.schoolId });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    // Locked plans cannot be edited; reject any updates
    return res.status(403).json({ message: "Fee plan is locked and cannot be updated" });
  } catch (e) {
    res.status(500).json({ message: "Failed to update plan", error: e.message });
  }
});

// Delete fee plan
router.delete("/plans/:id", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await FeePlan.findOne({ _id: id, school: req.admin.schoolId });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    // Locked plans cannot be deleted
    return res.status(403).json({ message: "Fee plan is locked and cannot be deleted" });
  } catch (e) {
    res.status(500).json({ message: "Failed to delete plan", error: e.message });
  }
});

// Assign plan to a student (sets totalFee from plan total)
router.post("/students/:id/assign-plan", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { planId } = req.body || {};
    if (!planId) return res.status(400).json({ message: "planId is required" });
    const student = await Student.findOne({ _id: id, school: req.admin.schoolId });
    if (!student) return res.status(404).json({ message: "Student not found" });
    const plan = await FeePlan.findOne({ _id: planId, school: req.admin.schoolId });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    const total = plan.total;
    student.fee = student.fee || {};
    student.fee.plan = String(plan._id);
    student.fee.totalFee = Number(total || 0);
    // Recompute status based on paidAmount
    const paid = Number(student.fee.paidAmount || 0);
    if (paid <= 0 && total > 0) student.fee.status = "Pending";
    else if (paid > 0 && paid < total) student.fee.status = "Partial";
    else if (paid >= total) student.fee.status = "Paid";
    await student.save();
    res.json({ ok: true, student });
  } catch (e) {
    res.status(500).json({ message: "Failed to assign plan", error: e.message });
  }
});

// ==================== STUDENT FEE TRACKING ====================
// List students with fee tracking
router.get("/students/tracking", requireSchoolAdmin, async (req, res) => {
  try {
    const { year, q, classLevel, section, status } = req.query;
    // Track all approved students in the school; don't limit by admissionYear so older students are included
    const base = { school: req.admin.schoolId, status: "Approved" };
    if (classLevel) base.classLevel = classLevel;
    if (section) base.section = section;
    if (status) {
      if (String(status).toLowerCase() === 'due') {
        // Treat "Due" as Pending or Partial
        base["fee.status"] = { $in: ["Pending", "Partial"] };
      } else {
        base["fee.status"] = status;
      }
    }
    if (q) {
      const rx = new RegExp(q, "i");
      base.$or = [{ name: rx }, { rollNumber: rx }, { email: rx }];
    }
    const students = await Student.find(base)
      .select("name rollNumber email classLevel section fee")
      .sort({ classLevel: 1, section: 1, rollNumber: 1 })
      .limit(500);
    const payload = students.map(s => {
      const total = Number(s.fee?.totalFee || 0);
      const paid = Number(s.fee?.paidAmount || 0);
      // If no total is set, fall back to explicit dueAmount when present
      let pending = total > 0 ? (total - paid) : Number(s.fee?.dueAmount || 0);
      if (pending < 0) pending = 0;
      return {
        id: s._id,
        name: s.name,
        rollNumber: s.rollNumber,
        classLevel: s.classLevel,
        section: s.section,
        fee: {
          plan: s.fee?.plan || null,
          totalFee: total,
          paidAmount: paid,
          pendingBalance: pending,
          status: s.fee?.status || "Pending",
          lastPaymentDate: s.fee?.lastPaymentDate || null,
        },
      };
    });
    res.json({ students: payload });
  } catch (e) {
    res.status(500).json({ message: "Failed to list students", error: e.message });
  }
});

// Record a payment for a student
router.post("/students/:id/payments", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method, receiptNo, notes, date } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "amount must be > 0" });
    const student = await Student.findOne({ _id: id, school: req.admin.schoolId });
    if (!student) return res.status(404).json({ message: "Student not found" });
    student.fee = student.fee || {};
    const payment = {
      amount: Number(amount),
      method: method || "Cash",
      receiptNo,
      notes,
      date: date ? new Date(date) : new Date(),
    };
    student.fee.payments = Array.isArray(student.fee.payments) ? student.fee.payments : [];
    student.fee.payments.push(payment);
    student.fee.paidAmount = Number(student.fee.paidAmount || 0) + Number(amount);
    student.fee.lastPaymentDate = payment.date;
    const total = Number(student.fee.totalFee || 0);
    const paid = Number(student.fee.paidAmount || 0);
    if (paid <= 0 && total > 0) student.fee.status = "Pending";
    else if (paid > 0 && paid < total) student.fee.status = "Partial";
    else if (paid >= total && total > 0) student.fee.status = "Paid";
    await student.save();
    res.status(201).json({ ok: true, payment, student });
  } catch (e) {
    res.status(500).json({ message: "Failed to record payment", error: e.message });
  }
});

// Get payments for a student
router.get("/students/:id/payments", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findOne({ _id: id, school: req.admin.schoolId }).select("fee");
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ payments: student.fee?.payments || [] });
  } catch (e) {
    res.status(500).json({ message: "Failed to get payments", error: e.message });
  }
});

// Toggle reminders for a student (future automation)
router.post("/students/:id/reminders", requireSchoolAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, nextReminderDate } = req.body || {};
    const student = await Student.findOne({ _id: id, school: req.admin.schoolId });
    if (!student) return res.status(404).json({ message: "Student not found" });
    student.fee = student.fee || {};
    if (typeof enabled === 'boolean') student.fee.remindersEnabled = enabled;
    if (nextReminderDate !== undefined) student.fee.nextReminderDate = nextReminderDate ? new Date(nextReminderDate) : undefined;
    await student.save();
    res.json({ ok: true, remindersEnabled: student.fee.remindersEnabled, nextReminderDate: student.fee.nextReminderDate });
  } catch (e) {
    res.status(500).json({ message: "Failed to update reminders", error: e.message });
  }
});

// ==================== REPORT EXPORTS ====================
// Export CSV report: period=monthly&year=2026&month=1 OR period=yearly&year=2026
router.get("/reports/export", requireSchoolAdmin, async (req, res) => {
  try {
    const { period, year, month, classLevel, section } = req.query;
    if (!period || !["monthly","yearly"].includes(period)) return res.status(400).json({ message: "period must be monthly or yearly" });
    const q = { school: req.admin.schoolId, status: "Approved" };
    if (classLevel) q.classLevel = classLevel;
    if (section) q.section = section;
    const students = await Student.find(q)
      .select("name rollNumber classLevel section fee")
      .sort({ classLevel: 1, section: 1, rollNumber: 1 })
      .limit(1000)
      .lean();
    const { csv } = buildFeeReportCsv(students, period, { year: Number(year), month: month ? Number(month) : undefined });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=fee-report-${period}-${year}${month?('-'+month):''}.csv`);
    return res.status(200).send(csv);
  } catch (e) {
    res.status(500).json({ message: "Failed to export report", error: e.message });
  }
});

export default router;
