const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
    code: { 
        type: String, 
        required: true,
        trim: true,
        uppercase: true,
        index: {
            unique: true,
            collation: { locale: 'en', strength: 2 } // Case-insensitive index
        }
    },
    discount: { 
        type: Number, 
        required: true,
        min: 0
    },
    discountType: { 
        type: String, 
        enum: ['percentage', 'fixed'], 
        required: true 
    },
    minPurchase: { 
        type: Number, 
        default: 0,
        min: 0 
    },
    expiryDate: { 
        type: Date, 
        required: true 
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Coupon', CouponSchema);
