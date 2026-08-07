/** Minimal, dependency-free CSV export helpers. */

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Guard against spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const toCsv = <T>(rows: T[], columns: { key: string; header: string; value: (row: T) => unknown }[]) => {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(",")).join("\n");
  return `${head}\n${body}`;
};

export const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const timestampedFilename = (base: string) => {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  return `${base}-${stamp}.csv`;
};
