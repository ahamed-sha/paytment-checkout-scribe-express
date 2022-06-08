const express = require('express');
const app = express();
const key = 'sk_test_51L7tFJSIhsnmINRZHIjitSVVv5lOHCAon5gfTFd9pNjCa1leKNzEXq1XY5g7NwuMXk5aXagaIJZf8Y8LGfHGeIAZ00jjXNbV00';
const stripe = require('stripe')(key);

const generateAPIKey = () => {
    const { randomBytes } = require('crypto');
    const apiKey = randomBytes(16).toString("hex");
    const hashedAPIKey = hashAPIKey(apiKey);
    if (apiKeys[hashedAPIKey]) {
        generateAPIKey();
    } else {
        return { hashedAPIKey, apiKey};
    }
};

const hashAPIKey = (apiKey) => {
    const { createHash } = require('crypto')
    return createHash('md5').update(apiKey).digest("hex")
};

const customers = {
    // stripCustomerId : data
    stripCustomerId : {
        apiKey: 0,
        active: false,
        itemId: 'stripItemId',
        calls: 0,
    },
};

const apiKeys = {
    '123xyz': 'cust1',
};

app.get('/api', async (req, res) => {
    const {apiKey} = req.query
    if (!apiKey) {
        res.sendStatus(400);
    }
    const hashedAPIKey = hashAPIKey(apiKey)

    const customerID = apiKeys[hashedAPIKey]
    const customer = customers[customerID]

    if (!customer.active) {
        res.sendStatus(403)
    } else {
        const record = await stripe.subscriptionItems.createUsageRecord(
            customer.itemId,
            {
                quantity: 1,
                timestamp: 'now',
                action: 'increment'
            }
        )
        res.send({
            data: '🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥', usage: record,
        })
    }


});

// express middleware for verifying request
app.use(
    express.json({
        verify: (req, res, buffer) => (req['rawBody'] = buffer),
    })
);

app.get('/usage/:customer', async (req, res) => {
    const customerID = req.params.customer;
    const invoice = await stripe.invoices.retrieveUpcoming({
        customer: customerID,
    });

    res.send(invoice);
});

app.post('/checkout', async (req, res) => {
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: 'price_1L7u9rSIhsnmINRZE6EvdopY',
            },
        ],
        success_url: 'http://localhost:5000/dashboard?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:5000/error',
    })
    res.send(session)
});

app.post('/webhook', async (req, res) => {
    let data;
    let eventType;
    // Check if webhook signing is configured.
    const webhookSecret = 'whsec_1bf535d491623f8095fe2a2447284113d6f9862ac5aaff0c35458b63b90218da';

    if (webhookSecret) {
        // Retrieve the event by verifying the signature using the raw body and secret.
        let event;
        let signature = req.headers['stripe-signature'];

        try {
            event = stripe.webhooks.constructEvent(
                req['rawBody'],
                signature,
                webhookSecret
            );
        } catch (err) {
            console.log(`⚠️  Webhook signature verification failed.`);
            return res.sendStatus(400);
        }
        // Extract the object from the event.
        data = event.data;
        eventType = event.type;
    } else {
        // Webhook signing is recommended, but if the secret is not configured in `config.js`,
        // retrieve the event data directly from the request body.
        data = req.body.data;
        eventType = req.body.type;
    }

    switch (eventType) {
        case 'checkout.session.completed':
            console.log(data);
            console.log('completed');
            const customerId = data.object.customer;
            const subscriptionId = data.object.subscription;

            console.log(
                `💰 Customer ${customerId} subscribed to plan ${subscriptionId}`
            );

            // Get the subscription. The first item is the plan the user subscribed to.
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const itemId = subscription.items.data[0].id;

            // Generate API key
            const { apiKey, hashedAPIKey } = generateAPIKey();
            console.log(`User's API Key: ${apiKey}`);
            console.log(`Hashed API Key: ${hashedAPIKey}`);

            // Store the API key in your database.
            customers[customerId] = { apikey: hashedAPIKey, itemId, active: true};
            apiKeys[hashedAPIKey] = customerId;

            break;
        case 'invoice.paid':
            break;
        case 'invoice.payment_failed':
            break;
        default:
        // Unhandled event type
    }

    res.sendStatus(200);
});

app.listen(8080, () => console.log('alive on http://localhost:8080'));
