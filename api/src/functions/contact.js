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

    const cs = process.env.ACS_CONNECTION_STRING;
    const sender = process.env.ACS_SENDER_ADDRESS;
    const to = process.env.CONTACT_TO_EMAIL;

    if (!cs || !sender || !to) {
      context.log.error("Missing env vars", {
        ACS_CONNECTION_STRING: !!cs,
        ACS_SENDER_ADDRESS: !!sender,
        CONTACT_TO_EMAIL: !!to,
      });
      return { status: 500, jsonBody: { ok: false, error: "Server not configured" } };
    }

    // Respond to the browser immediately
    const response = { status: 202, jsonBody: { ok: true } };

    // Kick off the send in the background
    try {
      const client = new EmailClient(cs);
      const { name, email, message } = body;

      const emailMessage = {
        senderAddress: sender,
        content: {
          subject: `New contact form submission from ${name}`,
          plainText: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n`,
        },
        recipients: { to: [{ address: to }] },
        // replyTo is fine to include; if your SDK/runtime doesn’t like it, remove it
        replyTo: [{ address: email }],
      };

      // IMPORTANT: no await
      client.beginSend(emailMessage)
        .then(poller => poller.pollUntilDone())
        .then(result => context.log("Email sent:", result))
        .catch(err => context.log.error("Email send failed:", err?.message || err));
    } catch (err) {
      context.log.error("Failed to start email send:", err?.message || err);
      // still return 202 because the request already "accepted"
    }

    return response;
  },
});
