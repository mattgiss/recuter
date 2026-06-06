// Cloudflare Email Worker — receives mail sent to your address (e.g.
// jobs@gissentanna.com), parses it, and forwards the fields to the
// inbound-email Supabase function. Free, uses your own domain.
//
// Setup:
//   1. Cloudflare dashboard → your domain → Email → Email Routing (enable it).
//   2. Create address `jobs@gissentanna.com`, action: "Send to a Worker".
//   3. Create this Worker, paste this code, add the two vars below as secrets:
//        FUNCTION_URL  = https://<project-ref>.supabase.co/functions/v1/inbound-email
//        INBOUND_TOKEN = <same value you set as INBOUND_EMAIL_TOKEN in Supabase>
//   4. `npm i postal-mime` in the Worker (or add it via the dashboard editor).

import PostalMime from 'postal-mime'

export default {
  async email(message, env) {
    const raw = new Response(message.raw)
    const parsed = await PostalMime.parse(await raw.arrayBuffer())

    const body = {
      from: message.from,
      subject: message.headers.get('subject') || parsed.subject || '',
      text: parsed.text || '',
      html: parsed.html || '',
    }

    await fetch(`${env.FUNCTION_URL}?token=${env.INBOUND_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  },
}
