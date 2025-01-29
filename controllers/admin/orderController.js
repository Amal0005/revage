const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');

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

                // Credit wallet if order was paid
                if (order.paymentStatus === 'Completed') {
                    // Find or create user's wallet
                    let wallet = await Wallet.findOne({ user: order.user });
                    console.log('Existing wallet:', wallet ? { id: wallet._id, balance: wallet.balance } : 'Not found');

                    if (!wallet) {
                        wallet = new Wallet({
                            user: order.user,
                            balance: 0,
                            transactions: []
                        });
                        await wallet.save();
                        console.log('Created new wallet');
                    }

                    // Credit the order amount to wallet
                    const refundAmount = order.totalAmount;
                    wallet.balance += refundAmount;
                    wallet.transactions.push({
                        amount: refundAmount,
                        type: 'credit',
                        description: `Refund for ${status.toLowerCase()} order #${order._id}`,
                        orderId: order._id,
                        date: new Date()
                    });
                    await wallet.save();
                    console.log('Wallet updated:', { 
                        id: wallet._id, 
                        newBalance: wallet.balance, 
                        refundAmount 
                    });

                    // Update user's wallet reference if not already added
                    const user = await User.findById(order.user);
                    if (!user) {
                        throw new Error('User not found');
                    }

                    if (!user.wallet) {
                        user.wallet = wallet._id;  
                        await user.save();
                        console.log('Added wallet reference to user');
                    }
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
                    select: 'name email'
                })
                .populate({
                    path: 'items.product',
                    select: 'productName productImage regularPrice'
                });
            
            if (!order) {
                return res.status(404).redirect('/admin/pageerror');
            }
            
            res.render('admin/order-details', { order });
        } catch (error) {
            console.error('Error fetching order details:', error);
            res.status(500).redirect('/admin/pageerror');
        }
    }
};

module.exports = orderController;
