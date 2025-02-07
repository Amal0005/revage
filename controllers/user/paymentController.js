const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
require("dotenv").config()

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create RazorPay Order
const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { total, subtotal, shipping, currency = 'INR' } = req.body;

        if (!total || total <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid order amount' 
            });
        }

        // Fetch cart to get items
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        
        // Check if any products in cart are blocked
        const blockedProducts = cart.items.filter(item => item.product.isBlocked);
        if (blockedProducts.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Some products in your cart are no longer available for purchase. Please remove them and try again.'
            });
        }

        const amount = Math.round(total * 100);

        // Shorten receipt to ensure it's under 40 characters
        const receipt = `ord_${Date.now()}`.substring(0, 40);

        const options = {
            amount,
            currency,
            receipt,
            payment_capture: 1
        };

        const razorpayOrder = await razorpay.orders.create(options);

        const newOrder = new Order({
            user: userId,
            items: cart.items.map(item => ({
                product: item.product._id,
                quantity: item.quantity,
                price: item.product.salePrice
            })),
            subtotal: subtotal,
            shipping: shipping,
            totalAmount: total,
            razorpayOrderId: razorpayOrder.id,
            paymentMethod: 'razorpay',
            paymentStatus: 'Pending'
        });
        await newOrder.save();

        res.status(200).json({
            success: true,
            order: razorpayOrder,
            key: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('RazorPay Order Creation Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create payment order' 
        });
    }
};

// Verify RazorPay Payment
const verifyPayment = async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature 
        } = req.body;

        // Generate signature
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest('hex');

        // Signature verification
        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ 
                success: false, 
                message: 'Payment verification failed' 
            });
        }

        // Get order with populated items
        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id })
            .populate('items.product');

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        // Verify and reduce stock for each product
        for (const item of order.items) {
            const product = await Product.findById(item.product._id);
            if (!product || product.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock available for ${item.product.productName}`
                });
            }
            
            await Product.findByIdAndUpdate(
                item.product._id,
                { $inc: { quantity: -item.quantity } }
            );
        }

        // Update order status
        order.razorpayPaymentId = razorpay_payment_id;
        order.paymentStatus = 'Completed';
        order.status = 'Processing';
        await order.save();

        // Clear the user's cart after successful payment
        await Cart.findOneAndUpdate(
            { user: order.user },
            { $set: { items: [], total: 0, subtotal: 0, shipping: 0 } }
        );

        console.log('Cart cleared after successful payment for user:', order.user);

        res.status(200).json({ 
            success: true, 
            message: 'Payment successful',
            orderId: order._id
        });

    } catch (error) {
        console.error('Payment Verification Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Payment verification failed' 
        });
    }
};

const getPaymentDetails = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await razorpay.payments.fetch(paymentId);
        
        res.status(200).json({
            success: true,
            payment
        });
    } catch (error) {
        console.error('Payment Details Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch payment details' 
        });
    }
};

const retryPayment = async (req, res) => {
    try {
        console.log('Retry payment request received for orderId:', req.params.orderId);
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        
        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        console.log('Order found:', {
            id: order._id,
            status: order.paymentStatus,
            amount: order.totalAmount
        });

        if (order.paymentStatus !== 'Pending' && order.paymentStatus !== 'Failed') {
            console.log('Invalid payment status for retry:', order.paymentStatus);
            return res.status(400).json({
                success: false,
                message: 'Payment retry is only available for pending or failed payments'
            });
        }

        const amount = Math.round(order.totalAmount * 100);
        const receipt = `ord_retry_${Date.now()}`.substring(0, 40);

        const options = {
            amount,
            currency: 'INR',
            receipt,
            payment_capture: 1
        };

        console.log('Creating Razorpay order with options:', options);
        const razorpayOrder = await razorpay.orders.create(options);
        console.log('Razorpay order created:', razorpayOrder);

        // Update order with new Razorpay order ID
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();
        console.log('Order updated with new Razorpay order ID');

        res.status(200).json({
            success: true,
            razorpayOrder: razorpayOrder,
            key: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Payment Retry Error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment retry',
            error: error.message
        });
    }
};

module.exports = {
    createRazorpayOrder,
    verifyPayment,
    getPaymentDetails,
    retryPayment
};