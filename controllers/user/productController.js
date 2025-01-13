const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");

const productDetails = async (req, res) => {
    try {
        const productId = req.query.id;
        const productData = await Product.findById(productId).populate("category");

        if (!productData) {
            return res.status(404).render("page-404", { error: "Product not found" });
        }

        // Get user data if logged in
        let userData = null;
        if (req.session && req.session.user) {
            userData = await User.findById(req.session.user);
        }

        const categoryOffer = productData.category?.categoryOffer || 0;
        const productOffer = productData.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;

        res.render("user/product-details", {
            user: userData,
            product: productData,
            category: productData.category,
            totalOffer: totalOffer
        });
    } catch (error) {
        console.error("Error in productDetails:", error);
        res.status(500).render("page-404", { error: "Failed to load product details" });
    }
};

const loadProductDetails = async (req, res) => {
    try {
        const productId = req.params.id;
        
        // Find product and check if it's blocked
        const product = await Product.findOne({ 
            _id: productId,
            isBlocked: false 
        }).populate('category');

        if (!product) {
            return res.status(404).render('error', { 
                message: 'Product not found or is no longer available' 
            });
        }

        // Get user data if logged in
        let userData = null;
        if (req.session && req.session.user) {
            userData = await User.findById(req.session.user);
        }

        // Get related products from same category (also not blocked)
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isBlocked: false,
            quantity: { $gt: 0 }
        }).limit(4);

        // Calculate offers
        const categoryOffer = product.category?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;

        res.render('user/product-details', {
            product,
            relatedProducts,
            user: userData,
            totalOffer
        });

    } catch (error) {
        console.error('Error in loadProductDetails:', error);
        res.status(500).render('error', { message: 'Failed to load product details' });
    }
};

const loadShoppingPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        // Get categories that are listed
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map(category => category._id);

        // Base query for active products
        const baseQuery = {
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 }
        };

        // Add search query if present
        if (req.query.search) {
            baseQuery.$or = [
                { productName: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Add category filter if present
        if (req.query.category) {
            baseQuery.category = req.query.category;
        }

        // Add price filter if present
        if (req.query.minPrice || req.query.maxPrice) {
            baseQuery.price = {};
            if (req.query.minPrice) baseQuery.price.$gte = parseFloat(req.query.minPrice);
            if (req.query.maxPrice) baseQuery.price.$lte = parseFloat(req.query.maxPrice);
        }

        // Get products with pagination
        const products = await Product.find(baseQuery)
            .populate('category')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(baseQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        // Get user data if logged in
        let userData = null;
        if (req.session && req.session.user) {
            userData = await User.findById(req.session.user);
        }

        res.render('user/shop', {
            products,
            categories,
            currentPage: page,
            totalPages,
            user: userData,
            query: req.query || {},
            filters: {
                minPrice: req.query.minPrice || '',
                maxPrice: req.query.maxPrice || '',
                category: req.query.category || '',
                sort: req.query.sort || 'newest'
            }
        });

    } catch (error) {
        console.error('Error in loadShoppingPage:', error);
        res.status(500).render('error', { message: 'Failed to load shopping page' });
    }
};

module.exports = {
    productDetails,
    loadProductDetails,
    loadShoppingPage
};
