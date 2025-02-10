const Cart = require('../../models/cartSchema'); 
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const Product = require('../../models/productSchema');

const checkoutController = {
    getCheckoutPage: async (req, res) => {
        try {
            const userId = req.session.user;
            
            const user = await User.findById(userId).populate('wallet');
            
            const cart = await Cart.findOne({ user: userId }).populate({
                path: 'items.product',
                select: 'productName productImage regularPrice salePrice offer category isBlocked',
                populate: {
                    path: 'category',
                    select: 'categoryOffer isListed'
                }
            });

            if (!cart || !cart.items || cart.items.length === 0) {
                return res.redirect('/cart');
            }

            // Filter out blocked products and products with unlisted categories
            const validItems = cart.items.filter(item => {
                const product = item.product;
                return product && 
                       !product.isBlocked && 
                       product.category && 
                       product.category.isListed === true;
            });
            
            // If all products are blocked or unlisted, redirect to cart
            if (validItems.length === 0) {
                return res.redirect('/cart?error=blocked');
            }

            // Check if any products were filtered out
            if (validItems.length !== cart.items.length) {
                // Update cart to remove blocked/unlisted items
                cart.items = validItems;
                await cart.save();
                
                // Some products were blocked or unlisted
                req.session.flashMessage = 'Some items in your cart are no longer available and have been removed.';
            }

            // Calculate totals with only valid items
            let subtotal = 0;
            console.log('Starting total calculation...');
            
            for (const item of validItems) {
                const product = item.product;
                if (!product) {
                    console.error('Product not found in cart item');
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid product in cart'
                    });
                }

                // Get base price (use salePrice if available, otherwise regularPrice)
                const basePrice = product.salePrice > 0 ? product.salePrice : product.regularPrice;
                if (typeof basePrice !== 'number' || isNaN(basePrice)) {
                    console.error('Invalid product price:', {
                        productId: product._id,
                        regularPrice: product.regularPrice,
                        salePrice: product.salePrice
                    });
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid product price'
                    });
                }

                const quantity = Number(item.quantity);
                if (isNaN(quantity) || quantity <= 0) {
                    console.error('Invalid quantity:', item.quantity);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid quantity'
                    });
                }

                // Calculate best offer
                const productOffer = product.offer && product.offer.percentage ? Number(product.offer.percentage) : 0;
                const categoryOffer = product.category && product.category.categoryOffer ? Number(product.category.categoryOffer) : 0;
                const bestOffer = Math.max(productOffer, categoryOffer);

                console.log('Processing item:', {
                    productId: product._id,
                    productName: product.productName,
                    basePrice,
                    quantity,
                    productOffer,
                    categoryOffer,
                    bestOffer
                });

                // Calculate final price with offer
                let finalPrice = basePrice;
                if (bestOffer > 0) {
                    const discountAmount = (basePrice * bestOffer) / 100;
                    finalPrice = basePrice - discountAmount;
                }
                finalPrice = Math.round(finalPrice); // Round to nearest rupee

                const itemTotal = finalPrice * quantity;
                console.log('Item calculation:', {
                    basePrice,
                    finalPrice,
                    quantity,
                    itemTotal
                });

                subtotal += itemTotal;
            }

            if (typeof subtotal !== 'number' || isNaN(subtotal) || subtotal < 0) {
                console.error('Invalid subtotal:', subtotal);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid subtotal calculation'
                });
            }

            console.log('Subtotal calculated:', subtotal);

            const shipping = 0; // Free delivery
            let total = subtotal;

            // Apply coupon discount if present
            let couponDiscount = 0;
            if (req.body.couponCode && req.body.discountValue) {
                const discountValue = Number(req.body.discountValue);
                if (isNaN(discountValue) || discountValue < 0) {
                    console.error('Invalid coupon discount:', req.body.discountValue);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid coupon discount'
                    });
                }

                if (req.body.discountType === 'percentage') {
                    couponDiscount = Math.round((subtotal * discountValue) / 100);
                } else {
                    couponDiscount = Math.round(discountValue);
                }

                console.log('Coupon calculation:', {
                    type: req.body.discountType,
                    value: discountValue,
                    calculatedDiscount: couponDiscount
                });

                total = Math.max(0, subtotal - couponDiscount);
            }

            // Final validation
            if (typeof total !== 'number' || isNaN(total) || total < 0) {
                console.error('Invalid total:', {
                    subtotal,
                    couponDiscount,
                    total
                });
                return res.status(400).json({
                    success: false,
                    message: 'Invalid total calculation'
                });
            }

            console.log('Final amounts:', {
                subtotal,
                couponDiscount,
                total
            });

            // Update cart with only valid items
            cart.items = validItems;
            cart.subtotal = subtotal;
            cart.shipping = shipping;
            cart.total = total;

            res.render('user/checkout', { 
                user,
                cart,
                wallet: user.wallet,
                flashMessage: req.session.flashMessage
            });
            
            // Clear flash message after displaying
            delete req.session.flashMessage;
        } catch (error) {
            console.error('Error loading checkout page:', error);
            res.status(500).send('Internal Server Error');
        }
    },

    processCheckout: async (req, res) => {
        try {
            console.log('Processing checkout with data:', req.body);
            const userId = req.session.user;
            const { addressIndex, paymentMethod } = req.body;

            const user = await User.findById(userId).populate('wallet');
            if (!user) {
                console.error('User not found:', userId);
                return res.status(400).json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }

            if (!user.addresses || !user.addresses[addressIndex]) {
                console.error('Invalid address index:', addressIndex);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid delivery address' 
                });
            }

            const cart = await Cart.findOne({ user: userId }).populate({
                path: 'items.product',
                select: 'productName productImage regularPrice salePrice offer category isBlocked',
                populate: {
                    path: 'category',
                    select: 'categoryOffer isListed'
                }
            });
            if (!cart || !cart.items || cart.items.length === 0) {
                console.error('Cart is empty for user:', userId);
                return res.status(400).json({
                    success: false,
                    message: 'Cart is empty'
                });
            }

            // Filter out blocked products and products with unlisted categories
            const validItems = cart.items.filter(item => {
                const product = item.product;
                return product && 
                       !product.isBlocked && 
                       product.category && 
                       product.category.isListed === true;
            });
            
            // If all products are blocked or unlisted, prevent checkout
            if (validItems.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'All items in your cart are currently unavailable' 
                });
            }

            // If some products were blocked or unlisted, notify the user
            if (validItems.length !== cart.items.length) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Some items in your cart are no longer available. Please review your cart before proceeding.' 
                });
            }

            // Verify stock availability for all items
            for (const item of cart.items) {
                const product = await Product.findById(item.product._id);
                if (!product || product.quantity < item.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Not enough stock available for ${item.product.productName}`
                    });
                }
            }

            console.log('Cart found:', cart);

            // Calculate totals
            console.log('Starting total calculation...');
            
            let subtotal = 0;
            for (const item of cart.items) {
                const product = item.product;
                if (!product) {
                    console.error('Product not found in cart item');
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid product in cart'
                    });
                }

                // Get base price (use salePrice if available, otherwise regularPrice)
                const basePrice = product.salePrice > 0 ? product.salePrice : product.regularPrice;
                if (typeof basePrice !== 'number' || isNaN(basePrice)) {
                    console.error('Invalid product price:', {
                        productId: product._id,
                        regularPrice: product.regularPrice,
                        salePrice: product.salePrice
                    });
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid product price'
                    });
                }

                const quantity = Number(item.quantity);
                if (isNaN(quantity) || quantity <= 0) {
                    console.error('Invalid quantity:', item.quantity);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid quantity'
                    });
                }

                // Calculate best offer
                const productOffer = product.offer && product.offer.percentage ? Number(product.offer.percentage) : 0;
                const categoryOffer = product.category && product.category.categoryOffer ? Number(product.category.categoryOffer) : 0;
                const bestOffer = Math.max(productOffer, categoryOffer);

                console.log('Processing item:', {
                    productId: product._id,
                    productName: product.productName,
                    basePrice,
                    quantity,
                    productOffer,
                    categoryOffer,
                    bestOffer
                });

                // Calculate final price with offer
                let finalPrice = basePrice;
                if (bestOffer > 0) {
                    const discountAmount = (basePrice * bestOffer) / 100;
                    finalPrice = basePrice - discountAmount;
                }
                finalPrice = Math.round(finalPrice); // Round to nearest rupee

                const itemTotal = finalPrice * quantity;
                console.log('Item calculation:', {
                    basePrice,
                    finalPrice,
                    quantity,
                    itemTotal
                });

                subtotal += itemTotal;
            }

            if (typeof subtotal !== 'number' || isNaN(subtotal) || subtotal < 0) {
                console.error('Invalid subtotal:', subtotal);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid subtotal calculation'
                });
            }

            console.log('Subtotal calculated:', subtotal);

            const shipping = 0; // Free delivery
            let total = subtotal;

            // Apply coupon discount if present
            let couponDiscount = 0;
            if (req.body.couponCode && req.body.discountValue) {
                const discountValue = Number(req.body.discountValue);
                if (isNaN(discountValue) || discountValue < 0) {
                    console.error('Invalid coupon discount:', req.body.discountValue);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid coupon discount'
                    });
                }

                if (req.body.discountType === 'percentage') {
                    couponDiscount = Math.round((subtotal * discountValue) / 100);
                } else {
                    couponDiscount = Math.round(discountValue);
                }

                console.log('Coupon calculation:', {
                    type: req.body.discountType,
                    value: discountValue,
                    calculatedDiscount: couponDiscount
                });

                total = Math.max(0, subtotal - couponDiscount);
            }

            // Final validation
            if (typeof total !== 'number' || isNaN(total) || total < 0) {
                console.error('Invalid total:', {
                    subtotal,
                    couponDiscount,
                    total
                });
                return res.status(400).json({
                    success: false,
                    message: 'Invalid total calculation'
                });
            }

            console.log('Final amounts:', {
                subtotal,
                couponDiscount,
                total
            });

            // Validate COD restriction
            if (paymentMethod === 'cod' && total > 1000) {
                return res.status(400).json({
                    success: false,
                    message: 'Cash on Delivery is not available for orders above ₹1,000'
                });
            }

            // If wallet payment, verify balance
            if (paymentMethod === 'wallet') {
                if (!user.wallet) {
                    return res.status(400).json({
                        success: false,
                        message: 'Wallet not found'
                    });
                }

                if (user.wallet.balance < total) {
                    return res.status(400).json({
                        success: false,
                        message: 'Insufficient wallet balance'
                    });
                }
            }

            // Create new order
            const orderData = {
                user: userId,
                items: cart.items.map(item => {
                    const product = item.product;
                    const productOffer = product.offer && product.offer.percentage ? product.offer.percentage : 0;
                    const categoryOffer = product.category && product.category.categoryOffer ? product.category.categoryOffer : 0;
                    const bestOffer = Math.max(productOffer, categoryOffer);
                    
                    let price = product.salePrice > 0 ? product.salePrice : product.regularPrice;
                    if (bestOffer > 0) {
                        const discountAmount = (price * bestOffer) / 100;
                        price = price - discountAmount;
                    }

                    return {
                        product: item.product._id,
                        quantity: item.quantity,
                        price: Math.round(price),
                        appliedOffer: bestOffer > 0 ? {
                            percentage: bestOffer,
                            validUntil: product.offer ? product.offer.validUntil : null
                        } : undefined
                    };
                }),
                totalAmount: total,
                subtotal: subtotal,
                shipping: shipping,
                shippingAddress: {
                    fullName: user.addresses[addressIndex].name,
                    phone: user.addresses[addressIndex].phone,
                    address: `${user.addresses[addressIndex].houseName}, ${user.addresses[addressIndex].street}`,
                    city: user.addresses[addressIndex].city,
                    pincode: user.addresses[addressIndex].pincode,
                    state: user.addresses[addressIndex].state
                },
                paymentMethod: paymentMethod,
                status: paymentMethod === 'wallet' ? 'Processing' : 'Pending',
                paymentStatus: paymentMethod === 'wallet' ? 'Completed' : 'Pending',
                orderDate: new Date()
            };

            // If coupon was applied, add it to the order
            if (req.body.couponCode) {
                orderData.coupon = {
                    code: req.body.couponCode,
                    discountType: req.body.discountType,
                    discountValue: req.body.discountValue,
                    discountAmount: couponDiscount
                };
            }

            console.log('Creating order with data:', orderData);
            const order = new Order(orderData);
            await order.save();

            // If wallet payment, process it
            if (paymentMethod === 'wallet') {
                console.log('Processing wallet payment');
                const walletAmount = parseFloat(order.totalAmount);
                
                if (isNaN(walletAmount)) {
                    await Order.findByIdAndDelete(order._id);
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid order amount'
                    });
                }

                // Create wallet transaction
                const transaction = {
                    type: 'debit',
                    amount: walletAmount,
                    description: `Payment for Order #${order._id.toString().slice(-12)}`,
                    orderId: order._id,
                    date: new Date()
                };

                // Update wallet balance and add transaction
                user.wallet.balance -= walletAmount;
                user.wallet.transactions.push(transaction);
                await user.save();

                // Reduce product quantities
                for (const item of cart.items) {
                    await Product.findByIdAndUpdate(
                        item.product._id,
                        { $inc: { quantity: -item.quantity } }
                    );
                }
            }

            // Clear cart after successful order
            await Cart.findByIdAndDelete(cart._id);

            return res.status(200).json({
                success: true,
                message: 'Order placed successfully',
                orderId: order._id
            });
        } catch (error) {
            console.error('Error processing checkout:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to process order'
            });
        }
    }
};

module.exports = checkoutController;
