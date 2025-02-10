const Cart = require('../../models/cartModel');
const Product = require('../../models/productSchema');
const Coupon = require("../../models/couponSchema")
const loadCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ user: req.session.user })
            .populate({
                path: 'items.product',
                select: 'productName productImage regularPrice offer category isBlocked',
                populate: {
                    path: 'category',
                    select: 'categoryOffer categoryName isListed'
                }
            });

        if (!cart) {
            return res.render('user/cart', {
                cart: null,
                user: req.session.user
            });
        }

        const filteredCart = filterBlockedProducts(cart);

        let subtotal = 0;
        filteredCart.items.forEach(item => {
            const product = item.product;
            const productOffer = product.offer && product.offer.percentage ? product.offer.percentage : 0;
            const categoryOffer = product.category && product.category.categoryOffer ? product.category.categoryOffer : 0;
            const bestOffer = Math.max(productOffer, categoryOffer);
            
            let price = product.regularPrice;
            if (bestOffer > 0) {
                const discountAmount = (product.regularPrice * bestOffer) / 100;
                price = product.regularPrice - discountAmount;
            }
            
            subtotal += Math.round(price) * item.quantity;
        });

        const shipping = 0; // Free delivery
        const total = subtotal + shipping;

        res.render('user/cart', {
            cart: {
                items: filteredCart.items,
                subtotal,
                shipping,
                total
            },
            user: req.session.user

        });
    } catch (error) {
        console.error('Error in loadCart:', error);
        res.status(500).render('page-404', { error: 'Failed to load cart' });
    }
};

const filterBlockedProducts = (cart) => {
    if (!cart) return null;
    
    const filteredItems = cart.items.filter(item => {
        const product = item.product;
        return product && 
               !product.isBlocked && 
               product.category && 
               product.category.isListed === true;
    });

    // If there are blocked or unlisted items, update the cart in the database
    if (filteredItems.length !== cart.items.length) {
        Cart.findByIdAndUpdate(
            cart._id,
            { items: filteredItems },
            { new: true }
        ).catch(err => console.error('Error updating cart:', err));
    }

    return {
        ...cart.toObject(),
        items: filteredItems
    };
};

const updateQuantity = async (req, res) => {
    try {
        const { productId, action } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ message: 'Please login to continue' });
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const cartItem = cart.items.find(item => 
            item.product.toString() === productId
        );
        

        if (!cartItem) {
            return res.status(404).json({ message: 'Product not found in cart' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        if (action === 'increase') {
            if (cartItem.quantity >= 5) {
                return res.status(400).json({ message: 'Maximum quantity limit is 5 items per product' });
            }
            if (cartItem.quantity + 1 > product.quantity) {
                return res.status(400).json({ message: 'Not enough stock available' });
            }
            cartItem.quantity += 1;
        } else if (action === 'decrease') {
            if (cartItem.quantity > 1) {
                cartItem.quantity -= 1;
            } else {
                cart.items = cart.items.filter(item => 
                    item.product.toString() !== productId
                );
            }
        }

        await cart.save();
        
        res.json({ 
            success: true, 
            quantity: cartItem.quantity,
            total: cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
        });
    } catch (error) {
        console.error('Error in updateQuantity:', error);
        res.status(500).json({ message: 'Failed to update quantity' });
    }
};

const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ message: 'Please login to continue' });
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(item => 
            item.product.toString() === productId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Product not found in cart' });
        }

        cart.items.splice(itemIndex, 1);
        await cart.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error in removeFromCart:', error);
        res.status(500).json({ message: 'Failed to remove item from cart' });
    }
};

const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ status: false, message: 'Please login to continue' });
        }

        const product = await Product.findById(productId);
        if (!product || product.isBlocked) {
            return res.status(404).json({ status: false, message: 'Product not available' });
        }

        // Only check if enough stock is available, don't reduce it
        if (product.quantity < quantity) {
            return res.status(400).json({ status: false, message: 'Not enough stock available' });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        const existingItem = cart.items.find(item => 
            item.product.toString() === productId
        );

        if (existingItem) {
            return res.status(400).json({ 
                status: false, 
                message: 'This item is already in your cart. You can update the quantity from the cart page.'
            });
        }

        cart.items.push({
            product: productId,
            quantity: quantity
        });

        await cart.save();
        res.json({ status: true, message: 'Product added to cart successfully' });
    } catch (error) {
        console.error('Error in addToCart:', error);
        res.status(500).json({ status: false, message: 'Failed to add product to cart' });
    }
};

const applyCoupon = async (req, res) => {
    const { couponCode, cartTotal } = req.body;

    try {
        if (!couponCode) {
            return res.status(400).json({ message: 'Coupon code is required' });
        }

        const coupon = await Coupon.findOne({ code: couponCode });
        if (!coupon) {
            return res.status(400).json({ message: 'Invalid coupon code' });
        }

        const currentDate = new Date();
        if (new Date(coupon.expiryDate) < currentDate) {
            return res.status(400).json({ message: 'Coupon has expired' });
        }

        if (cartTotal < coupon.minPurchase) {
            return res.status(400).json({
                message: `Minimum purchase of ₹${coupon.minPurchase} is required`,
            });
        }

        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = (cartTotal * coupon.discount) / 100;
        } else {
            discountAmount = coupon.discount;
        }

        const finalTotal = cartTotal - discountAmount;

        console.log('Coupon applied successfully');
        res.status(200).json({ discountAmount, finalTotal, message: 'Coupon applied successfully!' });
    } catch (error) {
        console.error('Unexpected error in applyCoupon:', error);
        res.status(500).json({ message: 'Error applying coupon', error: error.message });
    }
};

module.exports = {
    loadCart,
    updateQuantity,
    removeFromCart,
    addToCart,
    applyCoupon
};
