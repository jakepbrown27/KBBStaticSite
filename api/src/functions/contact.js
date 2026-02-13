const { app } = require("@azure/functions");
const { EmailClient } = require("@azure/communication-email");

app.http("contact", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") return { status: 204 };

    // 1) Validate env vars (DON'T log the values)
    const requiredEnv = ["ACS_CONNECTION_STRING", "ACS_SENDER_ADDRESS", "CONTACT_TO_EMAIL"];
    const missing = requiredEnv.filter((k) => !process.env[k] || !String(process.env[k]).trim());

    context.log("ENV present:", {
      ACS_CONNECTION_STRING: !!process.env.ACS_CONNECTION_STRING,
      ACS_SENDER_ADDRESS: !!process.env.ACS_SENDER_ADDRESS,
      CONTACT_TO_EMAIL: !!process.env.CONTACT_TO_EMAIL,
    });

    if (missing.length) {
      context.log.error("Missing env vars:", missing);
      return {
        status: 500,
        jsonBody: { ok: false, error: `Missing env vars: ${missing.join(", ")}` },
      };
    }

    // 2) Parse request body
    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.email || !body?.message) {
      return { status: 400, jsonBody: { ok: false, error: "name, email, message required" } };
    }

    const { name, email, message } = body;

    // 3) Create client from env
    const client = new EmailClient(process.env.ACS_CONNECTION_STRING);

    const subject = `New contact form submission from ${name}`;
    const plainText =
`New inquiry from your site:

Name: ${name}
Email: ${email}

Message:
${message}
`;

    try {
      const emailMessage = {
        senderAddress: process.env.ACS_SENDER_ADDRESS,
        content: { subject, plainText },
        recipients: { to: [{ address: process.env.CONTACT_TO_EMAIL }] },
        replyTo: [{ address: email }],
      };

      // For debugging: await beginSend (fast) but don't pollUntilDone yet
      const poller = await client.beginSend(emailMessage);

      // Return quickly but confirm it started
      return {
        status: 202,
        jsonBody: { ok: true, accepted: true },
      };
    } catch (err) {
      context.log.error("ACS send failed:", err?.message || err, err?.stack);
      return { status: 500, jsonBody: { ok: false, error: "ACS send failed" } };
    }
  },
});
