const { app } = require("@azure/functions");
const { EmailClient } = require("@azure/communication-email");

// Optional: you do NOT need app.setup(...) for your scenario.
// If you keep it, it should be in a central file; but simplest is to omit.

app.http("contact", {
  route: "contact",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return { status: 204, headers: cors };
    }

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

    const conn = process.env.ACS_CONNECTION_STRING;
    const sender = process.env.ACS_SENDER_ADDRESS;
    const to = process.env.CONTACT_TO_EMAIL;

    if (!conn || !sender || !to) {
      context.log.error("Missing env vars: ACS_CONNECTION_STRING / ACS_SENDER_ADDRESS / CONTACT_TO_EMAIL");
      return {
        status: 500,
        headers: cors,
        jsonBody: { ok: false, error: "Server not configured for email." }
      };
    }

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

      // beginSend returns a poller; awaiting beginSend is fine for fire-and-forget
      await client.beginSend({
        senderAddress: sender,
        recipients: { to: [{ address: to }] },
        content: { subject, plainText },
        replyTo: [{ address: email }]
      });

      context.log("Email queued via ACS for:", to);
      return { status: 200, headers: cors, jsonBody: { ok: true } };
    } catch (err) {
      context.log.error("ACS email send failed:", err);
      return { status: 500, headers: cors, jsonBody: { ok: false, error: "Email send failed." } };
    }
  }
});
