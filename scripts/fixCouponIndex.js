const mongoose = require('mongoose');
const Coupon = require('../models/couponSchema');

async function fixCouponIndex() {
    try {
        // Drop existing indexes
        await Coupon.collection.dropIndexes();
        console.log('Dropped existing indexes');

        // Create new case-insensitive index
        await Coupon.collection.createIndex(
            { code: 1 },
            { 
                unique: true,
                collation: { locale: 'en', strength: 2 }
            }
        );
        console.log('Created new case-insensitive index');

        // List all indexes to verify
        const indexes = await Coupon.collection.getIndexes();
        console.log('Current indexes:', indexes);

    } catch (error) {
        console.error('Error fixing indexes:', error);
    } finally {
        mongoose.disconnect();
    }
}

// Connect to MongoDB and run the fix
mongoose.connect(process.env.MONGODB_URL)
    .then(() => {
        console.log('Connected to MongoDB');
        return fixCouponIndex();
    })
    .catch(error => {
        console.error('Connection error:', error);
    });
