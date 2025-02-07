const Cart = require('../models/cartSchema');
const Wishlist = require('../models/wishlistSchema');

const cartCount = async (req, res, next) => {
    try {
        if (req.session && req.session.user) {
            const cart = await Cart.findOne({ user: req.session.user });
            let totalQuantity = 0;
            if (cart && cart.items) {
                totalQuantity = cart.items.reduce((sum, item ) => sum + item.quantity, 0);
            }
            res.locals.cartCount = totalQuantity;
        } else {
            res.locals.cartCount = 0;
        }
        next();
    } catch (error) {
        res.locals.cartCount = 0;
        next();
    }
};

const wishlistCount = async (req, res, next) => {
    try {
        if (req.session && req.session.user) {
            const wishlist = await Wishlist.findOne({ userId: req.session.user });
            let count=0
            let totalQuantity = 0;
            if (wishlist && wishlist.products) {
            
                totalQuantity=wishlist.products.length
            }
            res.locals.wishlistCount = totalQuantity;
        } else {
            res.locals.wishlistCount = 0;
        
        }
        next();
    } catch (error) {
        console.error('Error getting wishlist count:', error);
        res.locals.wishlistCount = 0;
        next();
    }
};



module.exports ={ 
    cartCount,
    wishlistCount

}
