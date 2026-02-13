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

    const connectionString = process.env.ACS_CONNECTION_STRING;
    const sender = process.env.ACS_SENDER_ADDRESS;
    const to = process.env.CONTACT_TO_EMAIL;

    const client = new EmailClient(connectionString);

    async function main() {
      const emailMessage = {
        senderAddress: sender,
        content: {
          subject: "New Contact Form Submission",
          plainText:
            "Name: " + body.name + "\n" +
            "Email: " + body.email + "\n\n" +
            "Message:\n" + body.message + "\n",
          html:
            "<html><body>" +
            "<h2>New Contact Form Submission</h2>" +
            "<p><b>Name:</b> " + body.name + "</p>" +
            "<p><b>Email:</b> " + body.email + "</p>" +
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

    // DO NOT await (this is what makes your current one work)
    main().catch((err) => context.log("Send failed:", err));

    return { status: 200, jsonBody: { ok: true } };
  },
});
