const mongoose = require('mongoose');
require('dotenv').config();
const Coupon = require('../models/couponSchema');

const MONGODB_URL = 'mongodb://127.0.0.1:27017/REVAGE';

async function checkCoupons() {
    try {
        // Get all coupons
        const coupons = await Coupon.find({}).lean();
        coupons.forEach(coupon => {
          
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
           
        } else {
        }

        // Check for malformed codes
        const malformed = coupons.filter(coupon => {
            const code = coupon.code;
            return !code || code !== code.trim() || code !== code.toUpperCase();
        });

        if (malformed.length > 0) {
         
        } else {
        }

    } catch (error) {
    } finally {
        await mongoose.disconnect();
    }
}

// Connect to MongoDB and run the check
mongoose.connect(MONGODB_URL)
    .then(() => {
        return checkCoupons();
    })
    .catch(error => {
        console.error('Connection error:', error);
    });
