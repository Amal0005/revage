const nodemailer = require('nodemailer');

const contactController = {
    // Handle contact form submission
    submitContactForm: async (req, res) => {
        try {
            const { name, email, subject, message } = req.body;

            // Basic validation
            if (!name || !email || !subject || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Please fill in all fields'
                });
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please enter a valid email address'
                });
            }

            // Log the contact form submission (you can replace this with email sending or database storage)
            console.log('Contact Form Submission:', {
                name,
                email,
                subject,
                message,
                timestamp: new Date()
            });

            // Send success response
            res.status(200).json({
                success: true,
                message: 'Thank you for your message. We will get back to you soon!'
            });

        } catch (error) {
            console.error('Contact Form Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to submit contact form. Please try again later.'
            });
        }
    }
};

module.exports = contactController;
