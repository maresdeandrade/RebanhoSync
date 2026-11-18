/** A calendar interval is evidence of dates only, never of eligibility. */
export function sanitaryCalendarMonthWindowV1(rule: Record<string, unknown> | undefined, year: number, month: number | null) {
  if (rule?.type !== "calendar" || !Array.isArray(rule.calendar_months) || rule.calendar_months.length !== 1 || rule.calendar_months[0] !== month ||
      month === null || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 1900 || year > 9999) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return { startDate: `${prefix}-01`, endDate: `${prefix}-${lastDay}` };
}
