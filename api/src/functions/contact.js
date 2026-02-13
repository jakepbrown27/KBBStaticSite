const { app } = require("@azure/functions");
const { EmailClient } = require("@azure/communication-email");

app.http("contact", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return { status: 204 };

    const body = await request.json().catch(() => null);

    // Basic presence check
    if (!body?.name || !body?.email || !body?.message || !body?.eventDate) {
      return { status: 400, jsonBody: { ok: false, error: "Invalid input" } };
    }

    // ----------------------------
    // Sanitize + validate inputs
    // ----------------------------
    const name = cleanText(body.name, 80);
    const email = cleanEmail(body.email);
    const message = cleanText(body.message, 2000);
    const eventDate = cleanDate(body.eventDate);

    // Reject if anything fails validation
    if (!name || !email || !message || !eventDate) {
      return { status: 400, jsonBody: { ok: false, error: "Invalid input" } };
    }

    // Date rules: not in past, not > 5 years in future
    if (!dateInAllowedRange(eventDate)) {
      return { status: 400, jsonBody: { ok: false, error: "Invalid input" } };
    }

    // ----------------------------
    // Send email (your working flow)
    // ----------------------------
    const connectionString = process.env.ACS_CONNECTION_STRING;
    const sender = process.env.ACS_SENDER_ADDRESS;
    const to = process.env.CONTACT_TO_EMAIL;

    const client = new EmailClient(connectionString);

    async function main() {
      const emailMessage = {
        senderAddress: sender,
        content: {
          subject: "New contact form submission from " + name,
          plainText:
            "Name: " + name + "\n" +
            "Email: " + email + "\n" +
            "Event Date: " + eventDate + "\n\n" +
            "Message:\n" + message + "\n",

          // Escape values that go into HTML so nobody can inject markup into your inbox
          html:
            "<html><body>" +
            "<h2>New Contact Form Submission</h2>" +
            "<p><b>Name:</b> " + escapeHtml(name) + "</p>" +
            "<p><b>Email:</b> " + escapeHtml(email) + "</p>" +
            "<p><b>Event Date:</b> " + escapeHtml(eventDate) + "</p>" +
            "<p><b>Message:</b></p>" +
            "<pre>" + escapeHtml(message) + "</pre>" +
            "</body></html>",
        },
        recipients: {
          to: [{ address: to }],
        },
      };

      const poller = await client.beginSend(emailMessage);
      const result = await poller.pollUntilDone();
      context.log("Send result:", result);
    }

    // DO NOT await (keeps your current behavior)
    main().catch((err) => context.log("Send failed:", err));

    return { status: 200, jsonBody: { ok: true } };
  },
});

/**
 * Keep it simple:
 * - string
 * - trim
 * - remove null bytes
 * - collapse whitespace
 * - enforce max length
 */
function cleanText(value, maxLen) {
  if (typeof value !== "string") return null;

  let s = value;

  // remove null bytes + weird control chars
  s = s.replace(/\0/g, "");
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // trim + collapse whitespace
  s = s.trim().replace(/\s+/g, " ");

  if (!s) return null;
  if (s.length > maxLen) s = s.slice(0, maxLen);

  return s;
}

function cleanEmail(value) {
  if (typeof value !== "string") return null;
  const s = value.trim().toLowerCase();

  // Simple, practical email check (not RFC-perfect, but good enough)
  if (s.length < 6 || s.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return null;

  return s;
}

/**
 * Accepts "YYYY-MM-DD" OR "MM/DD/YYYY"
 * Returns normalized "YYYY-MM-DD"
 */
function cleanDate(value) {
  if (typeof value !== "string") return null;

  // remove ALL whitespace
  const s = value.trim().replace(/\s+/g, "");

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [mm, dd, yyyy] = s.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}


function dateInAllowedRange(yyyyMmDd) {
  // Parse as local date (no timezone surprises)
  const [yyyy, mm, dd] = yyyyMmDd.split("-").map((x) => parseInt(x, 10));
  if (!yyyy || !mm || !dd) return false;

  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return false;

  // Validate it didn't roll (ex: 2026-02-31)
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const max = new Date(today.getFullYear() + 5, today.getMonth(), today.getDate());

  if (d < today) return false;
  if (d > max) return false;

  return true;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
