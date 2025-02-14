const mongoose = require('mongoose');
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;

    // Find order and populate product details
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
  }).populate({
      path: "items.product",
      select: "productName productImage salePrice regularPrice offer category",
      populate: {
          path: 'category',
          select: 'categoryOffer'
      }
  });

    if (!order) {
      return res.status(404).render("page-404", { error: "Order not found" });
    }

    const user = await User.findById(userId).select('addresses');
    if (!user) {
      return res.status(404).render("page-404", { error: "User not found" });
    }

    console.log('Order before rendering:', {
      totalAmount: orderId.totalAmount,
      subtotal: orderId.subtotal,
      shipping: orderId.shipping
    });
   

    res.render("user/order-details", {
      order: order.toObject(),
      userAddresses: user.addresses,
      user: req.session.user
    });
  } catch (error) {
    console.error("Error getting order details:", error);
    res.status(500).render("page-404", { error: "Failed to load order details" });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;


    // First find the order to check status and get items
    const order = await Order.findOne({ _id: orderId, user: userId }).populate(
      "items.product"
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.status === "Delivered" || order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order that is ${order.status.toLowerCase()}`,
      });
    }

    try {
      // Return quantities back to products
      for (const item of order.items) {
        if (item.product) {
          await Product.findByIdAndUpdate(
            item.product._id,
            { $inc: { quantity: item.quantity } },
            { new: true }
          );
       
        }
      }

      // Update order status
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { $set: { status: "Cancelled" } },
        { new: true }
      );

      if (!updatedOrder) {
        throw new Error('Failed to update order status');
      }

      // Only credit wallet if payment method is not cod
      if (order.paymentMethod !== 'cod') {
        // Find or create wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
          wallet = new Wallet({
            user: userId,
            balance: 0,
            transactions: []
          });
        }

        // Add refund transaction
        const refundAmount = order.totalAmount;
        wallet.balance += refundAmount;
        wallet.transactions.push({
          type: 'credit',
          amount: refundAmount,
          description: `Refund for cancelled order #${order._id}`,
          date: new Date()
        });

        await wallet.save();
      }

      res.json({
        success: true,
        message: "Order cancelled successfully",
      });
    } catch (error) {
      // If something fails, try to roll back product quantities
      console.error("Error during cancellation, attempting rollback:", error);
      
      for (const item of order.items) {
        if (item.product) {
          try {
            await Product.findByIdAndUpdate(
              item.product._id,
              { $inc: { quantity: -item.quantity } }, // Subtract the quantity back
              { new: true }
            );
          
          } catch (rollbackError) {
            console.error("Error during rollback:", rollbackError);
          }
        }
      }
      
      throw error; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order. Please try again.",
      error: error.message
    });
  }
};

const trackOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // For now, just render a simple tracking page
    res.render("user/track-order", { order });
  } catch (error) {
    console.error("Error tracking order:", error);
    res.status(500).json({ message: "Failed to track order" });
  }
};

const returnOrder = async (req, res) => {
  try {
 

    const orderId = req.params.orderId;
    const { reason, otherReason, comments } = req.body;

    // Validate return reason
    if (!reason) {
      return res.status(400).json({ 
        success: false,
        error: 'Return reason is required' 
      });
    }

    // Validate other reason if reason is 'other'
    if (reason === 'other' && !otherReason) {
      return res.status(400).json({ 
        success: false,
        error: 'Please specify the other reason for return' 
      });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

 

    // Check if user is authenticated
    if (!req.session?.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Please login to return this order' 
      });
    }

    // Check if order belongs to the current user
    const orderUserId = order.user.toString();
    const sessionUserId = req.session.user.toString();
    

    if (orderUserId !== sessionUserId) {
      return res.status(403).json({ 
        success: false,
        error: 'Unauthorized to return this order' 
      });
    }

    // Check if order is eligible for return (e.g., within return window)
    const returnWindow = 7; // 7 days return window
    const orderDate = new Date(order.orderDate);
    const currentDate = new Date();
    const daysSinceOrder = Math.floor((currentDate - orderDate) / (1000 * 60 * 60 * 24));



    if (daysSinceOrder > returnWindow) {
      return res.status(400).json({ 
        success: false,
        error: 'Return window has expired' 
      });
    }

    // Check if order status is appropriate for return
    const validStatusForReturn = ['Delivered'];
    if (!validStatusForReturn.includes(order.status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Order is not eligible for return' 
      });
    }

    try {
      // Update only the necessary fields using findByIdAndUpdate
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
          $set: {
            status: 'Return Requested',
            returnRequest: {
              reason: reason,
              otherReason: reason === 'other' ? otherReason : undefined,
              comments: comments || '',
              requestDate: new Date(),
              status: 'Pending'
            }
          }
        },
        { new: true, runValidators: true }
      );

      if (!updatedOrder) {
        throw new Error('Failed to update order');
      }


      res.status(200).json({
        success: true,
        message: 'Return request submitted successfully. Amount will be credited to your wallet once return is approved.',
      });
    } catch (error) {
      console.error('Error processing return:', error);
      // Check if it's a validation error
      if (error.name === 'ValidationError') {
        const errorMessage = Object.values(error.errors)
          .map(err => err.message)
          .join('. ');
        return res.status(400).json({ 
          success: false,
          error: `Invalid data provided: ${errorMessage}` 
        });
      }
      res.status(500).json({ 
        success: false,
        error: 'Failed to process return request. Please try again.' 
      });
    }

  } catch (error) {
    console.error('Error in returnOrder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process return request'
    });
  }
};



const checkout = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressIndex, paymentMethod } = req.body;

        // Get user with wallet and cart
        const user = await User.findById(userId)
            .populate('wallet')
            .populate({
                path: 'cart',
                populate: {
                    path: 'items.product',
                    select: 'productName quantity salePrice'
                }
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const cart = user.cart;
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Cart is empty'
            });
        }

        // Check stock availability for all items
        for (const item of cart.items) {
            const product = item.product;
            if (!product || product.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock available for ${product.productName}`
                });
            }
        }

        // Validate address
        if (!user.addresses || !user.addresses[addressIndex]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid delivery address'
            });
        }

        // If wallet payment, check balance
        if (paymentMethod === 'wallet') {
            if (!user.wallet) {
                return res.status(400).json({
                    success: false,
                    message: 'Wallet not found'
                });
            }

            if (user.wallet.balance < cart.total) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance'
                });
            }
        }

        // Create new order
        const order = new Order({
            user: userId,
            items: cart.items,
            subtotal: cart.subtotal,
            shipping: cart.shipping,
            totalAmount: cart.total,
            shippingAddress: user.addresses[addressIndex],
            paymentMethod: paymentMethod,
            status: paymentMethod === 'wallet' ? 'Processing' : 'Pending',
            orderDate: new Date()
        });
     

        // Process wallet payment
        if (paymentMethod === 'wallet') {
            // Deduct from wallet
            await Wallet.findByIdAndUpdate(
                user.wallet._id,
                {
                    $inc: { balance: -cart.total },
                    $push: {
                        transactions: {
                            type: 'debit',
                            amount: cart.total,
                            description: `Payment for Order #${order._id}`,
                            orderId: order._id,
                            date: new Date()
                        }
                    }
                }
            );
        }

        // Reduce product quantities
        for (const item of cart.items) {
            await Product.findByIdAndUpdate(
                item.product._id,
                { $inc: { quantity: -item.quantity } }
            );
        }

        // Save order
        await order.save();

        // Clear cart
        await Cart.findByIdAndUpdate(cart._id, {
            $set: { items: [], total: 0, subtotal: 0, shipping: 0 }
        });

        res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: order._id
        });

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process checkout'
        });
    }
};

const retryPayment = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status !== 'Pending' || order.paymentStatus !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'This order cannot be retried for payment'
            });
        }

        // Create Razorpay order
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const options = {
            amount: Math.round(order.totalAmount * 100), // Razorpay expects amount in paise
            currency: 'INR',
            receipt: order._id.toString()
        };

        const razorpayOrder = await razorpay.orders.create(options);

        // Update order with new Razorpay order ID
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();

        res.json({
            success: true,
            razorpayOrder
        });

    } catch (error) {
        console.error('Error in retry payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate payment'
        });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            orderId
        } = req.body;

        // Verify signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign)
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Update order status
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        order.status = 'Processing';
        order.paymentStatus = 'Completed';
        order.razorpayPaymentId = razorpay_payment_id;
        await order.save();

        // Reduce product quantities
        for (const item of order.items) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { quantity: -item.quantity } }
            );
        }

        res.json({
            success: true,
            message: 'Payment verified successfully'
        });

    } catch (error) {
        console.error('Error in verify payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment'
        });
    }
};

module.exports = {
  getOrderDetails,
  cancelOrder,
  trackOrder,
  returnOrder,
  checkout,
  retryPayment,
  verifyPayment
};
