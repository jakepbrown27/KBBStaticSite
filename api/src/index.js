const { app } = require("@azure/functions");
const { EmailClient } = require("@azure/communication-email");

app.http("contact", {
  route: "contact",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    // CORS (safe even for same-origin)
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return { status: 204, headers: cors };
    }

    // Parse input
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, headers: cors, jsonBody: { ok: false, error: "Invalid JSON" } };
    }

    const name = (body?.name || "").trim();
    const email = (body?.email || "").trim();
    const date = (body?.date || "").trim();
    const guests = (body?.guests || "").toString().trim();
    const message = (body?.message || "").trim();

    if (!name || !email || !message) {
      return {
        status: 400,
        headers: cors,
        jsonBody: { ok: false, error: "name, email, and message are required" }
      };
    }

    // Env vars
    const conn = process.env.ACS_CONNECTION_STRING;
    const sender = process.env.ACS_SENDER_ADDRESS;
    const to = process.env.CONTACT_TO_EMAIL;

    if (!conn || !sender || !to) {
      context.log.error("Missing ACS config. Check app settings.");
      return {
        status: 500,
        headers: cors,
        jsonBody: { ok: false, error: "Server not configured for email yet." }
      };
    }

    // Build email content
    const subject = `New KBB inquiry: ${name}`;
    const plainText =
      `New inquiry received:\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Event date: ${date || "(not provided)"}\n` +
      `Guest count: ${guests || "(not provided)"}\n\n` +
      `Message:\n${message}\n`;

    try {
      const client = new EmailClient(conn);

      // send
      await client.beginSend({
        senderAddress: sender,
        recipients: { to: [{ address: to }] },
        content: { subject, plainText },
        replyTo: [{ address: email }]
      });

      return { status: 200, headers: cors, jsonBody: { ok: true } };
    } catch (err) {
      context.log.error("Email send failed:", err);
      return {
        status: 500,
        headers: cors,
        jsonBody: { ok: false, error: "Failed to send email." }
      };
    }
  }
});
