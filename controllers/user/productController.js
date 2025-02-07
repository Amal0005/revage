const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Wishlist = require("../../models/wishlistSchema");

// Helper function to calculate final price with offers
const calculatePriceWithOffers = (product) => {
  let offerPercentage = 0;
  
  // Check for product offer
  if (product.productOffer && product.productOffer > 0) {
    offerPercentage = product.productOffer;
  }
  
  // Check for category offer
  if (product.category && product.category.categoryOffer && product.category.categoryOffer > offerPercentage) {
    offerPercentage = product.category.categoryOffer;
  }

  const regularPrice = product.regularPrice;
  const finalPrice = offerPercentage > 0 
    ? Math.round(regularPrice * (1 - offerPercentage/100)) 
    : regularPrice;

  return {
    regularPrice,
    finalPrice,
    offerPercentage
  };
};

const productDetails = async (req, res) => {
  try {
    const productId = req.query.id;
    const productData = await Product.findById(productId).populate("category");

    if (!productData) {
      return res.status(404).render("page-404", { error: "Product not found" });
    }

    let userData = null;
    if (req.session && req.session.user) {
      userData = await User.findById(req.session.user);
    }

    const categoryOffer = productData.category?.categoryOffer || 0;
    const productOffer = productData.productOffer || 0;
    const totalOffer = categoryOffer + productOffer;

    res.render("user/product-details", {
      user: userData,
      product: {
        ...productData.toObject(),
        ...priceDetails
      },
      category: productData.category,
      totalOffer: priceDetails.offerPercentage
    });
  } catch (error) {
    console.error("Error in productDetails:", error);
    res
      .status(500)
      .render("page-404", { error: "Failed to load product details" });
  }
};

const loadProductDetails = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findOne({
      _id: productId,
      isBlocked: false,
    }).populate("category");

    if (!product) {
      return res.status(404).render("error", {
        message: "Product not found or is no longer available",
      });
    }

    let userData = null;
    if (req.session && req.session.user) {
      userData = await User.findById(req.session.user);
    }

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isBlocked: false,
      quantity: { $gt: 0 },
    }).limit(4);

    const priceDetails = calculatePriceWithOffers(product);

    res.render("user/product-details", {
      product: {
        ...product.toObject(),
        ...priceDetails
      },
      relatedProducts,
      user: userData,
      offerPercentage: priceDetails.offerPercentage
    });
  } catch (error) {
    console.error("Error in loadProductDetails:", error);
    res.status(500).render("error", { message: "Failed to load product details" });
  }
};

//for loading the shop page...........................................................................

const loadShoppingPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map((category) => category._id);

    const baseQuery = {
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 },
    };

    // Get user's wishlist
    let wishlistItems = [];
    if (req.session.user) {
      const wishlist = await Wishlist.findOne({ userId: req.session.user });
      if (wishlist) {
        wishlistItems = wishlist.products.map(item => item.productId.toString());
      }
    }

    if (req.query.search) {
      baseQuery.$or = [
        { productName: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.category) {
      const category = await Category.findOne({ name: req.query.category });
      if (category) {
        baseQuery.category = category._id;
      }
    }

    let sortOptions = { createdAt: -1 }; // default sort
    switch (req.query.sort) {
      case "price-low":
        sortOptions = { salePrice: 1 };
        break;
      case "price-high":
        sortOptions = { salePrice: -1 };
        break;
      case "name-asc":
        sortOptions = { productName: 1 };
        break;
      case "name-desc":
        sortOptions = { productName: -1 };
        break;
      case "popularity":
        sortOptions = { totalSales: -1 };
        break;
      case "rating":
        sortOptions = { averageRating: -1 };
        break;
      case "new":
        sortOptions = { createdAt: -1 };
        break;
      case "featured":
        sortOptions = { isFeatured: -1, createdAt: -1 };
        break;
    }

    const products = await Product.find(baseQuery)
      .populate('category')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const productsWithPrices = products.map(product => {
      const priceDetails = calculatePriceWithOffers(product);
      return {
        ...product.toObject(),
        ...priceDetails
      };
    });

    const totalProducts = await Product.countDocuments(baseQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    let userData = null;
    if (req.session && req.session.user) {
      userData = await User.findById(req.session.user);
    }

    if (req.xhr || req.headers.accept.includes("application/json")) {
      return res.render("user/partials/product-grid", {
        products: productsWithPrices,
        user: userData,
        wishlist: wishlistItems
      });
    }

    res.render("user/shop", {
      products: productsWithPrices,
      categories,
      currentPage: page,
      totalPages,
      user: userData,
      query: req.query || {},
      filters: {
        category: req.query.category || "",
        sort: req.query.sort || "newest",
      },
      wishlist: wishlistItems
    });
  } catch (error) {
    console.error("Error in loadShoppingPage:", error);
    res
      .status(500)
      .render("error", { message: "Failed to load shopping page" });
  }
};

module.exports = {
  productDetails,
  loadProductDetails,
  loadShoppingPage,
};
