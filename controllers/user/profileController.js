const User=require("../../models/userSchema")
const bcrypt=require("bcryptjs")
const nodemailer=require("nodemailer")
const env=require("dotenv").config();
const session=require("express-session");
const Order = require("../../models/orderModel"); // Fixed import path
// const { generateOtp, sendVerificationEmail } = require("./userController");
const generateOtp=()=>{
    const digits="1234567890";
    let otp="";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];

    }
    return otp
}

const sendVerificationEmail= async(email,otp)=>{
    try {
        const transporter=nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,


            }
        })

        const mailOptions={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for password reset",
            text:`Your OTP is ${otp}`,
            html:`<b><h4> Your OTP:${otp}</h4><br></b>`
        }

        const info=await transporter.sendMail(mailOptions)
        console.log("Email sent :",info.messageId);
        return true;
        

    } catch (error) {
        console.error("Error sending email",error)
        return false
    }
}



const userProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        
        // Fetch user's orders
        const orders = await Order.find({ user: userId })
            .populate({
                path: 'items.product',
                select: 'productName productImage salePrice'
            })
            .sort({ orderDate: -1 }); // Most recent orders first

        if (!user) {
            return res.redirect('/login');
        }

        res.render('user/profile', { 
            user,
            orders,
            addresses: user.addresses || []
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).send('Internal Server Error');
    }
};

const changePassword=async(req,res)=>{
    try {
        res.render("user/change-password")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}
const changePasswordValid = async (req, res) => {
    try { 
        const { email } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("user/change-password-otp", { email: email });
                console.log("OTP", otp);
            } else {
                res.render("user/change-password", {
                    message: "Failed to send OTP. Please try again."
                });
            }
        } else {
            res.render("user/change-password", {
                message: "User with this email does not exist"
            });
        }
    } catch (error) {
        console.error("Error in change password validation:", error);
        res.redirect("/pageNotFound");
    }
};

const verifyChangePasswordOtp=async(req,res)=>{
    try {
        const enteredOtp=req.body.otp;
        if(enteredOtp===req.session.userOtp){
            // res.json({
            //     success:true,
            //     redirectUrl:"user/reset-password"
            // })
            res.redirect('/reset-password')
        }else{
            res.json({
                success:false,
                message:"otp is not matching"
            })
        }

    } catch (error) {
        res.status(500).json({success:false,message:"An error occured. PLease try again later"})
    }
}
const updateProfile = async (req, res) => {
    try {
        console.log("Request body:", req.body);
        const { name, phone } = req.body;
        const userId = req.session.user; 

        if (!userId) {
            console.error("Unauthorized access. User not logged in.");
            return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
        }

        const user = await User.findById(userId);
        if (!user) {
            console.error("User not found for ID:", userId);
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Update fields
        if (name) user.name = name;
        if (phone) user.phone = phone;

        await user.save();

        console.log("Profile updated successfully:", user);
        res.json({ success: true, message: "Profile updated successfully!" });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ success: false, message: "An error occurred while updating the profile." });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;
        const email = req.session.email;
        console.log("session ",req.session)
        if (!email) {
            return res.render("user/reset-password", { message: "Session expired. Please try again." });
        }
        if (newPass1 === newPass2) {
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email },
                { $set: { password: passwordHash } }
            );
            req.session.destroy((err) => {
                if (err) console.error("Session destruction error:", err);
                res.redirect("/login");
            });
        } else {
            res.render("user/reset-password", { message: "Passwords do not match" });
        }
    } catch (error) {
        console.error("Error resetting password:", error);
        res.redirect("/pageNotFound");
    }
};
const getResetPassword=async(req,res)=>{
    try{
     res.render('user/reset-password')
    }
    catch(error){

    }
}


const postNewPassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.status(400).render("user/reset-password", { message: "Passwords do not match." });
        }

        const userId = req.session.user?.userId;
        if (!userId) {
            return res.redirect("/login");
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).render("user/reset-password", { message: "User not found." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        await user.save();

        res.redirect("/login");
    } catch (error) {
        console.error("Error updating password:", error.message);
        res.status(500).render("user/reset-password", { message: "An error occurred. Please try again later." });
    }
};
 
const getForgotPasswordPage=async(req,res)=>{
    try {
        res.render("user/forgot-password")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const forgotEmailValid=async(req,res)=>{
    try {
        const {email}=req.body
        const findUser=await User.findOne({email:email})
        if(findUser){
            const otp=generateOtp()
            const emailSent=await sendVerificationEmail(email,otp)
            if(emailSent){
                req.session.userOtp=otp
                req.session.email=email
                res.render("user/forgotPassword-otp")
          console.log("otp:",otp);
          
            }else{
                res.json({
                    success:false,
                    message:"Failed to send OTP.please try again"
                })
            }
        }else{
            res.render("user/forgot-password",{
                message:"User with this email does exists"
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

// Controller (profileController.js)
const verifyForgotPasswordOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        console.log('Entered OTP:', enteredOtp); // Debug log
        console.log('Session OTP:', req.session.userOtp); // Debug log
        console.log('OTP Types:', {
            enteredOtp: typeof enteredOtp,
            sessionOtp: typeof req.session.userOtp
        }); // Debug log for types

        // Convert both OTPs to strings for comparison
        if (String(enteredOtp) === String(req.session.userOtp)) {
            // Set a flag in session to indicate OTP is verified
            req.session.isOtpVerified = true;
            
            return res.json({
                success: true,
                redirectUrl: "/reset-password"
            })
        } else {
            return res.json({
                success: false,
                message: 'OTP not matching'
            });
        }
    } catch (error) {
        console.error('OTP verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again'
        });
    }
};



const getResetPasswordPage = async (req, res) => {
    try {
        // Check if OTP was verified
        if (!req.session.isOtpVerified) {
            return res.redirect('/user/forgot-password');
        }
        
        res.render("reset-password");
    } catch (error) {
        console.error('Reset password page error:', error);
        res.redirect("/pageNotFound");
    }
};

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressData = req.body;

        // Validate required fields
        const requiredFields = ['name', 'houseName', 'street', 'city', 'state', 'pincode', 'phone'];
        for (const field of requiredFields) {
            if (!addressData[field]) {
                return res.status(400).json({ 
                    success: false, 
                    message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required` 
                });
            }
        }

        // Validate phone number (10 digits)
        if (!/^\d{10}$/.test(addressData.phone)) {
            return res.status(400).json({ 
                success: false, 
                message: "Phone number must be 10 digits" 
            });
        }

        // Validate pincode (6 digits)
        if (!/^\d{6}$/.test(addressData.pincode)) {
            return res.status(400).json({ 
                success: false, 
                message: "PIN code must be 6 digits" 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Initialize addresses array if it doesn't exist
        if (!user.addresses) {
            user.addresses = [];
        }

        // Add new address to the array
        user.addresses.push(addressData);
        await user.save();

        res.json({ success: true, message: "Address added successfully" });
    } catch (error) {
        console.error("Error adding address:", error);
        res.status(500).json({ success: false, message: "Failed to add address" });
    }
};

const updateAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressIndex, ...addressData } = req.body;

        // Validate required fields
        const requiredFields = ['name', 'houseName', 'street', 'city', 'state', 'pincode', 'phone'];
        for (const field of requiredFields) {
            if (!addressData[field]) {
                return res.status(400).json({ 
                    success: false, 
                    message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required` 
                });
            }
        }

        // Validate phone number (10 digits)
        if (!/^\d{10}$/.test(addressData.phone)) {
            return res.status(400).json({ 
                success: false, 
                message: "Phone number must be 10 digits" 
            });
        }

        // Validate pincode (6 digits)
        if (!/^\d{6}$/.test(addressData.pincode)) {
            return res.status(400).json({ 
                success: false, 
                message: "PIN code must be 6 digits" 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!user.addresses || !user.addresses[addressIndex]) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        // Update the address at the specified index
        user.addresses[addressIndex] = addressData;
        await user.save();

        res.json({ success: true, message: "Address updated successfully" });
    } catch (error) {
        console.error("Error updating address:", error);
        res.status(500).json({ success: false, message: "Failed to update address" });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressIndex } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (!user.addresses || !user.addresses[addressIndex]) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        // Remove the address at the specified index
        user.addresses.splice(addressIndex, 1);
        await user.save();

        res.json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
        console.error("Error deleting address:", error);
        res.status(500).json({ success: false, message: "Failed to delete address" });
    }
};

module.exports = {
    userProfile,
    changePassword,
    changePasswordValid,
    verifyChangePasswordOtp,
    updateProfile,
    resetPassword,
    getResetPassword,
    postNewPassword,
    getForgotPasswordPage,
    forgotEmailValid,
    verifyForgotPasswordOtp,
    getResetPasswordPage,
    addAddress,
    updateAddress,
    deleteAddress
};
