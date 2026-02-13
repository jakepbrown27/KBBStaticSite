const { app } = require("@azure/functions");
const { EmailClient } = require("@azure/communication-email");

app.http("contact", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return { status: 204 };

    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.email || !body?.message) {
      return { status: 400, jsonBody: { ok: false, error: "Invalid input" } };
    }

    // Email validation
    const cleanedEmail = cleanEmail(body.email);
    if (!cleanedEmail) {
      return { status: 400, jsonBody: { ok: false, error: "Invalid email input" } };
    }
    body.email = cleanedEmail;

    // Guest count validation (name="guests" in your HTML)
    const guests = cleanGuestCount(body.guests);
    if (guests === null) {
      return { status: 400, jsonBody: { ok: false, error: "Invalid input for guest count." } };
    }
    body.guests = guests;

    const date = cleanDate(body.date);
    if (!date) {
      return { status: 400, jsonBody: { ok: false, error: "Invalid Date." } };
    }
    body.date = date;

    // Message sanitation (limit size, remove control chars)
    const message = cleanMessage(body.message);
    if (!message) {
      return { status: 400, jsonBody: { ok: false, error: "Invalid message input, do not include any special characters" } };
    }
    body.message = message;

    const connectionString = process.env.ACS_CONNECTION_STRING;
    const sender = process.env.ACS_SENDER_ADDRESS;
    const to = process.env.CONTACT_TO_EMAIL;

    const client = new EmailClient(connectionString);

    async function main() {
      const emailMessage = {
        senderAddress: sender,
        content: {
          subject: "New contact form submission from " + body.name,
          plainText:
            "Name: " + body.name + "\n" +
            "Email: " + body.email + "\n" +
            "Event Date: " + (body.date || "") + "\n" +
            "Estimated Guest Count: " + body.guests + "\n\n" +
            "Message:\n" + body.message + "\n",

          html:
            "<html><body>" +
            "<h2>New Contact Form Submission</h2>" +
            "<p><b>Name:</b> " + body.name + "</p>" +
            "<p><b>Email:</b> " + body.email + "</p>" +
            "<p><b>Event Date:</b> " + (body.date || "") + "</p>" +
            "<p><b>Estimated Guest Count:</b> " + body.guests + "</p>" +
            "<p><b>Message:</b></p>" +
            "<pre>" + body.message + "</pre>" +
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

    main().catch((err) => context.log("Send failed:", err));

    return { status: 200, jsonBody: { ok: true } };
  },
});

function cleanEmail(value) {
  if (typeof value !== "string") return null;
  const s = value.trim().toLowerCase();
  if (s.length < 6 || s.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return null;
  return s;
}

function cleanGuestCount(value) {
  // Accept number or string
  const s = String(value ?? "").trim();

  // Must be digits only (no decimals, no signs, no letters)
  if (!/^\d+$/.test(s)) return null;

  const n = parseInt(s, 10);

  // must be >= 1
  if (!Number.isInteger(n) || n < 1) return null;

  // optional: prevent insane values
  if (n > 5000) return null;

  return n;
}

function cleanDate(value) {
  if (typeof value !== "string") return null;

  const s = value.trim(); // type="date" should already be YYYY-MM-DD

  // must be YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const [yyyy, mm, dd] = s.split("-").map((x) => parseInt(x, 10));
  if (!yyyy || !mm || !dd) return null;

  // Create a date in local time to avoid timezone shifts
  const d = new Date(yyyy, mm - 1, dd);

  // Must be a real calendar date (reject 2026-02-31 etc.)
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== yyyy ||
    d.getMonth() !== mm - 1 ||
    d.getDate() !== dd
  ) {
    return null;
  }

  return s; // normalized already
}

function cleanMessage(value) {
  if (typeof value !== "string") return null;

  let s = value;

  // Remove null bytes + control chars (keep tabs/newlines)
  s = s.replace(/\0/g, "");
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Trim, but keep internal spacing/newlines
  s = s.trim();

  // Must not be empty
  if (!s) return null;

  // Cap length to prevent abuse (tune this)
  const MAX = 3000;
  if (s.length > MAX) s = s.slice(0, MAX);

  return s;
}
