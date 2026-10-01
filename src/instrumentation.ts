/**
 * Runs once when the server starts. BizBooks keeps its books in Nigerian time: month and day boundaries
 * (reports, VAT periods, "today", reminder days, default dates) all use the server's local time, and
 * servers run in UTC. Africa/Lagos is UTC+1 all year (no daylight saving), and Node picks up a TZ change
 * at runtime, so this one line moves every boundary to Lagos time. (Vercel reserves TZ as an
 * environment variable, which is why it's set here.)
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") process.env.TZ = "Africa/Lagos";
}
