const user = require("../models/userSchema");

const userAuth = (req, res, next) => {
    if (req.session.user) {
        user.findById(req.session.user)
            .then(data => {
                if (data && !data.isBlocked) {
                    next()
                } else {
                    res.redirect("/login")
                }
            })
            .catch(error => {
                console.log("Error in user auth middleware");
                res.status(500).send("internal server error")
            })
    } else {
        res.redirect("/login")
    }
}

const adminAuth = (req, res, next) => {
    if(req.session.admin){
        user.findOne({ isAdmin: true })
        .then(data => {
            if (data) {
                next()
            } else {
                res.redirect("/admin/login")
            }
        })
        .catch(error => {
            console.log("Error in adminAuth", error);
            res.status(500).send("Internal Server Error")
        })
    } else {
        res.redirect("/admin/login")
    }
    
}



module.exports = {
    userAuth,
    adminAuth
};