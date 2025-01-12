const express=require("express")
const bodyParser = require('body-parser');
const app = express()
const path =require("path");
const session=require("express-session");
const passport=require("./config/passport")

const env=require("dotenv").config()
const db =require("./config/db")
const userRouter=require("./routes/userRouter");
const adminRouter=require("./routes/adminRouter")



db()


app.use(express.json());
app.use(express.urlencoded({extended:true}))
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use(
    session({
        secret: 'your-secret-key', // Replace with a strong, random key in production
        resave: false, // Don't save session if unmodified
        saveUninitialized: true, // Save uninitialized sessions
        cookie: {
            secure: false, // Set true if using HTTPS
            maxAge: 1000 * 60 * 15, // Session expires after 15 minutes
        },
    })
);
    app.use(passport.initialize())
    app.use(passport.session())

    
    app.use((req,res,next)=>{
        res.set('cache-controll','no-store')
        next();
    });

// Add static middleware for uploads directory
app.use(express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, "public/uploads")));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use("/",userRouter)
app.use("/admin",adminRouter)


const PORT=1111 || process.env.PORT
app.listen(process.env.PORT,()=>{
    console.log("Server Running........\nhttp://localhost:1111/");
})

module.exports=app
