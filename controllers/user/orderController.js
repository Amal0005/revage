const Order = require('../../models/orderSchema');

const orderController = {
    getOrderDetails: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const userId = req.session.user;

            // Find order and populate product details
            const order = await Order.findOne({
                _id: orderId,
                user: userId
            }).populate({
                path: 'items.product',
                select: 'productName productImage salePrice'
            });

            if (!order) {
                return res.status(404).render('page-404', { error: 'Order not found' });
            }

            res.render('user/order-details', { 
                order,
                user: req.session.user 
            });
        } catch (error) {
            console.error('Error getting order details:', error);
            res.status(500).render('page-404', { error: 'Failed to load order details' });
        }
    },

    cancelOrder: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const userId = req.session.user;

            console.log('Attempting to cancel order:', orderId, 'for user:', userId);

            const order = await Order.findOne({ _id: orderId, user: userId });
            
            if (!order) {
                console.log('Order not found:', orderId);
                return res.status(404).json({ 
                    success: false, 
                    message: 'Order not found' 
                });
            }

            if (order.status === 'Delivered' || order.status === 'Cancelled') {
                console.log('Cannot cancel order with status:', order.status);
                return res.status(400).json({ 
                    success: false, 
                    message: `Cannot cancel order that is ${order.status.toLowerCase()}` 
                });
            }

            order.status = 'Cancelled';
            await order.save();

            console.log('Order cancelled successfully:', orderId);
            res.json({ 
                success: true, 
                message: 'Order cancelled successfully'
            });
        } catch (error) {
            console.error('Error cancelling order:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to cancel order' 
            });
        }
    },

    returnOrder: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const userId = req.session.user;

            const order = await Order.findOne({ _id: orderId, user: userId });
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            if (order.status !== 'Delivered') {
                return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
            }

            order.status = 'Return Requested';
            await order.save();

            res.json({ success: true, message: 'Return request submitted successfully' });
        } catch (error) {
            console.error('Error requesting return:', error);
            res.status(500).json({ success: false, message: 'Failed to submit return request' });
        }
    },

    downloadInvoice: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const userId = req.session.user;

            const order = await Order.findOne({ _id: orderId, user: userId })
                .populate({
                    path: 'items.product',
                    select: 'productName productImage salePrice'
                });

            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // TODO: Generate and send invoice
            res.json({ success: true, message: 'Invoice downloaded' });
        } catch (error) {
            console.error('Error downloading invoice:', error);
            res.status(500).json({ success: false, message: 'Failed to download invoice' });
        }
    },

    trackOrder: async (req, res) => {
        try {
            const orderId = req.params.orderId;
            const order = await Order.findById(orderId);

            if (!order) {
                return res.status(404).json({ message: 'Order not found' });
            }

            // For now, just render a simple tracking page
            res.render('user/track-order', { order });
        } catch (error) {
            console.error('Error tracking order:', error);
            res.status(500).json({ message: 'Failed to track order' });
        }
    }
};

module.exports = {
    getOrderDetails: orderController.getOrderDetails,
    cancelOrder: orderController.cancelOrder,
    returnOrder: orderController.returnOrder,
    downloadInvoice: orderController.downloadInvoice,
    trackOrder: orderController.trackOrder
};
