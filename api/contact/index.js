module.exports = async function (context, req) {
  try {
    const { name, email, date, guests, message } = req.body || {};

    if (!name || !email || !message) {
      context.res = { status: 400, jsonBody: { error: "name, email, and message are required" } };
      return;
    }

    // TODO: send notification (email/SMS) from here
    // For now, just log it (you’ll see this in Function logs)
    context.log("New inquiry:", { name, email, date, guests, message });

    context.res = { status: 200, jsonBody: { ok: true } };
  } catch (e) {
    context.log.error(e);
    context.res = { status: 500, jsonBody: { error: "Server error" } };
  }
};
