// Shared validation functions for product forms
const validateProductForm = (formData, isEdit = false) => {
    const errors = {};

    // Product Name validation
    const productName = formData.get('productName').trim();
    if (!productName) {
        errors.productName = 'Product name is required';
    } else if (productName.length < 3) {
        errors.productName = 'Product name must be at least 3 characters long';
    } else if (productName.length > 100) {
        errors.productName = 'Product name must not exceed 100 characters';
    }

    // Description validation
    const description = formData.get('description').trim();
    if (!description) {
        errors.description = 'Description is required';
    } else if (description.length < 10) {
        errors.description = 'Description must be at least 10 characters long';
    } else if (description.length > 1000) {
        errors.description = 'Description must not exceed 1000 characters';
    }

    // Regular Price validation
    const regularPrice = parseFloat(formData.get('regularPrice'));
    if (!regularPrice) {
        errors.regularPrice = 'Regular price is required';
    } else if (regularPrice <= 0) {
        errors.regularPrice = 'Regular price must be greater than 0';
    } else if (regularPrice > 1000000) {
        errors.regularPrice = 'Regular price must not exceed 1,000,000';
    }

    // Sale Price validation (optional)
    const salePrice = parseFloat(formData.get('salePrice'));
    if (salePrice) {
        if (salePrice <= 0) {
            errors.salePrice = 'Sale price must be greater than 0';
        } else if (salePrice >= regularPrice) {
            errors.salePrice = 'Sale price must be less than regular price';
        }
    }

    // Quantity validation
    const quantity = parseInt(formData.get('quantity'));
    if (!quantity && quantity !== 0) {
        errors.quantity = 'Quantity is required';
    } else if (quantity < 0) {
        errors.quantity = 'Quantity cannot be negative';
    } else if (quantity > 10000) {
        errors.quantity = 'Quantity must not exceed 10,000';
    }

    // Category validation
    const category = formData.get('category');
    if (!category) {
        errors.category = 'Please select a category';
    }

    // Color validation (optional)
    const color = formData.get('color').trim();
    if (color && (color.length < 2 || color.length > 50)) {
        errors.color = 'Color must be between 2 and 50 characters';
    }

    // Image validation (only for add product)
    if (!isEdit) {
        const images = formData.getAll('images');
        if (!images || images.length === 0 || !images[0].name) {
            errors.images = 'At least one product image is required';
        } else if (images.length > 4) {
            errors.images = 'Maximum 4 images allowed';
        } else {
            const invalidImages = images.filter(img => !img.type.startsWith('image/'));
            if (invalidImages.length > 0) {
                errors.images = 'Please upload only image files';
            }
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

// Function to display error messages
const displayErrors = (errors) => {
    // Clear all existing error messages
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    
    // Display new error messages
    Object.keys(errors).forEach(field => {
        const errorElement = document.getElementById(`${field}-error`);
        if (errorElement) {
            errorElement.textContent = errors[field];
            // Add shake animation to invalid fields
            const inputElement = document.querySelector(`[name="${field}"]`);
            if (inputElement) {
                inputElement.classList.add('is-invalid');
                inputElement.addEventListener('input', function() {
                    this.classList.remove('is-invalid');
                    errorElement.textContent = '';
                }, { once: true });
            }
        }
    });
};

// Function to handle form submission
const handleProductSubmit = async (form, isEdit = false) => {
    try {
        const formData = new FormData(form);
        const validation = validateProductForm(formData, isEdit);

        if (!validation.isValid) {
            displayErrors(validation.errors);
            return false;
        }

        // Show loading state
        Swal.fire({
            title: isEdit ? 'Updating Product...' : 'Adding Product...',
            text: 'Please wait',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch(form.action, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            await Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: result.message,
                confirmButtonText: 'OK'
            });
            window.location.href = '/admin/products';
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: result.message || `Failed to ${isEdit ? 'update' : 'add'} product`
            });
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: `An error occurred while ${isEdit ? 'updating' : 'adding'} the product`
        });
    }
    return false;
};
