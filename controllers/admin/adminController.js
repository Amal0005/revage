const User = require("../../models/userSchema");
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
    res.render("admin/dashboard");
  } catch (error) {
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
