const { app } = require('@azure/functions');

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

    return { status: 200, jsonBody: { ok: true } };
  }
});
