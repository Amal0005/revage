const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");

const getLedger = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // Get date range from query parameters or default to current month
        let startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
        let endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

        // If no dates provided, set to current month
        if (!req.query.startDate) {
            startDate.setDate(1); // First day of current month
            startDate.setHours(0, 0, 0, 0);
        }
        if (!req.query.endDate) {
            endDate.setHours(23, 59, 59, 999);
        }

        // Get all transactions within date range
        const orders = await Order.find({
            orderDate: { $gte: startDate, $lte: endDate },
            status: { $nin: ['Cancelled'] }
        })
        .select('orderDate totalAmount paymentMethod status items subtotal coupon')
        .populate({
            path: 'items.product',
            select: 'productName regularPrice'
        })
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(limit);

        // Get wallet transactions
        const walletTransactions = await Wallet.aggregate([
            {
                $unwind: '$transactions'
            },
            {
                $match: {
                    'transactions.date': { $gte: startDate, $lte: endDate }
                }
            },
            {
                $project: {
                    date: '$transactions.date',
                    type: '$transactions.type',
                    amount: '$transactions.amount',
                    description: '$transactions.description'
                }
            },
            {
                $sort: { date: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }
        ]);

        // Combine and process transactions
        const ledgerEntries = [];

        // Process orders
        orders.forEach(order => {
            const discount = (order.subtotal || 0) - (order.totalAmount || 0);
            ledgerEntries.push({
                date: order.orderDate,
                type: 'Order',
                description: `Order #${order._id}`,
                credit: order.totalAmount || 0,
                debit: 0,
                paymentMethod: order.paymentMethod,
                status: order.status,
                discount: discount
            });
        });

        // Process wallet transactions
        walletTransactions.forEach(trans => {
            ledgerEntries.push({
                date: trans.date,
                type: 'Wallet',
                description: trans.description,
                credit: trans.type === 'credit' ? trans.amount : 0,
                debit: trans.type === 'debit' ? trans.amount : 0,
                paymentMethod: 'Wallet',
                status: 'Completed'
            });
        });

        // Sort all entries by date
        ledgerEntries.sort((a, b) => b.date - a.date);

        // Calculate totals
        const totalCredit = ledgerEntries.reduce((sum, entry) => sum + entry.credit, 0);
        const totalDebit = ledgerEntries.reduce((sum, entry) => sum + entry.debit, 0);
        const totalDiscount = ledgerEntries.reduce((sum, entry) => sum + (entry.discount || 0), 0);
        const netAmount = totalCredit - totalDebit;

        // Get total count for pagination
        const totalEntries = await Order.countDocuments({
            orderDate: { $gte: startDate, $lte: endDate },
            status: { $nin: ['Cancelled'] }
        });

        const totalPages = Math.ceil(totalEntries / limit);

        res.render('admin/ledger', {
            ledgerEntries,
            totalCredit,
            totalDebit,
            totalDiscount,
            netAmount,
            currentPage: page,
            totalPages,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        });

    } catch (error) {
        console.error('Error in ledger:', error);
        res.status(500).render('admin/error', { error: 'Failed to load ledger' });
    }
};

module.exports = {
    getLedger
};
