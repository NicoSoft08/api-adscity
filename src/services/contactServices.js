const express = require('express');
const router = express.Router();
const { sendUserEmailWithTicket, sendSupportEmail } = require("../controllers/emailController");
const { generateTicketID } = require("../func");



router.post('/contact', async (req, res) => {
    const { formData } = req.body;
    const { firstName, lastName, email, object, message } = formData;

    // Generate a unique ticket ID
    const ticketID = generateTicketID();

    try {
        await sendUserEmailWithTicket(firstName, email, lastName, object, ticketID);
        await sendSupportEmail(email, firstName, lastName, message, object, ticketID);

        res.status(200).json({ message: 'Message reçu avec succès', ticketID });
    } catch (error) {
        console.error('Erreur lors de l\'envoi des emails:', error);
        res.status(500).json({ error: 'Erreur lors de l\'envoi des emails' });
    }
});


module.exports = router;