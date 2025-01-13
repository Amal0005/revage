const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")
const productController=require("../controllers/admin/productController")
const orderController = require("../controllers/admin/orderController")

const multer = require('multer');
const storage = multer.memoryStorage(); // Stores files in memory for sharp processing
const upload = multer({ storage });

const {userAuth,adminAuth}=require("../middlewares/auth")
// const uploads = require("../middlewares/upload");



router.get("/pageerror",adminController.pageerror)

router.get("/login", adminController.loadLogin);
router.post("/login",adminController.login)
router.get("/dashboard",adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout)

router.get("/users", adminAuth,customerController.customerInfo);
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerUnblocked)

router.get("/category",adminAuth,categoryController.categoryInfo)
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.get("/listCategory",adminAuth,categoryController.getListCategory)
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory)
router.get("/editCategory",adminAuth,categoryController.getEditCategory)
router.post("/editCategory", adminAuth,categoryController.editCategory);


//product management
router.get('/product-add',adminAuth,productController.getProductAddPage)
router.post("/product-add",upload.array("images",4),productController.addProducts)
router.get("/products",adminAuth,productController.getAllProducts)
router.get("/block-product",adminAuth,productController.blockProduct)
router.get("/unblock-product",adminAuth,productController.unblockProduct)
router.get("/edit-product",adminAuth,productController.getEditProduct)
router.post("/edit-product",upload.array("images",4),productController.editProduct)
router.post("/deleteImage",adminAuth,productController.deleteSingleImage)

// Order management
router.get("/orders", adminAuth, orderController.getAllOrders);
router.get("/orders/:orderId", adminAuth, orderController.getOrderDetails);
router.post("/orders/update-status", adminAuth, orderController.updateOrderStatus);

module.exports = router;
