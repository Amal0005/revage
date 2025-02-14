const Wishlist = require("../../models/wishlistSchema");
const Product = require('../../models/productSchema');
const User = require("../../models/userSchema");

const loadWishlist = async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        const userId = req.session.user;

        // First verify if user exists
        const userExists = await User.findById(userId);
        if (!userExists) {
            return res.redirect('/login');
        }

        const wishlist = await Wishlist.findOne({ userId })
        .populate({
            path: 'products.productId',
            select: 'productName productImage regularPrice salePrice quantity category isBlocked',
            populate: {
                path: 'category',
                select: 'name isBlocked isListed'
            }
        });

        
        const products = wishlist ? wishlist.products
        .filter(item => {
            const product = item.productId;
            return product && 
                   !product.isBlocked && 
                   product.category && 
                   product.category.isListed === true;
        })
        .map(item => {
            const product = item.productId;
            return {
                _id: product._id,
                productName: product.productName,
                productImage: product.productImage || [],
                regularPrice: product.regularPrice || 0,
                salePrice: product.salePrice || product.regularPrice || 0,
                stock: product.quantity || 0,
                isBlocked: product.isBlocked || false,
                category: {
                    name: product.category ? product.category.name : 'Uncategorized',
                    isBlocked: product.category ? product.category.isBlocked : false,
                    isListed: product.category ? product.category.isListed : false
                },
                wishlistItemId: item._id
            };
        }) : [];

        // Remove products with unlisted categories from database
        if (wishlist) {
            const hasUnlistedProducts = wishlist.products.some(item => {
                const product = item.productId;
                return !product || !product.category || product.category.isListed !== true;
            });

            if (hasUnlistedProducts) {
                wishlist.products = wishlist.products.filter(item => {
                    const product = item.productId;
                    return product && 
                           product.category && 
                           product.category.isListed === true;
                });
                await wishlist.save();
            }
        }


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
        const productId = req.body.productId;
        const userId = req.session.user;

        // Validate product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.json({ status: false, message: "Product not found" });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        const existingProduct = wishlist.products.find(item =>
            item.productId && item.productId.toString() === productId
        );

        if (existingProduct) {
            // Remove the product if it exists
            wishlist.products = wishlist.products.filter(item =>
                item.productId.toString() !== productId
            );
            await wishlist.save();
            return res.json({ 
                status: true, 
                action: 'removed',
                message: "Product removed from wishlist" 
            });
        } else {
            // Add the product if it doesn't exist
            wishlist.products.push({ productId });
            await wishlist.save();
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
        const { wishlistItemId } = req.body;
        const userId = req.session.user;

        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            return res.json({ status: false, message: "Wishlist not found" });
        }

        // Remove the item from the wishlist
        wishlist.products = wishlist.products.filter(item =>
            item._id.toString() !== wishlistItemId
        );

        await wishlist.save();
        return res.json({ status: true, message: "Item removed from wishlist" });

    } catch (error) {
        console.error('Error in removeFromWishlist:', error);
        return res.redirect('/pageNotFound');
    }
};

const getProducts = async (req, res) => {
    try {
        const userId = req.session.user; // Get the user ID from the session
        const products = await Product.find(); // Get all products
        let wishlist = [];

        if (userId) {
            // Fetch the user's wishlist
            const userWishlist = await Wishlist.findOne({ userId }).populate('products.productId');
            
            // If the user has a wishlist, extract the product IDs
            if (userWishlist) {
                wishlist = userWishlist.products.map(item => item.productId.toString());
            }
        }


        // Render the page, passing the products and wishlist data
        res.render('user/shop', {
            products,
            wishlist, // Passing wishlist to EJS
        });

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