const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');

// Helper function to handle wallet credit
async function creditToWallet(userId, amount, orderId, description) {
    try {
        // Find or create user's wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({
                user: userId,
                balance: 0,
                transactions: []
            });
        }

        // Add the transaction
        wallet.balance += amount;
        wallet.transactions.push({
            amount: amount,
            type: 'credit',
            description: description,
            orderId: orderId,
            date: new Date()
        });
        await wallet.save();

        // Ensure user has wallet reference
        const user = await User.findById(userId);
        if (!user.wallet) {
            user.wallet = wallet._id;
            await user.save();
        }

        return wallet;
    } catch (error) {
        console.error('Error crediting to wallet:', error);
        throw error;
    }
}

const orderController = {
    getAllOrders: async (req, res) => {
        try {
            const orders = await Order.find()
                .populate({
                    path: 'user',
                    select: 'name email'
                })
                .populate({
                    path: 'items.product',
                    select: 'productName productImage regularPrice'
                })
                .sort({ orderDate: -1 });

            res.render('admin/orders', { orders });
        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).redirect('/admin/pageerror');
        }
    },

    updateOrderStatus: async (req, res) => {
        try {
            const { orderId, status } = req.body;
            const order = await Order.findById(orderId).populate('items.product');
            
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // Handle product quantities based on status change
            if (status === 'Cancelled' || status === 'Returned') {
                // Return quantities to inventory
                for (const item of order.items) {
                    await Product.findByIdAndUpdate(
                        item.product._id,
                        { $inc: { quantity: item.quantity } }
                    );
                }

                // Handle refunds based on payment method and status
                if (status === 'Returned') {
                    if (order.paymentMethod === 'cod') {
                        // For COD returns, credit to wallet
                        await creditToWallet(
                            order.user,
                            order.totalAmount,
                            order._id,
                            `Refund for returned COD order #${order._id}`
                        );
                        console.log(`Credited ₹${order.totalAmount} to wallet for COD return`);
                    } else if (order.paymentStatus === 'Completed') {
                        // For online payments, credit to wallet
                        await creditToWallet(
                            order.user,
                            order.totalAmount,
                            order._id,
                            `Refund for returned order #${order._id}`
                        );
                        console.log(`Credited ₹${order.totalAmount} to wallet for online payment return`);
                    }
                } else if (status === 'Cancelled' && order.paymentStatus === 'Completed') {
                    // For cancellations, only credit if payment was completed
                    await creditToWallet(
                        order.user,
                        order.totalAmount,
                        order._id,
                        `Refund for cancelled order #${order._id}`
                    );
                    console.log(`Credited ₹${order.totalAmount} to wallet for cancellation`);
                }
            }
            // For new orders, reduce quantities
            else if (status === 'Processing' && order.status === 'Pending') {
                // Verify and reduce stock
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
            }

            // Update order status
            order.status = status;
            await order.save();
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ success: false, message: 'Failed to update order status' });
        }
    },

    getOrderDetails: async (req, res) => {
        try {
            const { orderId } = req.params;
            const order = await Order.findById(orderId)
                .populate({
                    path: 'user',
                    select: 'name email',
                    options: { strictPopulate: false }
                })
                .populate({
                    path: 'items.product',
                    select: 'productName productImage regularPrice'
                });
            
            if (!order) {
                return res.status(404).redirect('/admin/pageerror');
            }

            if (!order.user) {
                order.user = {
                    name: 'User not found',
                    email: 'Email not available'
                };
            }
            
            res.render('admin/order-details', { order });
        } catch (error) {
            console.error('Error fetching order details:', error);
            res.status(500).redirect('/admin/pageerror');
        }
    }
};

module.exports = orderController;
