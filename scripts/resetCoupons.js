const mongoose = require('mongoose');
const Coupon = require('../models/couponSchema');

const MONGODB_URL = 'mongodb://127.0.0.1:27017/REVAGE';

async function resetCoupons() {
    try {
        // Drop the collection
        try {
            await Coupon.collection.drop();
        } catch (dropError) {
            if (dropError.code === 26) {
            } else {
                throw dropError;
            }
        }

        // Create a test coupon to verify schema
        const testCoupon = new Coupon({
            code: 'TEST123',
            discountType: 'percentage',
            discount: 10,
            minPurchase: 100,
            expiryDate: new Date('2025-12-31')
        });

        await testCoupon.save();

        // Verify the coupon was saved
        const savedCoupon = await Coupon.findOne({ code: 'TEST123' });

    } catch (error) {
        console.error('Error resetting coupons:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Connect to MongoDB and run the reset
mongoose.connect(MONGODB_URL)
    .then(() => {
        return resetCoupons();
    })
    .catch(error => {
        console.error('Connection error:', error);
    });
