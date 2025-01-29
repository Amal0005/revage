const Coupon = require('../../models/couponSchema');

// Get available coupons
const getAvailableCoupons = async (req, res) => {
    try {
        const currentDate = new Date();
        const coupons = await Coupon.find({ expiryDate: { $gte: currentDate } });

        if (!coupons.length) {
            return res.status(200).json([]);
        }

        res.status(200).json(coupons);
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ message: 'Error fetching coupons' });
    }
};

// Apply a coupon to the cart total
const applyCoupon = async (req, res) => {
    try {
        const { couponCode, cartTotal } = req.body;

        if (!couponCode || !cartTotal) {
            return res.status(400).json({ message: 'Coupon code and cart total are required.' });
        }

        const coupon = await Coupon.findOne({ code: couponCode, expiryDate: { $gte: new Date() } });
        if (!coupon) {
            return res.status(404).json({ message: 'Invalid or expired coupon.' });
        }

        if (cartTotal < coupon.minPurchase) {
            return res.status(400).json({ message: `Minimum purchase of ₹${coupon.minPurchase} required.` });
        }

        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = (cartTotal * coupon.discount) / 100;
        } else if (coupon.discountType === 'fixed') {
            discountAmount = coupon.discount;
        }

        discountAmount = Math.min(discountAmount, cartTotal);
        const finalTotal = cartTotal - discountAmount;

        res.status(200).json({
            discountAmount,
            finalTotal,
            message: 'Coupon applied successfully.',
        });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ message: 'Error applying coupon' });
    }
};

module.exports = {
    getAvailableCoupons,
    applyCoupon,
};
