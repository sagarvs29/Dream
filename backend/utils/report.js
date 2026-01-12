// Simple CSV utilities for fee reports

function toCsv(rows, headers) {
  const h = headers || Object.keys(rows[0] || {});
  const escape = (v) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [];
  lines.push(h.join(","));
  for (const row of rows) {
    lines.push(h.map(k => escape(row[k])).join(","));
  }
  return lines.join("\n");
}

// Build monthly or yearly fee report CSV from student fee tracking
// period: 'monthly' | 'yearly'
// options: { year, month } for monthly; { year } for yearly
function buildFeeReportCsv(students, period, options = {}) {
  const now = new Date();
  const year = Number(options.year || now.getFullYear());
  const month = options.month != null ? Number(options.month) : null; // 1-12
  const rows = [];
  for (const s of students) {
    const lastPaymentDate = s.fee?.lastPaymentDate ? new Date(s.fee.lastPaymentDate) : null;
    const pendingBalance = Number(s.fee?.totalFee || 0) - Number(s.fee?.paidAmount || 0);
    const base = {
      Name: s.name,
      Roll: s.rollNumber,
      Class: s.classLevel || "",
      Section: s.section || "",
      TotalFee: Number(s.fee?.totalFee || 0).toFixed(2),
      Paid: Number(s.fee?.paidAmount || 0).toFixed(2),
      Pending: (pendingBalance < 0 ? 0 : pendingBalance).toFixed(2),
      Status: s.fee?.status || "Pending",
      LastPaymentDate: lastPaymentDate ? lastPaymentDate.toISOString().slice(0, 10) : "",
    };
    if (period === 'monthly') {
      // Filter payments for the given month/year and add MonthlyPaid
      const payments = (s.fee?.payments || []).filter(p => {
        const d = new Date(p.date);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      });
      const monthlyPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      base.Month = month;
      base.Year = year;
      base.MonthlyPaid = monthlyPaid.toFixed(2);
    } else {
      // yearly aggregate
      const payments = (s.fee?.payments || []).filter(p => {
        const d = new Date(p.date);
        return d.getFullYear() === year;
      });
      const yearlyPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      base.Year = year;
      base.YearlyPaid = yearlyPaid.toFixed(2);
    }
    rows.push(base);
  }
  const headers = Object.keys(rows[0] || {});
  const csv = toCsv(rows, headers);
  return { csv, headers };
}

export { toCsv, buildFeeReportCsv };
