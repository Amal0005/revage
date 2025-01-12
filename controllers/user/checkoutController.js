const Cart = require('../../models/cartModel');
const Order = require('../../models/orderModel');
const User = require('../../models/userSchema');

const checkoutController = {
    getCheckoutPage: async (req, res) => {
        try {
            const userId = req.session.user;
            const user = await User.findById(userId);
            const cart = await Cart.findOne({ user: userId }).populate('items.product');

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect('/cart');
            }

            // Calculate totals
            let subtotal = 0;
            cart.items.forEach(item => {
                subtotal += item.product.salePrice * item.quantity;
            });

            const shipping = subtotal > 0 ? 40 : 0;
            const total = subtotal + shipping;

            // Add calculated totals to cart object
            cart.subtotal = subtotal;
            cart.shipping = shipping;
            cart.total = total;

            res.render('user/checkout', { 
                user,
                cart
            });
        } catch (error) {
            console.error('Error loading checkout page:', error);
            res.status(500).send('Internal Server Error');
        }
    },

    processCheckout: async (req, res) => {
        try {
            const userId = req.session.user;
            const { addressIndex } = req.body;

            // Get user and their selected address
            const user = await User.findById(userId);
            if (!user || !user.addresses || !user.addresses[addressIndex]) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid address selected' 
                });
            }

            const selectedAddress = user.addresses[addressIndex];

            // Get cart items and calculate totals
            const cart = await Cart.findOne({ user: userId }).populate('items.product');
            if (!cart || !cart.items || cart.items.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Cart is empty' 
                });
            }

            // Calculate totals
            let subtotal = 0;
            cart.items.forEach(item => {
                subtotal += item.product.salePrice * item.quantity;
            });

            const shipping = subtotal > 0 ? 40 : 0;
            const total = subtotal + shipping;

            // Map cart items to order items format
            const orderItems = cart.items.map(item => ({
                product: item.product._id,
                quantity: item.quantity
            }));

            // Create new order with properly mapped address
            const order = new Order({
                user: userId,
                items: orderItems,
                totalAmount: total,
                shippingAddress: {
                    fullName: selectedAddress.name,
                    phone: selectedAddress.phone,
                    address: `${selectedAddress.houseName}, ${selectedAddress.street}`,
                    city: selectedAddress.city,
                    pincode: selectedAddress.pincode
                },
                status: 'Pending',
                orderDate: new Date()
            });

            await order.save();

            // Clear cart after successful order
            cart.items = [];
            await cart.save();

            res.json({ 
                success: true, 
                message: 'Order placed successfully',
                orderId: order._id 
            });
        } catch (error) {
            console.error('Error processing checkout:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to process checkout: ' + error.message 
            });
        }
    }
};

module.exports = checkoutController;
