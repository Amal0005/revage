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
        console.error("Error in loadProductDetails:", error);
        res.status(500).render("page-404", { error: "Failed to load product details" });
    }
};

const loadShoppingPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        let query = {};
        let sort = {};

        // Handle search query
        const searchQuery = req.query.search;
        if (searchQuery) {
            query.productName = { $regex: searchQuery, $options: 'i' };
        }

        // Handle category filter
        const categoryFilter = req.query.category;
        if (categoryFilter) {
            query.category = categoryFilter;
        }

        // Handle price filter
        const priceFilter = req.query.price;
        if (priceFilter) {
            switch(priceFilter) {
                case 'under500':
                    query.salePrice = { $lt: 500 };
                    break;
                case '500-1000':
                    query.salePrice = { $gte: 500, $lte: 1000 };
                    break;
                case '1000-1500':
                    query.salePrice = { $gte: 1000, $lte: 1500 };
                    break;
                case 'above1500':
                    query.salePrice = { $gt: 1500 };
                    break;
            }
        }

        // Handle sorting
        const sortType = req.query.sort;
        if (sortType) {
            switch(sortType) {
                case 'popularity':
                    sort = { purchaseCount: -1 };
                    break;
                case 'price-low':
                    sort = { salePrice: 1 };
                    break;
                case 'price-high':
                    sort = { salePrice: -1 };
                    break;
                case 'rating':
                    sort = { averageRating: -1 };
                    break;
                case 'featured':
                    sort = { isFeatured: -1 };
                    break;
                case 'new':
                    sort = { createdAt: -1 };
                    break;
                case 'name-asc':
                    sort = { productName: 1 };
                    break;
                case 'name-desc':
                    sort = { productName: -1 };
                    break;
                default:
                    sort = { createdAt: -1 };
            }
        }

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        // Get products with pagination and sorting
        const products = await Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        // Get categories for sidebar
        const categories = await Category.find();

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
            searchQuery,
            user: userData
        });
    } catch (error) {
        console.error('Error in loadShoppingPage:', error);
        res.status(500).render('page-404', { error: 'Failed to load shopping page' });
    }
};

module.exports = {
    productDetails,
    loadProductDetails,
    loadShoppingPage
};
