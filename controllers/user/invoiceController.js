const PDFDocument = require('pdfkit');
const Order = require('../../models/orderSchema');

const generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized access" });
        }

        // Fetch order with all necessary data
        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate({
                path: "items.product",
                select: "productName productImage regularPrice salePrice",
            })
            .populate({
                path: "user",
                select: "name email",
            })
            .lean();  // Convert to plain JavaScript object
           
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Ensure shipping address exists and has all required fields
        if (!order.shippingAddress) {
            return res.status(400).json({ success: false, message: "Shipping address not found" });
        }

        // Create PDF document with smaller margins
        const doc = new PDFDocument({ 
            margin: 30,
            size: 'A4'
        });

        // Set response headers
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=invoice-${orderId}.pdf`);
        res.setHeader("Cache-Control", "no-cache");
        
        // Pipe PDF output to response
        doc.pipe(res);

        // Add content to PDF
        await addHeader(doc);
        await addOrderDetails(doc, order);
        await addItemsTable(doc, order.items);
        await addSummary(doc, order);
        await addFooter(doc);
        
        // End the document
        doc.end();

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({
            success: false,
            message: "Failed to generate invoice",
            error: error.message
        });
    }
};

const addHeader = async (doc) => {
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text("REVAGE", { align: "center" });
    
    doc.fontSize(12)
       .font('Helvetica')
       .text("TAX INVOICE", { align: "center" });
    
    doc.moveDown(0.3);
};

const addOrderDetails = async (doc, order) => {
    const startY = doc.y;
    
    // Left column
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .text('Invoice Details:', 30, startY)
       .font('Helvetica')
       .moveDown(0.2);
    
    doc.text(`Invoice Date: ${new Date().toLocaleDateString('en-IN')}`)
       .text(`Order ID: ${order._id}`)
       .text(`Order Date: ${new Date(order.orderDate).toLocaleDateString('en-IN')}`);

    // Right column - Billing Address
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .text('Bill To:', 300, startY)
       .font('Helvetica')
       .moveDown(0.2);

    // Get address from order
    const address = order.shippingAddress || {};
    
    // Build address lines with proper checks
    const addressLines = [
        address.name || 'N/A',
        address.address || 'N/A',
        `${[
            address.city || '',
            address.state || '',
            address.pincode || ''
        ].filter(Boolean).join(', ') || 'N/A'}`,
        `Phone: ${address.phone || 'N/A'}`
    ];

    // Add each line of the address
    addressLines.forEach(line => {
        doc.text(line, 300);
    });

    doc.moveDown(0.3);
};

const addItemsTable = async (doc, items) => {
    // Table configuration
    const tableTop = doc.y + 5;
    const itemX = 30;
    const qtyX = 280;
    const priceX = 350;
    const totalX = 450;

    // Add table headers
    doc.font('Helvetica-Bold')
       .fontSize(8);
    
    doc.text('Item', itemX, tableTop, { width: 240 })
       .text('Qty', qtyX, tableTop, { width: 50, align: 'center' })
       .text('Price', priceX, tableTop, { width: 80, align: 'right' })
       .text('Total', totalX, tableTop, { width: 80, align: 'right' });

    // Add a line below headers
    doc.moveTo(30, tableTop + 15)
       .lineTo(530, tableTop + 15)
       .lineWidth(0.5)
       .stroke();

    // Reset for items
    doc.font('Helvetica').fontSize(8);
    let y = tableTop + 25;

    // Add items
    items.forEach(item => {
        const price = item.price || (item.product && item.product.salePrice) || 0;
        const total = price * item.quantity;
        
        doc.text(item.product.productName, itemX, y, { width: 240 })
           .text(item.quantity.toString(), qtyX, y, { width: 50, align: 'center' })
           .text(`₹${price.toLocaleString('en-IN')}`, priceX, y, { width: 80, align: 'right' })
           .text(`₹${total.toLocaleString('en-IN')}`, totalX, y, { width: 80, align: 'right' });
        y += 15;
    });

    // Add a line after items
    doc.moveTo(30, y + 5)
       .lineTo(530, y + 5)
       .lineWidth(0.5)
       .stroke();

    // Update the y position for next section
    doc.y = y + 15;
};

const addSummary = async (doc, order) => {
    const summaryX = 350;
    const valueX = 450;
    const y = doc.y;
    
    doc.fontSize(8);
    
    // Helper function for summary rows
    const addSummaryRow = (label, value, options = {}) => {
        const textColor = options.color || 'black';
        doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
           .fillColor(textColor)
           .text(label, summaryX, doc.y, { width: 100, align: 'left' })
           .text(value, valueX, doc.y, { width: 80, align: 'right' });
        doc.moveDown(0.3);
        doc.fillColor('black'); // Reset color
    };
    
    // Add summary items in order: Subtotal, Coupon, Shipping
    addSummaryRow('Subtotal:', `₹${order.subtotal.toLocaleString('en-IN')}`);
    
    // Show coupon discount if applied
    if (order.coupon && order.coupon.discountAmount) {
        const discountLabel = order.coupon.code ? 
            `Coupon (${order.coupon.code}):` : 
            'Coupon:';
        addSummaryRow(
            discountLabel,
            `-₹${order.coupon.discountAmount.toLocaleString('en-IN')}`,
            { color: 'rgb(0, 128, 0)' }  // Using RGB green color
        );
    }
    
    addSummaryRow('Shipping:', order.shipping ? `${order.shipping.toLocaleString('en-IN')}` : 'Free');
    
    // Add line before total
    doc.moveTo(summaryX, doc.y)
       .lineTo(530, doc.y)
       .lineWidth(0.5)
       .stroke();
    doc.moveDown(0.3);
    
    // Add total
    addSummaryRow('Total Amount:', `${order.totalAmount.toLocaleString('en-IN')}`, { bold: true });
    addSummaryRow('Payment Method:', order.paymentMethod.toUpperCase());
};

const addFooter = async (doc) => {
    // Position footer near bottom of page
    const footerY = doc.page.height - 60;
    
    // Add a line above footer
    doc.moveTo(30, footerY)
       .lineTo(530, footerY)
       .lineWidth(0.5)
       .stroke();
    
    // Add footer text
    doc.fontSize(8)
       .font('Helvetica')
       .text('Thank you for shopping with REVAGE!', 30, footerY + 10, 
            { align: 'center', width: doc.page.width - 60 });
    
    // Add terms and conditions
    doc.fontSize(6)
       .fillColor('grey')
       .text('This is a computer-generated invoice and does not require a signature.',
            30, footerY + 25,
            { align: 'center', width: doc.page.width - 60 });
    
    doc.fillColor('black');
};

// Frontend helper function
const downloadInvoice = async (orderId) => {
    try {
        const response = await fetch(`/order/${orderId}/invoice`);
        
        if (!response.ok) {
            throw new Error('Failed to generate invoice');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${orderId}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Error downloading invoice:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to download invoice. Please try again later.'
        });
    }
};

module.exports = {
    generateInvoice,
    downloadInvoice
};
