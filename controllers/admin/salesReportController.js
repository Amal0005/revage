const Order = require("../../models/orderSchema");

const getSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Number of orders per page
        const skip = (page - 1) * limit;

        // Handle date filtering
        let dateFilter = {};
        const { startDate, endDate } = req.query;

        if (startDate && endDate) {
            dateFilter = {
                orderDate: {
                    $gte: new Date(startDate),
                    $lte: new Date(new Date(endDate).setHours(23, 59, 59))
                }
            };
        }

        // Get total count for pagination with date filter
        const totalOrders = await Order.countDocuments(dateFilter);
        const totalPages = Math.ceil(totalOrders / limit);

        // Get paginated orders with date filter
        const orders = await Order.find(dateFilter)
            .populate('user', 'name')
            .populate({
                path: 'items.product',
                select: 'productName offer regularPrice'
            })
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit);

        // Get total stats (filtered by date if specified)
        const allOrders = await Order.find(dateFilter).select('totalAmount status paymentMethod paymentStatus orderDate');
        const totalRevenue = allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const deliveredOrders = allOrders.filter(order => order.status === 'Delivered').length;
        const averageOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

        // Get payment method statistics
        const paymentStats = allOrders.reduce((acc, order) => {
            const method = order.paymentMethod || 'COD'; // Default to COD if not specified
            acc[method] = (acc[method] || 0) + 1;
            return acc;
        }, {});

        res.render('admin/sales-report', {
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            totalRevenue,
            deliveredOrders,
            averageOrderValue,
            paymentStats,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            lastPage: totalPages,
            startDate: startDate || '',
            endDate: endDate || ''
        });
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(500).render('admin/error', { message: 'Error fetching sales report' });
    }
};

module.exports = {
    getSalesReport
};
