const Cart = require('../../models/cartModel');
const Product = require('../../models/productSchema');

const loadCart = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        // Find user's cart and populate product details
        const cart = await Cart.findOne({ user: req.session.user })
            .populate({
                path: 'items.product',
                select: 'productName productImage salePrice'
            });

        if (!cart) {
            return res.render('user/cart', {
                cart: null,
                user: req.session.user
            });
        }

        // Calculate totals
        let subtotal = 0;
        cart.items.forEach(item => {
            subtotal += item.product.salePrice * item.quantity;
        });

        const shipping = subtotal > 0 ? 40 : 0; // Example shipping cost
        const total = subtotal + shipping;

        res.render('user/cart', {
            cart: {
                items: cart.items,
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

const updateQuantity = async (req, res) => {
    try {
        const { productId, action } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ message: 'Please login to continue' });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(item => 
            item.product.toString() === productId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Product not found in cart' });
        }

        // Update quantity
        if (action === 'increase') {
            cart.items[itemIndex].quantity += 1;
        } else if (action === 'decrease') {
            if (cart.items[itemIndex].quantity > 1) {
                cart.items[itemIndex].quantity -= 1;
            } else {
                cart.items.splice(itemIndex, 1);
            }
        }

        await cart.save();
        res.json({ success: true });
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
            return res.status(401).json({ message: 'Please login to continue' });
        }

        // Check if product exists and is available
        const product = await Product.findById(productId);
        if (!product || product.isBlocked) {
            return res.status(404).json({ message: 'Product not available' });
        }

        // Find or create cart
        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        // Check if product already in cart
        const existingItem = cart.items.find(item => 
            item.product.toString() === productId
        );

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.items.push({
                product: productId,
                quantity: quantity
            });
        }

        await cart.save();
        res.json({ success: true, message: 'Product added to cart' });
    } catch (error) {
        console.error('Error in addToCart:', error);
        res.status(500).json({ message: 'Failed to add item to cart' });
    }
};

module.exports = {
    loadCart,
    updateQuantity,
    removeFromCart,
    addToCart
};
