// netlify/functions/create-checkout.js
//
// Creates a PayMongo Checkout Session and returns the checkout_url.
// The buyer is sent here FIRST (instead of straight to a PayMongo Page),
// so we control success_url / cancel_url and can verify payment after.
//
// Required Netlify environment variable:
//   PAYMONGO_SECRET_KEY = sk_live_xxxxxxxxxxxx (from PayMongo Dashboard > Developers > API Keys)

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing PAYMONGO_SECRET_KEY env var on Netlify.' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const {
      productName = 'VIP ROI Framework',
      description = 'Digital product access',
      amountCentavos = 99700, // ₱997.00 default
      successPath = '/delivery.html',
      cancelPath = '/'
    } = body;

    const siteUrl = `https://${event.headers.host}`;
    const success_url = `${siteUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${siteUrl}${cancelPath}`;

    const payload = {
      data: {
        attributes: {
          line_items: [
            {
              currency: 'PHP',
              amount: amountCentavos,
              name: productName,
              quantity: 1
            }
          ],
          payment_method_types: ['gcash', 'card', 'paymaya', 'grab_pay', 'qrph'],
          description: description,
          success_url: success_url,
          cancel_url: cancel_url,
          send_email_receipt: true,
          show_description: true,
          show_line_items: true
        }
      }
    };

    const res = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64')
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: data.errors || data }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        checkout_url: data.data.attributes.checkout_url,
        session_id: data.data.id
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
