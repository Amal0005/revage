const mongoose = require("mongoose")
const {Schema} = mongoose;
const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true,
        default: 0
    },
    productOffer: {
        type: Number,
        default: 0
    },
    offer: {
        percentage: {
            type: Number,
            min: 0,
            max: 99
        },
        validUntil: {
            type: Date
        }
    },
    quantity: {
        type: Number,
        required: true,
        default: 0
    },
    color: {
        type: String,
        required: true
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "out of stock", "Discontinued"],
        default: "Available"
    },
    createdOn: {
        type: Date,
        default: Date.now
    }
}, {timestamps: true});

const Product = mongoose.model("Product", productSchema)

module.exports = Product;