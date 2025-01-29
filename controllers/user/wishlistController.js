const Wishlist = require("../../models/wishlistSchema");
const Product = require('../../models/productSchema');
const User = require("../../models/userSchema");

const loadWishlist = async (req, res) => {
    try {
        console.log('1. Starting loadWishlist...');
        if (!req.session || !req.session.user) {
            console.log('No user session, redirecting to login');
            return res.redirect('/login');
        }

        console.log('2. User session found:', req.session.user);
        const userId = req.session.user;

        // First verify if user exists
        const userExists = await User.findById(userId);
        if (!userExists) {
            console.log('User not found in database');
            return res.redirect('/login');
        }

        console.log('3. Looking for wishlist with userId:', userId);
        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'products.productId',
                select: 'productName productImage regularPrice salePrice quantity category status',
                populate: {
                    path: 'category',
                    select: 'name'
                }
            });

        console.log('4. Wishlist found:', wishlist ? 'Yes' : 'No');
        
        const products = wishlist ? wishlist.products
            .filter(item => item.productId) 
            .map(item => {
                const product = item.productId;
                return {
                    _id: product._id,
                    productName: product.productName,
                    productImage: product.productImage || [],
                    regularPrice: product.regularPrice || 0,
                    salePrice: product.salePrice || product.regularPrice || 0,
                    stock: product.quantity || 0,
                    category: product.category || { name: 'Uncategorized' },
                    wishlistItemId: item._id
                };
            }) : [];

        console.log('5. Mapped products:', products.length);

        return res.render("user/wishlist", {
            user: req.session.user,
            wishlist: products,
            wishlistCount: products.length
        });

    } catch (error) {
        console.error('Error in loadWishlist:', error);
        // Log specific error details
        if (error.name === 'CastError') {
            console.error('Invalid ID format');
        } else if (error.name === 'ValidationError') {
            console.error('Validation Error:', error.message);
        }
        return res.redirect('/');
    }
};

const addToWishlist = async (req, res) => {
    try {
        console.log('1. Starting addToWishlist...');
        const productId = req.body.productId;
        console.log('2. Product ID:', productId);
        const userId = req.session.user;
        console.log('3. User ID:', userId);

        // Validate product exists
        console.log('4. Validating product exists...');
        const product = await Product.findById(productId);
        if (!product) {
            console.log('Product not found, returning error');
            return res.json({ status: false, message: "Product not found" });
        }

        console.log('5. Product found, proceeding...');
        let wishlist = await Wishlist.findOne({ userId });
        console.log('6. Wishlist found:', wishlist ? 'Yes' : 'No');

        if (!wishlist) {
            console.log('7. Creating new wishlist...');
            wishlist = new Wishlist({ userId, products: [] });
        }

        console.log('8. Checking for existing product in wishlist...');
        const existingProduct = wishlist.products.find(item =>
            item.productId && item.productId.toString() === productId
        );

        if (existingProduct) {
            console.log('9. Product exists in wishlist, removing...');
            // Remove the product if it exists
            wishlist.products = wishlist.products.filter(item =>
                item.productId.toString() !== productId
            );
            await wishlist.save();
            console.log('10. Product removed, returning success');
            return res.json({ 
                status: true, 
                action: 'removed',
                message: "Product removed from wishlist" 
            });
        } else {
            console.log('11. Product does not exist in wishlist, adding...');
            // Add the product if it doesn't exist
            wishlist.products.push({ productId });
            await wishlist.save();
            console.log('12. Product added, returning success');
            return res.json({ 
                status: true, 
                action: 'added',
                message: "Product added to wishlist" 
            });
        }
    } catch (error) {
        console.error('Error in addToWishlist:', error);
        return res.redirect('/pageNotFound');
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        console.log('1. Starting removeFromWishlist...');
        const { wishlistItemId } = req.body;
        console.log('2. Wishlist item ID:', wishlistItemId);
        const userId = req.session.user;
        console.log('3. User ID:', userId);

        console.log('4. Finding wishlist...');
        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            console.log('Wishlist not found, returning error');
            return res.json({ status: false, message: "Wishlist not found" });
        }

        console.log('5. Removing item from wishlist...');
        // Remove the item from the wishlist
        wishlist.products = wishlist.products.filter(item =>
            item._id.toString() !== wishlistItemId
        );

        await wishlist.save();
        console.log('6. Item removed, returning success');
        return res.json({ status: true, message: "Item removed from wishlist" });

    } catch (error) {
        console.error('Error in removeFromWishlist:', error);
        return res.redirect('/pageNotFound');
    }
};

const getProducts = async (req, res) => {
    try {
        console.log('1. Starting getProducts...');
        const userId = req.session.user; // Get the user ID from the session
        console.log('2. User ID:', userId);
        const products = await Product.find(); // Get all products
        console.log('3. Products found:', products.length);
        let wishlist = [];

        if (userId) {
            console.log('4. Fetching user wishlist...');
            // Fetch the user's wishlist
            const userWishlist = await Wishlist.findOne({ userId }).populate('products.productId');
            
            console.log('5. Wishlist found:', userWishlist ? 'Yes' : 'No');
            // If the user has a wishlist, extract the product IDs
            if (userWishlist) {
                wishlist = userWishlist.products.map(item => item.productId.toString());
                console.log('6. Wishlist products:', wishlist.length);
            }
        }

        console.log('7. Rendering shop view...');
        // Render the page, passing the products and wishlist data
        res.render('user/shop', {
            products,
            wishlist, // Passing wishlist to EJS
        });

        console.log('8. Render completed');
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.redirect('/pageNotFound');
    }
};


module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist,
    getProducts,
};