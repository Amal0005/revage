const User = require("../../models/userSchema");
const category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const env = require("dotenv").config();
const bcrypt = require("bcryptjs"); // Correct import

const nodemailer = require("nodemailer");

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};
const loadHomepage = async (req, res) => {
  try {
    // Get all active categories first
    const categories = await category.find({ isListed: true });
    const categoryIds = categories.map(cat => cat._id);

    // Get products from active categories
    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categoryIds },
      quantity: { $gt: 0 }
    }).populate('category');

    // Sort by creation date and get latest 6 products
    productData.sort((a,b) => new Date(a.createdOn) - new Date(b.createdOn));
    productData = productData.slice(0, 6);

    // Get user data if logged in
    let userData = null;
    if (req.session && req.session.user) {
      userData = await User.findById(req.session.user);
    }

    res.render("user/home", { 
      user: userData,
      products: productData,
      categories: categories
    });
  } catch (error) {
    console.error("Error in loadHomepage:", error);
    res.status(500).render("page-404", { error: "Failed to load homepage" });
  }
};

const loadLogin = async (req, res) => {
  try {
    res.render("user/login");
  } catch (error) {
    console.log("login not found");
    res.status(500).send("userlogin error");
  }
};
const loadSignup = async (req, res) => {
  try {
    return res.render("user/signup");
  } catch (error) {
    console.log("homepage not loading");
    res.status(500).send("user/login error");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    // Create a transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false, // Use `true` for port 465
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL, // Ensure this is set in your .env file
        pass: process.env.NODEMAILER_PASSWORD, // Ensure this is set in your .env file
      },
    });

    // Send the email
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL, // Sender email
      to: email, // Receiver email
      subject: "Verify your account",
      text: `Your OTP is ${otp}`, // Plain text body
      html: `<b>Your OTP: ${otp}</b>`, // HTML body
    });

    console.log("Email sent successfully:", info.response);
    return info.accepted.length > 0; // Return true if the email was accepted
  } catch (error) {
    console.error("Error sending email:", error);
    return false; // Return false on failure
  }
}



const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cPassword } = req.body;
    console.log("name",req.body);


    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("user/signup", { message: "" });
    }

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };

    console.log("Session OTP:", req.session.userData);

    res.render("user/verify-otp");
    console.log("OTP sent:", otp);
  } catch (error) {
    console.error("Signup error:", error);
    res.render("user/signup", { message: "An error occurred during signup" });
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error("Error securing password:", error);
    throw error;
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Received OTP:", otp);
    console.log("Session OTP:", req.session.userOtp);

    if (!req.session.userOtp || !req.session.userData) {
      console.log("Session data missing");
      return res.status(400).json({ success: false, message: "Session data missing. Please try again." });
    }

    if (otp === String(req.session.userOtp)) {
      const user = req.session.userData;
      console.log("User data from session:", user);

      const passwordHash = await securePassword(user.password);
      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      });

      await saveUserData.save();
      req.session.user = saveUserData._id;

      delete req.session.userOtp;
      delete req.session.userData;

      res.json({ success: true, redirectUrl: "/" });
    } else {
      console.log("Invalid OTP");
      res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
    }
  } catch (error) {
    console.error("Error Verifying OTP:", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};

const resendOtp = async (req, res) => {
  try {
    // Retrieve email from session
    const { email } = req.session.userData || {};
    if (!email) {
      console.log("Email not found in session");
      return res.status(400).json({ success: false, message: "Email not found in session" });
    }

    console.log("Attempting to generate OTP for email:", email);

    // Generate a new OTP and store it in the session
    const otp = generateOtp();
    req.session.userOtp = otp;

    console.log("Generated OTP:", otp);
    console.log("OTP stored in session:", req.session.userOtp);

    // Send the OTP email
    const emailSent = await sendVerificationEmail(email, otp).catch((err) => {
      console.error("Error sending email:", err);
      return false;
    });

    if (!emailSent) {
      console.log("Failed to send OTP email to:", email);
      return res.status(500).json({ success: false, message: "Failed to send OTP. Try again" });
    }

    console.log("Resend OTP successful for email:", email,"otp:",otp);
    req.session.save((err) => {
      if (err) {
        console.error("Error saving session:", err);
        return res.status(500).json({ success: false, message: "Internal server error" });
      }

      return res.status(200).json({ success: true, message: "OTP resent successfully" });
    });
  } catch (error) {
    console.error("Unexpected error resending OTP:", error.message, error.stack);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};



const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Server-side validation
    if (!email || !password) {
      return res.render("user/login", { message: "Email and password are required" });
    }

    const findUser = await User.findOne({ isAdmin: 0, email: email });
    if (!findUser) {
      return res.render("user/login", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("user/login", { message: "User is blocked by admin" });
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("user/login", { message: "Incorrect password" });
    }
    req.session.user = findUser._id;
    res.redirect("/");
  } catch (error) {
    console.error("login error", error);
    res.render("user/login", { message: "An error occurred during login" });
  }
};

const logout =async(req,res)=>{
  try {
    req.session.destroy((err)=>{
      if(err){
      console.log("Session destruction error",err.message);
      return res.redirect("/pageNotFound")
      }
      return res.redirect("login")
    })
  } catch (error) {
    console.log("logout error",error);
    res.redirect("/pageNotFound")
    
  }
}
const userProfile = async (req, res) => {
  try {
      const user = req.session.user;

      if (!user) {
          return res.redirect("/login");
      }

   


      res.render("profile", {
          user: user,
      });
  } catch (error) {
      console.error("Error fetching user profile:", error.message);
      res.status(500).send("Internal Server Error");
  }
};

const loadShoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id})
    const categories = await Category.find({isListed:true});
    const categoryIds=categories.map((category)=>category._id.toString());
    const page=parseInt(req.query.page)||1;
    const limit = 9;
    const skip = (page - 1) * limit;
    const product=await Product.find({
      isBlocked:false,
      category:{$in:categoryIds},
      quantity:{$gt:0},
    
    }).sort({createdOn:-1}).skip(skip).limit(limit);
    const totalProduct=await Product.countDocuments({
      isBlocked:false,
      category:{$in:categoryIds},
      quantity:{$gt:0},
    });
    const totalPages=Math.ceil(totalProduct/limit);

    const categoriesWithIds=categories.map(category=>({_id:category._id.toString(),name:category.name}));



    res.render("user/shop", {
      user: userData,
      products: product,
      categories: categoriesWithIds,
      totalProducts: totalProduct,
      currentPage: page,
      totalpages: totalPages 
    });
    
  } catch (error) {
    res.redirect("/pageNotFound");
  }
}


const productDetail = async (req, res) => {
  try {
      const userId = req.session.user;
      const userData = await User.findById(userId);
      
      const productId = req.query.id;

      const product = await Product.findById(productId).populate('category');

      const findCategory = product.category;

      const recommendedProduct = await Product.find({ category: findCategory, _id: { $ne: productId } });

      const categoryOffer = findCategory?.categoryOffer || 0;
      const productOffer = product.productOffer || 0;
      const totalOffer = categoryOffer + productOffer;

      res.render("productDetails", {
          user: userData,
          product: product,
          quantity: product.quantity,
          totalOffer: totalOffer,
          category: findCategory,
          recommendedProduct
      });

  } catch (error) {
      console.error("Error for fetching product details", error);
      res.redirect("/pageNotFound");
  }
};



module.exports = {
  loadHomepage,
  pageNotFound,
  loadLogin,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  login,
  logout,
  userProfile,
  loadShoppingPage,
  productDetail,
   generateOtp, 
   sendVerificationEmail 
};
