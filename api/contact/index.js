const { app } = require("@azure/functions");

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

    // Preflight
    if (request.method === "OPTIONS") {
      return { status: 204, headers: cors };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, headers: cors, jsonBody: { ok: false, error: "Invalid JSON" } };
    }

    const { name, email, date, guests, message } = body || {};
    if (!name || !email || !message) {
      return {
        status: 400,
        headers: cors,
        jsonBody: { ok: false, error: "name, email, and message are required" }
      };
    }

    context.log("New inquiry:", { name, email, date, guests, message });

    // Later: send email/SMS here
    return { status: 200, headers: cors, jsonBody: { ok: true } };
  }
});
