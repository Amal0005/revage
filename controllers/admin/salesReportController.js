const Order = require("../../models/orderSchema");

const getSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 15;
        const skip = (page - 1) * limit;

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

        const totalOrders = await Order.countDocuments(dateFilter);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(dateFilter)
            .populate('user', 'name')
            .populate({
                path: 'items.product',
                select: 'productName offer regularPrice'
            })
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit);

        const allOrders = await Order.find(dateFilter)
            .populate({
                path: 'items.product',
                select: 'productName offer regularPrice category',
                populate: {
                    path: 'category',
                    select: 'categoryOffer'
                }
            })
            .select('totalAmount subtotal status paymentMethod paymentStatus orderDate items coupon');
        
        // Calculate total revenue excluding cancelled and returned orders
        const totalRevenue = allOrders.reduce((sum, order) => {
            if (order.status !== 'Cancelled' && order.status !== 'Returned') {
                return sum + (order.totalAmount || 0);
            }
            return sum;
        }, 0);

        // Calculate total discount including product offers, category offers, and coupons
        const totalDiscount = allOrders.reduce((sum, order) => {
            if (order.status !== 'Cancelled' && order.status !== 'Returned') {
                let orderDiscount = 0;

                // Calculate product and category offer discounts
                order.items.forEach(item => {
                    if (item.product) {
                        const regularPrice = item.product.regularPrice || 0;
                        const productOffer = item.product.offer ? item.product.offer.percentage : 0;
                        const categoryOffer = item.product.category ? item.product.category.categoryOffer : 0;
                        const bestOffer = Math.max(productOffer, categoryOffer);
                        
                        if (bestOffer > 0) {
                            const discountAmount = (regularPrice * bestOffer) / 100;
                            orderDiscount += discountAmount * item.quantity;
                        }
                    }
                });

                // Add coupon discount if any
                if (order.coupon && order.coupon.discount) {
                    orderDiscount += order.coupon.discount;
                }

                return sum + orderDiscount;
            }
            return sum;
        }, 0);

        const deliveredOrders = allOrders.filter(order => order.status === 'Delivered').length;
        const averageOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

        const paymentStats = allOrders.reduce((acc, order) => {
            const method = order.paymentMethod || 'COD';
            acc[method] = (acc[method] || 0) + 1;
            return acc;
        }, {});

        res.render('admin/sales-report', {
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            totalRevenue,
            totalDiscount,
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
