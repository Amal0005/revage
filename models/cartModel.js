const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
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
            min: 1,
            default: 1
        }
    }],
    total: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update total when items are modified
cartSchema.pre('save', async function(next) {
    if (this.isModified('items')) {
        // Populate products to get their prices
        await this.populate('items.product');
        
        // Calculate total
        this.total = this.items.reduce((total, item) => {
            return total + (item.product.salePrice * item.quantity);
        }, 0);

        this.updatedAt = new Date();
    }
    next();
});

module.exports = mongoose.model('Cart', cartSchema);
