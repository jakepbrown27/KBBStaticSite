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

    const cs = process.env.ACS_CONNECTION_STRING;
    const sender = process.env.ACS_SENDER_ADDRESS;
    const to = process.env.CONTACT_TO_EMAIL;

    const client = new EmailClient(cs);

    const emailMessage = {
      senderAddress: sender,
      content: {
        subject: `New contact from ${name}`,
        plainText: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      },
      recipients: { to: [{ address: to }] },
      replyTo: [{ address: email }],
    };

    try {
      // IMPORTANT: await beginSend so we at least know ACS accepted the request
      const poller = await client.beginSend(emailMessage);

      // Log operation id (useful for troubleshooting)
      const opState = poller.getOperationState ? poller.getOperationState() : null;
      context.log("ACS send started. operationId:", opState?.id || "(unknown)");

      // Background completion logging (may or may not finish depending on runtime)
      poller.pollUntilDone()
        .then((result) => context.log("ACS send completed:", result))
        .catch((err) => context.log.error("ACS send failed:", err?.message || err));

      return { status: 202, jsonBody: { ok: true } };
    } catch (err) {
      // If you're not getting emails, THIS is the log you want to see
      context.log.error("beginSend threw:", err?.message || err, err?.stack);
      return { status: 500, jsonBody: { ok: false, error: "beginSend failed" } };
    }
  },
});
