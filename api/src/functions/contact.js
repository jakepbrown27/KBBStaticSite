const { app } = require('@azure/functions');
const { EmailClient } = require("@azure/communication-email");

app.http('contact', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    // Basic preflight support
    if (request.method === 'OPTIONS') return { status: 204 };

    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.email || !body?.message) {
      return { status: 400, jsonBody: { ok: false, error: 'name, email, message required' } };
    }

    // TODO later: send email/SMS here
    context.log('New inquiry:', body);



            const connectionString = "endpoint=https://kbbcommunicationservice.unitedstates.communication.azure.com/;accesskey=8TKY5R6rcrMqtsulNdLn6ZLSCrzSPQiQ2IyJWPp6paUQz1TNGHn3JQQJ99CBACULyCpt0EBwAAAAAZCSla8c";
            const client = new EmailClient(connectionString);

            async function main() {
                const emailMessage = {
                    senderAddress: "DoNotReply@<from_domain>",
                    content: {
                        subject: "Test Email",
                        plainText: "Hello world via email.",
                        html: `
                        <html>
                            <body>
                                <h1>
                                    Hello world via email.
                                </h1>
                            </body>
                        </html>`,
                    },
                    recipients: {
                        to: [{ address: "jakepbrown@gmail.com" }],
                    },
                    
                };

                const poller = await client.beginSend(emailMessage);
                const result = await poller.pollUntilDone();
            }

            main();

    return { status: 200, jsonBody: { ok: true } };
  }
});