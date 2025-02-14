// const multer = require('multer');
// const path = require('path');

// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, path.join(__dirname, 'public/uploads/userimages')); // Ensure this directory exists
//     },
//     filename: function (req, file, cb) {
//         cb(null, Date.now() + '-' + file.originalname); // Unique file name
//     }
// });

// const upload = multer({ storage: storage });