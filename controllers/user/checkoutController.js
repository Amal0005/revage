const Cart = require('../../models/cartSchema'); 
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const Product = require('../../models/productSchema');

const checkoutController = {
    getCheckoutPage: async (req, res) => {
        try {
            const userId = req.session.user;
            
            // Get user with wallet data
            const user = await User.findById(userId).populate('wallet');
            
            // Get cart with product details
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
                cart,
                wallet: user.wallet // Pass wallet to the view
            });
        } catch (error) {
            console.error('Error loading checkout page:', error);
            res.status(500).send('Internal Server Error');
        }
    },

    processCheckout: async (req, res) => {
        try {
            console.log('Processing checkout with data:', req.body);
            const userId = req.session.user;
            const { addressIndex, paymentMethod } = req.body;

            // Get user with wallet and address data
            const user = await User.findById(userId).populate('wallet');
            if (!user) {
                console.error('User not found:', userId);
                return res.status(400).json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }

            if (!user.addresses || !user.addresses[addressIndex]) {
                console.error('Invalid address index:', addressIndex);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid delivery address' 
                });
            }

            // Get cart with product details
            const cart = await Cart.findOne({ user: userId }).populate('items.product');
            if (!cart || !cart.items || cart.items.length === 0) {
                console.error('Cart is empty for user:', userId);
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

            // Verify stock availability for all items
            for (const item of cart.items) {
                const product = await Product.findById(item.product._id);
                if (!product || product.quantity < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Not enough stock available for ${item.product.productName}`
                    });
                }
            }

            console.log('Cart found:', cart);

            // Calculate totals
            let subtotal = 0;
            cart.items.forEach(item => {
                if (!item.product) {
                    throw new Error('Product not found in cart item');
                }
                subtotal += item.product.salePrice * item.quantity;
            });
            const shipping = subtotal > 0 ? 40 : 0;
            const total = subtotal + shipping;

            console.log('Order totals calculated:', { subtotal, shipping, total });

            // If wallet payment, verify balance
            if (paymentMethod === 'wallet') {
                if (!user.wallet) {
                    return res.status(400).json({
                        success: false,
                        message: 'Wallet not found'
                    });
                }

                if (user.wallet.balance < total) {
                    return res.status(400).json({
                        success: false,
                        message: 'Insufficient wallet balance'
                    });
                }
            }

            // Create new order
            const orderData = {
                user: userId,
                items: cart.items.map(item => ({
                    product: item.product._id,
                    quantity: item.quantity,
                    price: item.product.salePrice
                })),
                totalAmount: total,
                subtotal: subtotal,
                shipping: shipping,
                shippingAddress: {
                    fullName: user.addresses[addressIndex].name,
                    phone: user.addresses[addressIndex].phone,
                    address: `${user.addresses[addressIndex].houseName}, ${user.addresses[addressIndex].street}`,
                    city: user.addresses[addressIndex].city,
                    pincode: user.addresses[addressIndex].pincode,
                    state: user.addresses[addressIndex].state
                },
                paymentMethod: paymentMethod,
                status: paymentMethod === 'wallet' ? 'Processing' : 'Pending',
                paymentStatus: paymentMethod === 'wallet' ? 'Completed' : 'Pending',
                orderDate: new Date()
            };

            // If coupon was applied, add it to the order
            if (req.body.couponCode) {
                orderData.coupon = {
                    code: req.body.couponCode,
                    discountType: req.body.discountType,
                    discountValue: req.body.discountValue,
                    discountAmount: req.body.discountAmount
                };
            }

            console.log('Creating order with data:', orderData);
            const order = new Order(orderData);

            // If wallet payment, process it
            if (paymentMethod === 'wallet') {
                console.log('Processing wallet payment');
                await Wallet.findByIdAndUpdate(
                    user.wallet._id,
                    {
                        $inc: { balance: -total },
                        $push: {
                            transactions: {
                                type: 'debit',
                                amount: total,
                                description: `Payment for Order #${order._id}`,
                                orderId: order._id,
                                date: new Date()
                            }
                        }
                    }
                );

                // Reduce product quantities for wallet payment
                for (const item of cart.items) {
                    await Product.findByIdAndUpdate(
                        item.product._id,
                        { $inc: { quantity: -item.quantity } }
                    );
                }
            }

            // Save order
            await order.save();
            console.log('Order saved successfully:', order._id);

            // Clear cart
            await Cart.findByIdAndUpdate(cart._id, {
                $set: { items: [], total: 0, subtotal: 0, shipping: 0 }
            });

            console.log('Cart cleared successfully');

            res.json({
                success: true,
                message: 'Order placed successfully',
                orderId: order._id
            });

        } catch (error) {
            console.error('Error processing checkout:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to process order'
            });
        }
    }
};

module.exports = checkoutController;
