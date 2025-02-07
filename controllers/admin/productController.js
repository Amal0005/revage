const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const fsPromises = require("fs").promises;
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const getProductAddPage = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        res.render("admin/product-add", {
            categories: categories
        });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
};

const addProducts = async (req, res) => {
    try {
        console.log('Adding product...');
        console.log('Request body:', req.body);
        
        const category = await Category.findById(req.body.category);
        if (!category) {
            console.log('Invalid category:', req.body.category);
            return res.status(400).json({ error: "Invalid category" });
        }

        const existingProduct = await Product.findOne({ productName: req.body.productName });
        if (existingProduct) {
            console.log('Product already exists:', req.body.productName);
            return res.status(400).json({ error: "Product name already exists" });
        }

        let images = [];

        if (req.files && req.files.length > 0) {
            console.log('Processing traditional file uploads:', req.files.length);
            const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            for (const file of req.files) {
                try {
                    const timestamp = Date.now();
                    const filename = `product-${timestamp}-${file.originalname}`;
                    const imagePath = path.join(uploadDir, filename);

                    await sharp(file.buffer)
                        .resize(440, 440, {
                            fit: 'contain',
                            background: { r: 255, g: 255, b: 255, alpha: 1 }
                        })
                        .jpeg({ quality: 90 })
                        .toFile(imagePath);

                    images.push(filename);
                    console.log('Processed uploaded file:', filename);
                } catch (error) {
                    console.error('Error processing uploaded file:', error);
                }
            }
        }

        for (let i = 1; i <= 3; i++) {
            const croppedImage = req.body[`croppedImage${i}`];
            if (croppedImage && croppedImage.startsWith('data:image')) {
                try {
                    const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, '');
                    const imageBuffer = Buffer.from(base64Data, 'base64');

                    const timestamp = Date.now();
                    const filename = `product-${timestamp}-${i}.jpg`;

                    const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
                    if (!fs.existsSync(uploadDir)) {
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }

                    await sharp(imageBuffer)
                        .resize(440, 440, {
                            fit: 'contain',
                            background: { r: 255, g: 255, b: 255, alpha: 1 }
                        })
                        .jpeg({ quality: 90 })
                        .toFile(path.join(uploadDir, filename));

                    images.push(filename);
                    console.log('Processed cropped image:', filename);
                } catch (error) {
                    console.error('Error processing cropped image:', error);
                }
            }
        }

        if (images.length === 0) {
            console.log('No images provided');
            return res.status(400).json({ error: "At least one image is required" });
        }

        const productData = {
            productName: req.body.productName,
            description: req.body.description,
            category: category._id,
            regularPrice: Number(req.body.regularPrice),
            salePrice: req.body.salePrice ? Number(req.body.salePrice) : 0,
            quantity: Number(req.body.quantity),
            color: req.body.color,
            productImage: images,
            status: "Available"
        };

        console.log('Creating product with data:', productData);

        const product = new Product(productData);
        await product.save();
        
        console.log('Product saved successfully:', product);

        res.status(201).json({ success: true, message: "Product added successfully" });

    } catch (error) {
        console.error('Error in addProducts:', error);
        res.status(500).json({ 
            success: false, 
            error: error.name === 'ValidationError' 
                ? Object.values(error.errors).map(err => err.message).join(', ')
                : "Failed to add product: " + error.message
        });
    }
};

const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const query = {
            productName: { $regex: new RegExp(search, "i") }
        };

        const productData = await Product.find(query)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate("category")
            .sort({ createdOn: -1 })
            .exec();

        const count = await Product.countDocuments(query);

        const categories = await Category.find({ isListed: true });

        res.render("admin/products", {
            data: productData,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            cat: categories
        });
    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
};

const blockProduct = async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(400).json({ error: "Product ID is required" });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        await Product.findByIdAndUpdate(id, { isBlocked: true });
        res.status(200).send();
    } catch (error) {
        console.error("Error blocking product:", error);
        res.status(500).json({ error: "Failed to block product" });
    }
};

const unblockProduct = async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(400).json({ error: "Product ID is required" });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        await Product.findByIdAndUpdate(id, { isBlocked: false });
        res.status(200).send();
    } catch (error) {
        console.error("Error unblocking product:", error);
        res.status(500).json({ error: "Failed to unblock product" });
    }
}

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findById(id).populate('category');
        const categories = await Category.find();
        
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        
        res.render('admin/edit-product', {
            product,
            cat: categories,
            admin: true
        });
    } catch (error) {
        console.error('Error in getEditProduct:', error);
        res.status(500).json({ error: "Failed to fetch product" });
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        console.log('Delete image request:', req.body);
        const { productId, imageIndex } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        if (!product.productImage || imageIndex >= product.productImage.length) {
            return res.status(400).json({ error: "Image not found" });
        }

        const imageToDelete = product.productImage[imageIndex];

        product.productImage.splice(imageIndex, 1);
        await product.save();

        try {
            const imagePath = path.join(__dirname, '../../public/uploads/product-images', imageToDelete);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        } catch (error) {
            console.error('Error deleting image file:', error);
        }

        res.status(200).json({ success: true, message: "Image deleted successfully" });
    } catch (error) {
        console.error('Error in deleteSingleImage:', error);
        res.status(500).json({ error: "Failed to delete image" });
    }
};

const editProduct = async (req, res) => {
    try {
        console.log('Edit product request received:', req.body);

        const productId = req.body.productId;
        if (!productId) {
            return res.status(400).json({ error: "Product ID is required" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        const categoryId = req.body.category;
        if (!categoryId) {
            return res.status(400).json({ error: "Category ID is required" });
        }

        const regularPrice = Number(req.body.regularPrice);
        const salePrice = req.body.salePrice ? Number(req.body.salePrice) : 0;
        
        if (regularPrice <= 0) {
            return res.status(400).json({ error: "Regular price must be greater than 0" });
        }

        if (salePrice < 0) {
            return res.status(400).json({ error: "Sale price cannot be negative" });
        }

        if (salePrice > 0 && salePrice >= regularPrice) {
            return res.status(400).json({ error: "Regular price must be greater than sale price" });
        }

        const existingProduct = await Product.findOne({
            productName: req.body.productName,
            _id: { $ne: productId }
        });
        if (existingProduct) {
            return res.status(400).json({ error: "Product name already exists" });
        }

        let newImages = [...product.productImage];

        if (req.files && req.files.length > 0) {
            console.log('Processing uploaded files:', req.files.length);
            const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            for (const file of req.files) {
                try {
                    if (!file.buffer) throw new Error('File buffer is missing');

                    const timestamp = Date.now();
                    const filename = `product-${timestamp}-${file.originalname}`;
                    const imagePath = path.join(uploadDir, filename);

                    console.log(`Saving uploaded file: ${filename}`);

                    await sharp(file.buffer)
                        .resize(440, 440, {
                            fit: 'contain',
                            background: { r: 255, g: 255, b: 255, alpha: 1 }
                        })
                        .jpeg({ quality: 90 })
                        .toFile(imagePath);

                    newImages.push(filename);
                } catch (error) {
                    console.error('Error processing uploaded file:', error.message);
                }
            }
        }

        for (let i = 1; i <= 3; i++) {
            const croppedImage = req.body[`croppedImage${i}`];
            if (croppedImage && croppedImage.startsWith('data:image')) {
                try {
                    console.log(`Processing cropped image ${i}`);

                    const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, '');
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    const timestamp = Date.now();
                    const filename = `product-${timestamp}-${i}.jpg`;
                    const imagePath = path.join(__dirname, '../../public/uploads/product-images', filename);

                    await sharp(imageBuffer)
                        .resize(440, 440, {
                            fit: 'contain',
                            background: { r: 255, g: 255, b: 255, alpha: 1 }
                        })
                        .jpeg({ quality: 90 })
                        .toFile(imagePath);

                    newImages.push(filename);
                } catch (error) {
                    console.error('Error processing cropped image:', error.message);
                }
            }
        }

        const updateData = {
            productName: req.body.productName,
            description: req.body.description,
            category: categoryId,
            regularPrice: regularPrice,
            salePrice: salePrice,
            quantity: Number(req.body.quantity),
            color: req.body.color,
            productImage: newImages,
            updatedAt: new Date()
        };

        console.log('Updating product with data:', updateData);

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(500).json({ error: "Failed to update product" });
        }

        console.log('Product updated successfully:', updatedProduct);
        res.status(200).json({ success: true, message: "Product updated successfully", product: updatedProduct });

    } catch (error) {
        console.error('Error in editProduct:', error);
        res.status(500).json({
            success: false,
            error: error.name === 'ValidationError'
                ? Object.values(error.errors).map(err => err.message).join(', ')
                : "Failed to update product: " + error.message
        });
    }
};

const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage, startDate, endDate } = req.body;

        // Validate input
        if (!productId || !percentage || !startDate || !endDate) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Parse and validate percentage
        const offerPercentage = parseInt(percentage);
        if (isNaN(offerPercentage) || offerPercentage < 1 || offerPercentage > 99) {
            return res.status(400).json({ error: "Invalid percentage value" });
        }

        // Parse and validate dates
        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);
        
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            return res.status(400).json({ error: "Invalid date format" });
        }

        if (endDateTime <= startDateTime) {
            return res.status(400).json({ error: "End date must be after start date" });
        }

        // Update product with offer
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        product.offer = {
            percentage: offerPercentage,
            startDate: startDateTime,
            endDate: endDateTime
        };

        // Calculate and update sale price
        const discountAmount = (product.regularPrice * offerPercentage) / 100;
        product.salePrice = Math.round(product.regularPrice - discountAmount);

        await product.save();

        res.status(200).json({ message: "Offer added successfully" });
    } catch (error) {
        console.error("Error adding offer:", error);
        res.status(500).json({ error: "Failed to add offer" });
    }
};

const removeProductOffer = async (req, res) => {
    try {
        const productId = req.query.id;
        await Product.findByIdAndUpdate(productId, {
            $unset: { offer: 1 }
        });
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error removing product offer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category');
        
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(product);
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ error: "Failed to fetch product details" });
    }
};

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    addProductOffer,
    removeProductOffer,
    getProduct
};