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




router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomepage)
router.get("/signup",userController.loadSignup)

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

// router.get("/shop",userAuth,userController.loadShoppingPage)

// Shop route
router.get('/shop', productController.loadShoppingPage);

//product Management
router.get("/product/:id", productController.loadProductDetails)

// Cart routes
router.get('/cart', userAuth, cartController.loadCart);
router.post('/cart/add', cartController.addToCart);
router.post('/cart/update-quantity', userAuth, cartController.updateQuantity);
router.post('/cart/remove-item', userAuth, cartController.removeFromCart);

// Checkout routes
router.get('/checkout', userAuth, checkoutController.getCheckoutPage);
router.post('/checkout/process', userAuth, checkoutController.processCheckout);

// Order routes
router.get('/order-details/:orderId', userAuth, orderController.getOrderDetails);
router.post('/order/:orderId/cancel', userAuth, orderController.cancelOrder);
router.post('/order/:orderId/return', userAuth, orderController.returnOrder);
router.get('/order/:orderId/invoice', userAuth, orderController.downloadInvoice);
router.get('/order/:orderId/track', userAuth, orderController.trackOrder);

// Cancel Order
router.post('/orders/:orderId/cancel', userAuth, orderController.cancelOrder);

//Profile Management
router.get("/profile", userAuth, profileController.userProfile);
// router.get("/change-email",userAuth,profileController,changeEmail)
router.get("/change-password",userAuth,profileController.changePassword)
router.post("/change-password",userAuth,profileController.changePasswordValid)
router.post("/verify-changePassword-otp",userAuth,profileController.verifyChangePasswordOtp)
router.post("/reset-password-otp",profileController.resetPassword)
router.get("/reset-password",profileController.getResetPassword)
router.post("/reset-password",profileController.postNewPassword)

router.post('/update-profile', profileController.updateProfile);

router.get("/forgot-password", profileController.getForgotPasswordPage);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passwordForgot-otp", profileController.verifyForgotPasswordOtp);
router.get("/reset-password", profileController.getResetPasswordPage);

// Address Management Routes
router.post('/add-address', userAuth, profileController.addAddress);
router.put('/edit-address/:index', userAuth, profileController.updateAddress);
router.delete('/delete-address/:index', userAuth, profileController.deleteAddress);
router.get('/get-address/:index', userAuth, profileController.getAddress);

module.exports=router;