const Coupon=require("../../models/couponSchema")
const mongoose = require('mongoose');

const getCoupons=async(req,res)=>{
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.render('admin/coupons', { 
            coupons,
            page: 'coupons'
        });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ error: 'Failed to fetch coupons' });
    }
}

const createCoupon = async (req, res) => {
    try {
        console.log('Received coupon data:', req.body);
        
        const { 
            code, 
            discountType, 
            discount, 
            minPurchase, 
            expiryDate 
        } = req.body;

        // Log all existing coupons for debugging
        const allCoupons = await Coupon.find({}, 'code');
        console.log('All existing coupon codes:', allCoupons.map(c => ({ id: c._id, code: c.code })));

        // Validate required fields
        if (!code || !discountType || !discount || !minPurchase || !expiryDate) {
            console.log('Missing required fields:', {
                code: !!code,
                discountType: !!discountType,
                discount: !!discount,
                minPurchase: !!minPurchase,
                expiryDate: !!expiryDate
            });
            return res.status(400).json({ 
                message: 'All fields are required',
                missingFields: {
                    code: !code,
                    discountType: !discountType,
                    discount: !discount,
                    minPurchase: !minPurchase,
                    expiryDate: !expiryDate
                }
            });
        }

        // Clean and format the coupon code
        const cleanCode = code.trim().toUpperCase();
        console.log('Attempting to create coupon with code:', cleanCode);

        // Check existing coupon with exact match
        const existingCoupon = await Coupon.findOne({
            code: cleanCode
        });
        
        console.log('Existing coupon check result:', existingCoupon);
        
        if (existingCoupon) {
            console.log('Coupon code already exists:', {
                attempted: cleanCode,
                existing: existingCoupon.code,
                existingId: existingCoupon._id
            });
            return res.status(400).json({ 
                message: 'Coupon code already exists',
                attempted: cleanCode,
                existing: existingCoupon.code
            });
        }

        // Validate discount based on type
        if (discountType === 'percentage' && (discount <= 0 || discount > 100)) {
            console.log('Invalid percentage discount:', discount);
            return res.status(400).json({
                message: 'Percentage discount must be between 1 and 100'
            });
        }

        if (discountType === 'fixed' && discount <= 0) {
            console.log('Invalid fixed discount:', discount);
            return res.status(400).json({
                message: 'Fixed discount must be greater than 0'
            });
        }

        // Create new coupon object
        const newCoupon = new Coupon({
            code: cleanCode,
            discountType,
            discount: Number(discount),
            minPurchase: Number(minPurchase),
            expiryDate: new Date(expiryDate)
        });

        console.log('Attempting to save coupon:', newCoupon.toObject());

        try {
            // Try to save the coupon
            const savedCoupon = await newCoupon.save();
            console.log('Coupon saved successfully:', savedCoupon.toObject());
            
            res.status(201).json({ 
                message: 'Coupon created successfully',
                coupon: savedCoupon 
            });
        } catch (saveError) {
            console.error('Error saving coupon:', {
                error: saveError.message,
                code: saveError.code,
                keyPattern: saveError.keyPattern,
                keyValue: saveError.keyValue
            });
            
            // Check if it's a duplicate key error
            if (saveError.code === 11000) {
                // Double-check if the coupon exists (race condition)
                const duplicateCoupon = await Coupon.findOne({ code: cleanCode });
                console.log('Found duplicate coupon:', duplicateCoupon);
                
                return res.status(400).json({
                    message: 'Coupon code already exists',
                    attempted: cleanCode,
                    existing: duplicateCoupon ? duplicateCoupon.code : null
                });
            }
            
            throw saveError; // Re-throw other errors
        }
    } catch (error) {
        console.error('Detailed error in createCoupon:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code,
            keyPattern: error.keyPattern,
            keyValue: error.keyValue
        });

        res.status(500).json({ 
            message: 'Error creating coupon', 
            error: error.message 
        });
    }
};

const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find();
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching coupons', 
            error: error.message 
        });
    }
};

const getCouponById = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }
        res.json(coupon);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching coupon', 
            error: error.message 
        });
    }
};

const updateCoupon = async (req, res) => {
    try {
        const { 
            code, 
            discountType, 
            discount, 
            minPurchase, 
            expiryDate 
        } = req.body;

        const updatedCoupon = await Coupon.findByIdAndUpdate(
            req.params.id, 
            {
                code,
                discountType,
                discount: Number(discount),
                minPurchase: Number(minPurchase),
                expiryDate: new Date(expiryDate)
            }, 
            { new: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        res.json(updatedCoupon);
    } catch (error) {
        res.status(500).json({ 
            message: 'Error updating coupon', 
            error: error.message 
        });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
        
        if (!deletedCoupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }

        res.json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        res.status(500).json({ 
            message: 'Error deleting coupon', 
            error: error.message 
        });
    }
};

module.exports={
    getCoupons,
    createCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    // getCouponDetails
}
