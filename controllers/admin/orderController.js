const Order = require('../../models/orderSchema');

const orderController = {
    // Get all orders
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
            await Order.findByIdAndUpdate(orderId, { status });
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
