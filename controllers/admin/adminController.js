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
      return res.render("admin/admin-login", { message: "Admin not found" });

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
    const orders = await Order.find({
      status: { $nin: ['Cancelled', 'Returned'] }
    }).select('totalAmount orderDate status items')
    .populate({
      path: 'items.product',
      select: 'productName regularPrice category',
      populate: {
        path: 'category',
        select: 'name'
      }
    });

    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    // Calculate best-selling products
    const productSales = {};
    const categorySales = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.product) {
          // Track product sales
          const productId = item.product._id.toString();
          if (!productSales[productId]) {
            productSales[productId] = {
              productId,
              name: item.product.productName,
              quantity: 0,
              revenue: 0
            };
          }
          productSales[productId].quantity += item.quantity;
          productSales[productId].revenue += item.quantity * (item.price || 0);

          // Track category sales
          if (item.product.category) {
            const categoryId = item.product.category._id.toString();
            if (!categorySales[categoryId]) {
              categorySales[categoryId] = {
                categoryId,
                name: item.product.category.name,
                quantity: 0,
                revenue: 0
              };
            }
            categorySales[categoryId].quantity += item.quantity;
            categorySales[categoryId].revenue += item.quantity * (item.price || 0);
          }
        }
      });
    });

    // Convert to arrays and sort by quantity
    const bestSellingProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const bestSellingCategories = Object.values(categorySales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

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

    // Get category data with product counts and sales
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
        $unwind: '$products'
      },
      {
        $lookup: {
          from: 'orders',
          let: { productId: '$products._id' },
          pipeline: [
            {
              $unwind: '$items'
            },
            {
              $match: {
                $expr: {
                  $eq: ['$items.product', '$$productId']
                },
                status: { $nin: ['Cancelled', 'Returned'] }
              }
            }
          ],
          as: 'orders'
        }
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          totalSales: { $sum: { $size: '$orders' } }
        }
      },
      {
        $sort: { totalSales: -1 }
      },
      {
        $limit: 5
      }
    ]);

    const dashboardData = {
      totalRevenue,
      totalOrders,
      totalProducts,
      monthlyEarnings,
      recentOrders,
      categories,
      bestSellingProducts,
      bestSellingCategories
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

const getCategoryData = async (req, res) => {
  try {
    const { filter } = req.query;
    const currentDate = new Date();
    let startDate;

    switch (filter) {
      case 'yearly':
        startDate = new Date(currentDate.getFullYear() - 1, 0, 1);
        break;
      case 'monthly':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        break;
      case 'daily':
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7);
        break;
    }

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
        $unwind: '$products'
      },
      {
        $lookup: {
          from: 'orders',
          let: { productId: '$products._id' },
          pipeline: [
            {
              $unwind: '$items'
            },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$items.product', '$$productId'] },
                    { $gte: ['$orderDate', startDate] }
                  ]
                },
                status: { $nin: ['Cancelled', 'Returned'] }
              }
            }
          ],
          as: 'orders'
        }
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          totalSales: { $sum: { $size: '$orders' } }
        }
      },
      {
        $sort: { totalSales: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.json(categories);
  } catch (error) {
    console.error("Error fetching category data:", error);
    res.status(500).json({ error: "Failed to fetch category data" });
  }
};

const getProductData = async (req, res) => {
  try {
    const { filter } = req.query;
    const currentDate = new Date();
    let startDate;

    switch (filter) {
      case 'yearly':
        startDate = new Date(currentDate.getFullYear() - 1, 0, 1);
        break;
      case 'monthly':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        break;
      case 'daily':
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7);
        break;
    }

    const products = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate },
          status: { $nin: ['Cancelled', 'Returned'] }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      {
        $unwind: '$productInfo'
      },
      {
        $group: {
          _id: '$productInfo._id',
          name: { $first: '$productInfo.productName' },
          totalSales: { $sum: '$items.quantity' }
        }
      },
      {
        $sort: { totalSales: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.json(products);
  } catch (error) {
    console.error("Error fetching product data:", error);
    res.status(500).json({ error: "Failed to fetch product data" });
  }
};

const getSalesData = async (req, res) => {
  try {
    const { filter } = req.query;
    const currentDate = new Date();
    let startDate;

    switch (filter) {
      case 'yearly':
        startDate = new Date(currentDate.getFullYear() - 4, 0, 1);
        break;
      case 'monthly':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11, 1);
        break;
      case 'daily':
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 29);
        break;
    }

    const orders = await Order.aggregate([
      {
        $match: {
          orderDate: { $gte: startDate },
          status: { $nin: ['Cancelled', 'Returned'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$orderDate' },
            month: { $month: '$orderDate' },
            day: { $dayOfMonth: '$orderDate' }
          },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.day': 1
        }
      }
    ]);

    // Format data based on filter
    const formattedData = orders.map(order => ({
      date: new Date(order._id.year, order._id.month - 1, order._id.day),
      amount: order.totalAmount
    }));

    res.json(formattedData);
  } catch (error) {
    console.error("Error fetching sales data:", error);
    res.status(500).json({ error: "Failed to fetch sales data" });
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
  getCategoryData,
  getProductData,
  getSalesData
};
