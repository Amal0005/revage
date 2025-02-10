const Coupon = require('../models/couponSchema');

const getActiveCoupon = async (req, res, next) => {
    try {
        const currentDate = new Date();
        const activeCoupon = await Coupon.findOne({
            expiryDate: { $gte: currentDate },
            discountType: 'percentage'
        }).sort({ discount: -1 }); // Get the coupon with highest discount

        if (activeCoupon) {
            res.locals.activeCoupon = {
                code: activeCoupon.code,
                percentage: activeCoupon.discount,
                minPurchase: activeCoupon.minPurchase,
                expiryDate: activeCoupon.expiryDate
            };
        }
        next();
    } catch (error) {
        console.error('Error fetching active coupon:', error);
        next();
    }
};

module.exports = getActiveCoupon;
