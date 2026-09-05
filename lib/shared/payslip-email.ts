export type PayslipEmailLine = {
  name: string;
  code?: string;
  category?: string;
  amount: number;
};

export type PayslipEmailInput = {
  fullName: string;
  employeeCode?: string;
  department?: string;
  periodLabel: string;
  periodStart?: string;
  periodEnd?: string;
  structureName?: string;
  workedDays?: number;
  gross?: number;
  net: number;
  lines: PayslipEmailLine[];
};

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isDeduction(category?: string) {
  return category === "deduction" || category === "contribution";
}

export function buildPayslipEmailText(input: PayslipEmailInput) {
  const lineText = input.lines
    .map((line) => {
      const sign = isDeduction(line.category) ? "-" : "";
      return `${line.name}: ${sign}${formatInr(Math.abs(line.amount))}`;
    })
    .join("\n");

  return [
    `Hi ${input.fullName},`,
    "",
    `Your payslip for ${input.periodLabel} is ready.`,
    input.employeeCode ? `Employee ID: ${input.employeeCode}` : null,
    input.department ? `Department: ${input.department}` : null,
    input.structureName ? `Salary structure: ${input.structureName}` : null,
    input.workedDays != null ? `Worked days: ${input.workedDays}` : null,
    "",
    lineText,
    "",
    input.gross != null ? `Gross: ${formatInr(input.gross)}` : null,
    `Net salary: ${formatInr(input.net)}`,
    "",
    "This is a confidential, system-generated message from HRMS.",
  ]
    .filter((row) => row !== null)
    .join("\n");
}

export function buildPayslipEmailHtml(input: PayslipEmailInput) {
  const name = escapeHtml(input.fullName);
  const period = escapeHtml(input.periodLabel);
  const employeeCode = escapeHtml(input.employeeCode ?? "—");
  const department = escapeHtml(input.department ?? "—");
  const structure = escapeHtml(input.structureName ?? "—");
  const worked = input.workedDays == null ? "—" : String(input.workedDays);
  const lineRows = input.lines
    .map((line) => {
      const deduction = isDeduction(line.category);
      const amountColor = deduction ? "#DC2626" : "#18181B";
      const prefix = deduction ? "−" : "";
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #F4F4F5;font-size:14px;color:#18181B;">${escapeHtml(line.name)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #F4F4F5;font-size:12px;color:#71717A;letter-spacing:0.04em;">${escapeHtml(line.code ?? "")}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #F4F4F5;font-size:14px;font-weight:600;color:${amountColor};">${prefix}${formatInr(Math.abs(line.amount))}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payslip · ${period}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAFA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E4E4E7;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#18181B;padding:28px 32px;">
              <p style="margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A1A1AA;">HRMS · Salary statement</p>
              <h1 style="margin:8px 0 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:26px;line-height:32px;font-weight:600;color:#FAFAFA;">Payslip</h1>
              <p style="margin:8px 0 0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;color:#D4D4D8;">${period}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;">
              <p style="margin:0;font-size:16px;color:#18181B;">Hi ${name},</p>
              <p style="margin:8px 0 0;font-size:14px;line-height:20px;color:#52525B;">Your salary for this period has been processed. A confidential breakdown is below.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;border:1px solid #E4E4E7;border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px;width:50%;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;">
                    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;">Employee</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${name}</p>
                    <p style="margin:2px 0 0;font-size:12px;color:#71717A;">${employeeCode}</p>
                  </td>
                  <td style="padding:16px 20px;width:50%;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;">
                    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;">Department</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${department}</p>
                    <p style="margin:2px 0 0;font-size:12px;color:#71717A;">${structure}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px 16px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;">
                    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;">Worked days</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${worked}</p>
                  </td>
                  <td style="padding:0 20px 16px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;">
                    <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#71717A;">Gross</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#18181B;">${formatInr(input.gross ?? 0)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 8px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717A;">Component</td>
                  <td style="padding-bottom:8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717A;">Code</td>
                  <td align="right" style="padding-bottom:8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717A;">Amount</td>
                </tr>
                ${lineRows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#18181B;border-radius:12px;">
                <tr>
                  <td style="padding:18px 22px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#A1A1AA;">Net salary</td>
                  <td align="right" style="padding:18px 22px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:22px;font-weight:600;color:#FAFAFA;">${formatInr(input.net)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:12px;line-height:18px;color:#A1A1AA;">
              This statement is confidential and intended only for ${name}. If you did not expect this email, contact HR.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
