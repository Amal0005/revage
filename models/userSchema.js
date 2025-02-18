const mongoose = require('mongoose');
const { Schema } = mongoose;

const addressSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    houseName: {
        type: String,
        required: true
    },
    street: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    pincode: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    }
});

const userSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse:true,
        default:null
    },
    googleId: {
        type: String,
        unique:true,
    },
    password: {
        type: String,
        required:  false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cart"
    }],
    wallet: {
        type: Schema.Types.ObjectId,
        ref: 'Wallet'
    },
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    addresses: [addressSchema],
    createdOn: {
        type: Date,
        default: Date.now
    },
    referalCode: {
        type: String
    },
    redeemed: {
        type: Boolean
    }, 
    redeemedUser: [{
        type: Schema.Types.ObjectId,
        ref: "user"
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            require:true,
        },
        brand: {
            type: String
        },
        searchOn: {
            type: Date,
            default: Date.now
        }
    }]
});

const User = mongoose.model("User", userSchema);
module.exports = User;
