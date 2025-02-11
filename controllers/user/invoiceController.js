const PDFDocument = require('pdfkit');
const Order = require('../../models/orderSchema');

const generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user;

      
        if (!userId) {
            console.log('Auth failed - no userId in session');
            return res.status(401).json({ success: false, message: "Unauthorized access" });
        }

        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate({
                path: "items.product",
                select: "productName productImage salePrice",
            })
            .populate({
                path: "user",
                select: "name email",
            });
            console.log('Debug - Order shipping details:', order.shippingAddress);
            console.log('Full order data:', JSON.stringify(order, null, 2));
        if (!order) {
            console.log('Order not found:', { orderId, userId });
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        console.log('Order found, generating PDF...');

        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=invoice-${orderId}.pdf`);
        res.setHeader("Cache-Control", "no-cache");
        
        // Pipe PDF output to response
        doc.pipe(res);

        console.log('Starting PDF generation...');

        // Add content to PDF
        addHeader(doc);
        addOrderDetails(doc, order);
        addItemsTable(doc, order.items);
        addSummary(doc, order);
        addFooter(doc);

        console.log('PDF generation complete, ending document...');
        
        // End the document
        doc.end();

        console.log('PDF generation success');

    } catch (error) {
        console.error('PDF generation error:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: "Failed to generate invoice",
            error: error.message
        });
    }
};



// Helper functions for PDF generation
const addHeader = async (doc) => {
    doc.fontSize(20).text("REVAGE", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("Tax Invoice", { align: "center" });
    doc.moveDown();
};

      
const addOrderDetails = async (doc, order) => {
    doc.fontSize(12);
    
    // Create two-column layout for order details
    const leftColumn = {
        text: [
            `Invoice Date: ${new Date().toLocaleDateString('en-IN')}`,
            `Order ID: ${order._id}`,
            `Order Date: ${new Date(order.orderDate).toLocaleDateString('en-IN')}`
        ],
        x: 50
    };

    const rightColumn = {
        text: [
            'Bill To:',
            `${order.shippingAddress?.fullName || 'N/A'}`,
            `${order.shippingAddress?.address || 'N/A'}`,
            `${order.shippingAddress?.city || 'N/A'}, ${order.shippingAddress?.state || 'N/A'} ${order.shippingAddress?.pincode || 'N/A'}`,
            `Phone: ${order.shippingAddress?.phone || 'N/A'}`
        ],
        x: doc.page.width / 2
    };

    const y = doc.y;
    leftColumn.text.forEach(text => {
        doc.text(text, leftColumn.x, doc.y);
    });

    doc.y = y;
    rightColumn.text.forEach(text => {
        doc.text(text, rightColumn.x, doc.y);
    });

    doc.moveDown(2);
};

const addItemsTable = async (doc, items) => {
    // Table headers
    const headers = ['Item', 'Quantity', 'Price', 'Total'];
    const columnWidth = (doc.page.width - 100) / headers.length;
    
    headers.forEach((header, i) => {
        doc.text(header, 50 + (i * columnWidth), doc.y, { width: columnWidth, align: 'left' });
    });

    doc.moveDown();
    doc.lineCap('butt')
       .moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke();
    doc.moveDown();

    // Table rows
    items.forEach(item => {
        const y = doc.y;
        doc.text(item.product.productName, 50, y, { width: columnWidth });
        doc.text(item.quantity.toString(), 50 + columnWidth, y, { width: columnWidth });
        doc.text(`₹${item.product.salePrice.toFixed(2)}`, 50 + (columnWidth * 2), y, { width: columnWidth });
        doc.text(`₹${(item.quantity * item.product.salePrice).toFixed(2)}`, 50 + (columnWidth * 3), y, { width: columnWidth });
        doc.moveDown();
    });
};

const addSummary = async (doc, order) => {
    doc.moveDown();
    const summaryX = doc.page.width - 200;
    
    doc.text('Summary:', summaryX);
    doc.moveDown();
    
    doc.text(`Subtotal: ₹${order.subtotal.toFixed(2)}`, summaryX);
    
    if (order.discount) {
        doc.text(`Discount: -₹${order.discount.toFixed(2)}`, summaryX);
    }
    
    if (order.shippingCost) {
        doc.text(`Shipping: ${order.shippingCost.toFixed(2)}`, summaryX);
    }
    
    doc.moveDown();
    doc.fontSize(14).text(`Total:  ${order.totalAmount}`, summaryX, doc.y, { bold: true });
};

const addFooter = async (doc) => {
    doc.fontSize(10);
    doc.text(
        'Thank you for shopping with REVAGE!',
        50,
        doc.page.height - 50,
        { align: 'center' }
    );
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
