// netlify/functions/verify-payment.js
//
// Verifies that a Checkout Session was actually paid, by asking PayMongo
// directly (server-side, using the secret key). Never trust the URL alone —
// anyone could fake a "?paid=true" parameter, but they can't fake PayMongo's
// own records.
//
// Required Netlify environment variable:
//   PAYMONGO_SECRET_KEY = sk_live_xxxxxxxxxxxx

exports.handler = async function (event) {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing PAYMONGO_SECRET_KEY env var on Netlify.' }) };
    }

    const sessionId = event.queryStringParameters && event.queryStringParameters.session_id;
    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id parameter.' }) };
    }

    const res = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64')
      }
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: data.errors || data }) };
    }

    const attrs = data.data.attributes;
    const payments = attrs.payments || [];
    const isPaid = attrs.payment_intent &&
                   attrs.payment_intent.attributes &&
                   attrs.payment_intent.attributes.status === 'succeeded';

    const paidViaPayments = payments.some(p => p.attributes && p.attributes.status === 'paid');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paid: isPaid || paidViaPayments,
        session_id: sessionId,
        amount: attrs.line_items && attrs.line_items[0] ? attrs.line_items[0].amount : null,
        product_name: attrs.line_items && attrs.line_items[0] ? attrs.line_items[0].name : null,
        billing: attrs.billing || null
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
