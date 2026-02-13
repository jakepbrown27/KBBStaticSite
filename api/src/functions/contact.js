const { app } = require("@azure/functions");
const { EmailClient } = require("@azure/communication-email");

app.http("contact", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return { status: 204 };

    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.email || !body?.message) {
      return { status: 400, jsonBody: { ok: false, error: "name, email, message required" } };
    }

    const { name, email, message } = body;

    const connectionString = process.env.ACS_CONNECTION_STRING;
    const sender = process.env.ACS_SENDER_ADDRESS;
    const to = process.env.CONTACT_TO_EMAIL;

    const client = new EmailClient(connectionString);

    async function main() {
      const subject = `New contact form submission from ${name}`;

      const plainText =
`New inquiry from your site:

Name: ${name}
Email: ${email}

Message:
${message}
`;

      const html = `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.4;">
    <h2>New inquiry from your site</h2>

    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${encodeAttr(email)}">${escapeHtml(email)}</a></p>

    <p><strong>Message:</strong></p>
    <pre style="white-space: pre-wrap; background:#f6f6f6; padding:12px; border-radius:6px;">${escapeHtml(message)}</pre>
  </body>
</html>`;

      const emailMessage = {
        senderAddress: sender,
        content: { subject, plainText, html },
        recipients: { to: [{ address: to }] },
        // optional: makes replying go to the user
        replyTo: [{ address: email }],
      };

      const poller = await client.beginSend(emailMessage);
      const result = await poller.pollUntilDone();

      context.log("Email send result:", result);
    }

    // Keep your "works" behavior: don't await
    main().catch((err) => context.log.error("Email send failed:", err?.message || err));

    return { status: 200, jsonBody: { ok: true } };
  },
});

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// safer in attributes (mailto:)
function encodeAttr(str) {
  return encodeURIComponent(String(str)).replaceAll("%40", "@");
}
