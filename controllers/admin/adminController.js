const User = require("../../models/userSchema");
const Order = require("../../models/orderModel");
const Product = require("../../models/productSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const pageerror = async (req, res) => {
  res.render("admin/admin-error");
};

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin/admin-login", { message: null });
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });
    if(!admin){
      return res.render("admin/admin-login", { message: "User not found" });

    }
    if (admin) {
      const passwordMatch = bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;

        return res.redirect("/admin/dashboard");
      } else {
        return res.redirect("/admin/login");
      }
    } else {
   
      return res.redirect('/admin/login');
    }
  } catch (error) {
    console.log("login error", error);
    return res.redirect("/pageerror");
  }
};

const loadDashboard = async (req, res) => {
  try {
    // Get total revenue
    const orders = await Order.find();
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Get total orders count
    const totalOrders = await Order.countDocuments();

    // Get total products count
    const totalProducts = await Product.countDocuments();

    // Get monthly earnings (current month)
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthlyOrders = await Order.find({
      orderDate: { $gte: firstDayOfMonth }
    });
    const monthlyEarnings = monthlyOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Get recent orders
    const recentOrders = await Order.find()
      .populate('user', 'name')
      .populate('items.product', 'productName')
      .sort({ orderDate: -1 })
      .limit(5);

    const dashboardData = {
      totalRevenue,
      totalOrders,
      totalProducts,
      monthlyEarnings,
      recentOrders
    };

    res.render("admin/dashboard", dashboardData);
  } catch (error) {
    console.error("Dashboard error:", error);
    res.redirect("/pageerror");
  }
};

const logout = async (req, res) => {
  console.log("Logged out");
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session", err);
        return res.redirect("/pageerror");
      }
      res.clearCookie("connect.sid");
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log("Unexpected error during logout", error);
    res.redirect("/pageerror");
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
};
