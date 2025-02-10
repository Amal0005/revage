const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        appliedOffer: {
            percentage: Number,
            validUntil: Date
        }
    }],
    subtotal: {
        type: Number,
        required: true
    },
    shipping: {
        type: Number,
        default: 40
    },
    coupon: {
        code: String,
        discountType: String,
        discountValue: Number,
        discountAmount: Number
    },
    totalAmount: {  
        type: Number,
        required: true
    },
    shippingAddress: {
        fullName: String,
        phone: String,
        address: String,
        city: String,
        state: String,
        pincode: String
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'],
        default: 'Pending'
    },
    paymentMethod: {
        type: String,
        enum: ['razorpay', 'wallet', 'cod'],
        default: 'razorpay'
    },
    razorpayOrderId: {
        type: String,
        unique: true,
        sparse: true
    },
    razorpayPaymentId: {
        type: String,
        sparse: true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    returnRequest: {
        reason: {
            type: String,
            enum: ['wrong_item', 'defective', 'not_as_described', 'size_issue', 'quality_issue', 'other']
        },
        otherReason: {
            type: String,
            required: function() {
                return this.returnRequest && this.returnRequest.reason === 'other';
            }
        },
        comments: {
            type: String,
            default: ''
        },
        requestDate: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected'],
            default: 'Pending'
        }
    }
});

module.exports = mongoose.model('Order', orderSchema);