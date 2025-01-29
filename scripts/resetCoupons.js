const mongoose = require('mongoose');
const Coupon = require('../models/couponSchema');

const MONGODB_URL = 'mongodb://127.0.0.1:27017/REVAGE';

async function resetCoupons() {
    try {
        // Drop the collection
        try {
            await Coupon.collection.drop();
            console.log('Dropped coupons collection');
        } catch (dropError) {
            if (dropError.code === 26) {
                console.log('Collection does not exist, will create new one');
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
        console.log('Created test coupon:', testCoupon.toObject());

        // Verify the coupon was saved
        const savedCoupon = await Coupon.findOne({ code: 'TEST123' });
        console.log('Retrieved test coupon:', savedCoupon ? savedCoupon.toObject() : null);

    } catch (error) {
        console.error('Error resetting coupons:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Connect to MongoDB and run the reset
mongoose.connect(MONGODB_URL)
    .then(() => {
        console.log('Connected to MongoDB');
        return resetCoupons();
    })
    .catch(error => {
        console.error('Connection error:', error);
    });
