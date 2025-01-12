// const multer = require("multer");
// const path = require("path");

// // Configure multer for handling file uploads
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         // Set the destination to the public/uploads/product-images directory
//         const uploadPath = path.join(__dirname, '../public/uploads/product-images');
//         cb(null, uploadPath);
//     },
//     filename: function (req, file, cb) {
//         // Create a unique filename with timestamp
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
//     }
// });

// // File filter to allow only images
// const fileFilter = (req, file, cb) => {
//     if (file.mimetype.startsWith('image/')) {
//         cb(null, true);
//     } else {
//         cb(new Error('Not an image! Please upload an image.'), false);
//     }
// };

// // Initialize multer with configuration
// const upload = multer({
//     storage: storage,
//     fileFilter: fileFilter,
//     limits: {
//         fileSize: 5 * 1024 * 1024 // 5MB limit
//     }
// });

// module.exports = upload;
