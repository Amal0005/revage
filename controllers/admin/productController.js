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
        res.redirect("/pageerror");
    }
};

const addProducts = async (req, res) => {
    try {
        console.log('Adding product...');
        console.log('Request body:', req.body);
        
        // Get the category document
        const category = await Category.findById(req.body.category);
        if (!category) {
            console.log('Invalid category:', req.body.category);
            return res.json({ success: false, message: "Invalid category" });
        }

        // Check for duplicate product name
        const existingProduct = await Product.findOne({ productName: req.body.productName });
        if (existingProduct) {
            console.log('Product already exists:', req.body.productName);
            return res.json({ success: false, message: "Product name already exists" });
        }

        let images = [];

        // Handle traditional file uploads first
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

        // Handle cropped images
        for (let i = 1; i <= 3; i++) {
            const croppedImage = req.body[`croppedImage${i}`];
            if (croppedImage && croppedImage.startsWith('data:image')) {
                try {
                    // Convert base64 to buffer
                    const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, '');
                    const imageBuffer = Buffer.from(base64Data, 'base64');

                    // Generate filename
                    const timestamp = Date.now();
                    const filename = `product-${timestamp}-${i}.jpg`;

                    // Save image
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
            return res.json({ success: false, message: "At least one image is required" });
        }

        // Create new product
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

        res.json({ success: true, message: "Product added successfully" });

    } catch (error) {
        console.error('Error in addProducts:', error);
        res.json({ 
            success: false, 
            message: error.name === 'ValidationError' 
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

        // Get products with pagination
        const productData = await Product.find(query)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate("category")
            .sort({ createdOn: -1 })
            .exec();

        // Get total count for pagination
        const count = await Product.countDocuments(query);

        // Get categories for filtering
        const categories = await Category.find({ isListed: true });

        res.render("admin/products", {
            data: productData,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            cat: categories
        });
    } catch (error) {
        console.error("Error in getAllProducts:", error);
        res.redirect("/admin/pageerror");
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
        res.redirect("/admin/products");
    } catch (error) {
        console.error("Error blocking product:", error);
        res.redirect("/admin/pageerror");
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
        res.redirect("/admin/products");
    } catch (error) {
        console.error("Error unblocking product:", error);
        res.redirect("/admin/pageerror");
    }
}

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findById(id).populate('category');
        const categories = await Category.find();
        
        if (!product) {
            return res.redirect('/admin/products');
        }
        
        res.render('admin/edit-product', {
            product,
            cat: categories,
            admin: true
        });
    } catch (error) {
        console.error('Error in getEditProduct:', error);
        res.redirect('/admin/products');
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        console.log('Delete image request:', req.body);
        const { productId, imageIndex } = req.body;

        // Get the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.json({ success: false, message: "Product not found" });
        }

        // Check if image exists
        if (!product.productImage || imageIndex >= product.productImage.length) {
            return res.json({ success: false, message: "Image not found" });
        }

        // Get the image filename
        const imageToDelete = product.productImage[imageIndex];

        // Remove image from array
        product.productImage.splice(imageIndex, 1);
        await product.save();

        // Delete file from filesystem
        try {
            const imagePath = path.join(__dirname, '../../public/uploads/product-images', imageToDelete);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        } catch (error) {
            console.error('Error deleting image file:', error);
            // Continue even if file deletion fails
        }

        res.json({ success: true, message: "Image deleted successfully" });
    } catch (error) {
        console.error('Error in deleteSingleImage:', error);
        res.json({ success: false, message: "Failed to delete image" });
    }
};

// const editProduct = async (req, res) => {
//     try {
//         console.log('Edit product request received:', req.body);

//         const productId = req.query.id;
//         if (!productId) {
//             return res.json({ success: false, message: "Product ID is required" });
//         }

//         // Find the product
//         const product = await Product.findById(productId);
//         if (!product) {
//             return res.json({ success: false, message: "Product not found" });
//         }

//         // Validate category
//         const categoryId = req.body.category;
//         if (!categoryId) {
//             return res.json({ success: false, message: "Category ID is required" });
//         }

//         // Check for duplicate product name
//         const existingProduct = await Product.findOne({
//             productName: req.body.productName,
//             _id: { $ne: productId }
//         });
//         if (existingProduct) {
//             return res.json({ success: false, message: "Product name already exists" });
//         }

//         // Initialize newImages with existing product images
//         let newImages = [...product.productImage];

//         // Handle file uploads
//         if (req.files && req.files.length > 0) {
//             console.log('Processing uploaded files:', req.files.length);
//             const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
//             if (!fs.existsSync(uploadDir)) {
//                 fs.mkdirSync(uploadDir, { recursive: true });
//             }

//             for (const file of req.files) {
//                 try {
//                     if (!file.buffer) throw new Error('File buffer is missing');

//                     const timestamp = Date.now();
//                     const filename = `product-${timestamp}-${file.originalname}`;
//                     const imagePath = path.join(uploadDir, filename);

//                     console.log(`Saving uploaded file: ${filename}`);

//                     await sharp(file.buffer)
//                         .resize(440, 440, {
//                             fit: 'contain',
//                             background: { r: 255, g: 255, b: 255, alpha: 1 }
//                         })
//                         .jpeg({ quality: 90 })
//                         .toFile(imagePath);

//                     newImages.push(filename);
//                 } catch (error) {
//                     console.error('Error processing uploaded file:', error.message);
//                 }
//             }
//         }

//         // Handle cropped images
//         for (let i = 1; i <= 3; i++) {
//             const croppedImage = req.body[`croppedImage${i}`];
//             if (croppedImage && croppedImage.startsWith('data:image')) {
//                 try {
//                     console.log(`Processing cropped image ${i}`);

//                     const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, '');
//                     const imageBuffer = Buffer.from(base64Data, 'base64');
//                     const timestamp = Date.now();
//                     const filename = `product-${timestamp}-${i}.jpg`;
//                     const imagePath = path.join(__dirname, '../../public/uploads/product-images', filename);

//                     await sharp(imageBuffer)
//                         .resize(440, 440, {
//                             fit: 'contain',
//                             background: { r: 255, g: 255, b: 255, alpha: 1 }
//                         })
//                         .jpeg({ quality: 90 })
//                         .toFile(imagePath);

//                     newImages.push(filename);
//                 } catch (error) {
//                     console.error('Error processing cropped image:', error.message);
//                 }
//             }
//         }

//         // Update product data
//         const updateData = {
//             productName: req.body.productName,
//             description: req.body.description,
//             category: categoryId,
//             regularPrice: Number(req.body.regularPrice),
//             salePrice: req.body.salePrice ? Number(req.body.salePrice) : 0,
//             quantity: Number(req.body.quantity),
//             color: req.body.color,
//             productImage: newImages,
//             updatedAt: new Date()
//         };

//         console.log('Updating product with data:', updateData);

//         const updatedProduct = await Product.findByIdAndUpdate(
//             productId,
//             updateData,
//             { new: true, runValidators: true }
//         );

//         if (!updatedProduct) {
//             return res.json({ success: false, message: "Failed to update product" });
//         }

//         console.log('Product updated successfully:', updatedProduct);
//         res.json({ success: true, message: "Product updated successfully", product: updatedProduct });

//     } catch (error) {
//         console.error('Error in editProduct:', error);
//         res.json({
//             success: false,
//             message: error.name === 'ValidationError'
//                 ? Object.values(error.errors).map(err => err.message).join(', ')
//                 : "Failed to update product: " + error.message
//         });
//     }
// };


const editProduct = async (req, res) => {
    try {
        console.log('Edit product request received:', req.body);

        const productId = req.query.id;
        if (!productId) {
            return res.json({ success: false, message: "Product ID is required" });
        }

        // Find the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.json({ success: false, message: "Product not found" });
        }

        // Validate category
        const categoryId = req.body.category;
        if (!categoryId) {
            return res.json({ success: false, message: "Category ID is required" });
        }

        // Validate prices
        const regularPrice = Number(req.body.regularPrice);
        const salePrice = req.body.salePrice ? Number(req.body.salePrice) : 0;
        
        // Check for negative prices
        if (regularPrice <= 0) {
            return res.json({ success: false, message: "Regular price must be greater than 0" });
        }

        if (salePrice < 0) {
            return res.json({ success: false, message: "Sale price cannot be negative" });
        }

        // Check if regular price is less than sale price
        if (salePrice > 0 && salePrice >= regularPrice) {
            return res.json({ success: false, message: "Regular price must be greater than sale price" });
        }

        // Check for duplicate product name
        const existingProduct = await Product.findOne({
            productName: req.body.productName,
            _id: { $ne: productId }
        });
        if (existingProduct) {
            return res.json({ success: false, message: "Product name already exists" });
        }

        // Initialize newImages with existing product images
        let newImages = [...product.productImage];

        // Handle file uploads
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

        // Handle cropped images
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

        // Update product data
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
            return res.json({ success: false, message: "Failed to update product" });
        }

        console.log('Product updated successfully:', updatedProduct);
        res.json({ success: true, message: "Product updated successfully", product: updatedProduct });

    } catch (error) {
        console.error('Error in editProduct:', error);
        res.json({
            success: false,
            message: error.name === 'ValidationError'
                ? Object.values(error.errors).map(err => err.message).join(', ')
                : "Failed to update product: " + error.message
        });
    }
};
module.exports = { editProduct };

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
};