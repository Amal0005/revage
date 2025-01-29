const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
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
    // Get all orders and filter out any without totalAmount
    const orders = await Order.find().select('totalAmount orderDate status');
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    const totalOrders = await Order.countDocuments();

    const totalProducts = await Product.countDocuments();

    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthlyOrders = await Order.find({
      orderDate: { $gte: firstDayOfMonth }
    }).select('totalAmount');
    const monthlyEarnings = monthlyOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    const recentOrders = await Order.find()
      .populate('user', 'name')
      .populate('items.product', 'productName')
      .sort({ orderDate: -1 })
      .limit(5);

    // Get category data with product counts
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'category',
          as: 'products'
        }
      },
      {
        $project: {
          name: 1,
          count: { $size: '$products' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const dashboardData = {
      totalRevenue,
      totalOrders,
      totalProducts,
      monthlyEarnings,
      recentOrders,
      categories // Add categories to dashboard data
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
