const express=require("express")
const router=express.Router();
const userController=require("../controllers/user/userController");
const passport = require("../config/passport");
const userAuth=require("../middlewares/auth").userAuth
const productController=require("../controllers/user/productController")
const profileController=require("../controllers/user/profileController")
const cartController = require("../controllers/user/cartController");
const checkoutController = require("../controllers/user/checkoutController");
const orderController = require("../controllers/user/orderController");
const wishlistController = require("../controllers/user/wishlistController");
const couponController=require("../controllers/user/couponController")
const razorpayController = require('../controllers/user/paymentController.js');
const contactController = require('../controllers/user/contactController.js');
const { cartCount, wishlistCount } = require('../middlewares/count.js');
console.log(cartCount)


router.use(cartCount);
router.use(wishlistCount);


router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomepage)
router.get("/signup",userController.loadSignup)
router.get("/about", (req, res) => {
    res.render('user/about', { user: req.session.user });
});
router.get("/contact", (req, res) => {
    res.render('user/contact', { user: req.session.user });
});
router.post("/contact", contactController.submitContactForm);

router.post("/signup", userController.signup);
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)

router.get("/auth/google", (req, res, next) => {
    console.log("Initiating Google OAuth login...");
    next();
  }, passport.authenticate("google", { scope: ["profile", "email"] }));
  
  router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/signup" }),
    async (req, res) => {
      try {
        if (req.user) {
          req.session.user = req.user._id;
          await req.session.save(); 
          console.log("Authentication successful. Redirecting to home page...");
          res.redirect("/");
        } else {
          res.redirect("/login");
        }
      } catch (error) {
        console.error("Error in Google callback:", error);
        res.redirect("/login");
      }
    }
  );
  
router.get("/login",userController.loadLogin)
router.post("/login",userController.login)
router.get("/userProfile",userAuth,userController.userProfile)
router.get("/logout",userController.logout)


// Shop...............................
router.get('/shop', productController.loadShoppingPage);

//product...............................
router.get("/product/:id", productController.loadProductDetails)

// Cart...............................
router.get('/cart', userAuth, cartController.loadCart);
router.post('/cart/add', cartController.addToCart);
router.post('/cart/update-quantity', userAuth, cartController.updateQuantity);
router.post('/cart/remove-item', userAuth, cartController.removeFromCart);

// Wishlist...............................
router.get('/wishlist', userAuth, wishlistController.loadWishlist);
router.post('/addToWishlist', userAuth, wishlistController.addToWishlist);
router.post('/wishlist/remove', userAuth, wishlistController.removeFromWishlist);

// Checkout...............................
router.get('/checkout', userAuth, checkoutController.getCheckoutPage);
router.post('/checkout/process', userAuth, checkoutController.processCheckout);

// Order...............................
router.get('/order-details/:orderId', userAuth, orderController.getOrderDetails);
router.post('/orders/:orderId/cancel', userAuth, orderController.cancelOrder);
router.post('/orders/:orderId/return', userAuth, orderController.returnOrder);
router.get('/order/:orderId/invoice', userAuth, orderController.downloadInvoice);
router.post('/retry-payment/:orderId', userAuth, razorpayController.retryPayment);

//Profile...............................
router.get("/profile", userAuth, profileController.userProfile);
router.get("/change-password",userAuth,profileController.changePassword)
router.post("/change-password",userAuth,profileController.changePasswordValid)
router.post("/verify-changePassword-otp",userAuth,profileController.verifyChangePasswordOtp)
router.post("/resend-changePassword-otp", userAuth, profileController.resendOtp)
router.post("/reset-password-otp",profileController.resetPassword)
router.get("/reset-password",profileController.getResetPassword)
router.post("/reset-password",profileController.postNewPassword)
router.post('/update-profile', profileController.updateProfile);
router.get("/forgot-password", profileController.getForgotPasswordPage);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passwordForgot-otp", profileController.verifyForgotPasswordOtp);
router.get("/reset-password", profileController.getResetPasswordPage);

// Password Reset Routes
router.get('/pass-reset', userAuth, (req, res) => {
    res.render('user/pass-reset');
});

router.post('/update-password', userAuth, async (req, res) => {
    try {
        await profileController.updatePassword(req, res);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
});

// Address...............................
router.get('/get-address/:index', userAuth, profileController.getAddress);
router.put('/update-address', userAuth, profileController.updateAddress);
router.post('/add-address', userAuth, profileController.addAddress);
router.put('/edit-address/:index', userAuth, profileController.updateAddress);
router.delete('/delete-address/:index', userAuth, profileController.deleteAddress);

// Order...............................
router.get('/orders/:orderId', userAuth, orderController.getOrderDetails);
router.post('/orders/:orderId/cancel', userAuth, orderController.cancelOrder);
router.post('/orders/:orderId/return', userAuth, orderController.returnOrder);
router.post('/checkout/process-order', userAuth, orderController.checkout);

//coupons...............................
router.get('/coupons', userAuth, couponController.getAvailableCoupons);
router.post('/apply-coupon', userAuth, couponController.applyCoupon);
router.post('/create-razorpay-order', userAuth, razorpayController.createRazorpayOrder);
router.post('/verify-payment', userAuth, razorpayController.verifyPayment);
router.get('/payment-details/:paymentId', userAuth, razorpayController.getPaymentDetails);

// Retry payment routes
router.post('/retry-payment/:orderId', userAuth, orderController.retryPayment);
router.post('/verify-payment', userAuth, orderController.verifyPayment);

module.exports=router;