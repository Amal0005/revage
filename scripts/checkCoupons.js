const mongoose = require('mongoose');
require('dotenv').config();
const Coupon = require('../models/couponSchema');

const MONGODB_URL = 'mongodb://127.0.0.1:27017/REVAGE';

async function checkCoupons() {
    try {
        // Get all coupons
        const coupons = await Coupon.find({}).lean();
        console.log('\nAll coupons in database:');
        coupons.forEach(coupon => {
            console.log({
                id: coupon._id,
                code: coupon.code,
                discountType: coupon.discountType,
                discount: coupon.discount,
                minPurchase: coupon.minPurchase,
                expiryDate: coupon.expiryDate
            });
        });

        // Check for duplicate codes (case-insensitive)
        const codeMap = new Map();
        const duplicates = [];
        
        coupons.forEach(coupon => {
            const code = coupon.code.trim().toUpperCase();
            if (codeMap.has(code)) {
                duplicates.push({
                    code,
                    ids: [codeMap.get(code)._id, coupon._id]
                });
            } else {
                codeMap.set(code, coupon);
            }
        });

        if (duplicates.length > 0) {
            console.log('\nFound duplicate codes:');
            console.log(duplicates);
        } else {
            console.log('\nNo duplicate codes found');
        }

        // Check for malformed codes
        const malformed = coupons.filter(coupon => {
            const code = coupon.code;
            return !code || code !== code.trim() || code !== code.toUpperCase();
        });

        if (malformed.length > 0) {
            console.log('\nFound malformed codes:');
            console.log(malformed);
        } else {
            console.log('\nNo malformed codes found');
        }

    } catch (error) {
        console.error('Error checking coupons:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Connect to MongoDB and run the check
mongoose.connect(MONGODB_URL)
    .then(() => {
        console.log('Connected to MongoDB');
        return checkCoupons();
    })
    .catch(error => {
        console.error('Connection error:', error);
    });
