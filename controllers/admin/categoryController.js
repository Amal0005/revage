const Category = require("../../models/categorySchema"); // Import the correct schema

// Fetch paginated categories
const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        console.log(`Fetching categories with skip: ${skip}, limit: ${limit}`);

        const categoryData = await Category.find({}) // Use the correct model
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        console.log(`Category data fetched: ${categoryData}`);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);

        console.log(`Total categories: ${totalCategories}, Total pages: ${totalPages}`);

        res.render("admin/category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
        });
    } catch (error) {
        console.error("Error in categoryInfo:", error);
        res.redirect("/pageerror");
    }
};

// Add a new category
const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        const existingCategory = await Category.findOne({
            name: { $regex: name, $options: "i" },
        });
        if (existingCategory) {
            return res.status(400).json({ message: "Category already exists" });
        }
        const newCategory = new Category({ // Use the correct model
            name,
            description,
        });
        await newCategory.save();
        return res.json({ message: "Category added successfully" });
    } catch (error) {
        console.error("Error adding category:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

// List a category
const getListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect("/admin/category");
    } catch (error) {
        console.error("Error listing category:", error);
        res.redirect("/pageerror");
    }
};

// Unlist a category
const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.redirect("/admin/category");
    } catch (error) {
        console.error("Error unlisting category:", error);
        res.redirect("/pageerror");
    }
};

// Render the edit category page
const getEditCategory = async (req, res) => {
    try {
        const categoryId = req.query.id; // Extract the category ID from the URL
        const category = await Category.findById(categoryId); // Fetch category from the database
        if (!category) {
            console.log("Category not found");
            return res.status(404).send("Category not found");
        }
        res.render("admin/edit-category", { category }); // Pass category data to EJS
    } catch (error) {
        console.error("Error fetching category:", error);
        res.status(500).send("Server error");
    }
};

// Edit a category
const editCategory = async (req, res) => {
    const { id } = req.query; // Extract 'id' from query parameters
    const { categoryName, description } = req.body; // Extract form data

    if (!id) {
        return res.status(400).json({ message: "ID is required" });
    }

    // Validate input
    if (!categoryName || !description) {
        return res.status(400).json({ error: "All fields are required." });
    }

    try {
        // Update the category in the database
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryName, description },
            { new: true } // Return the updated document
        );

        if (!updatedCategory) {
            return res.status(404).json({ message: "Category not found" });
        }

        res.status(200).json({
            message: "Category updated successfully",
            updatedCategory,
        });
    } catch (error) {
        console.error("Error editing category:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get category list for AJAX
const getCategoryList = async (req, res) => {
    try {
        const categories = await Category.find({}).sort({ createdAt: -1 });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching categories' });
    }
};

// Get single category for editing
const getCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching category' });
    }
};

// Update category
const updateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const categoryId = req.params.id;

        // Check if category exists
        const existingCategory = await Category.findOne({ 
            name, 
            _id: { $ne: categoryId } 
        });

        if (existingCategory) {
            return res.status(400).json({ 
                success: false, 
                message: 'Category with this name already exists' 
            });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { name, description },
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ 
                success: false, 
                message: 'Category not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Category updated successfully', 
            category: updatedCategory 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error updating category' 
        });
    }
};

// List/Unlist category
const toggleCategoryStatus = async (req, res) => {
    try {
        const { id } = req.body;
        const action = req.path.includes('list') ? true : false;

        const category = await Category.findByIdAndUpdate(
            id,
            { isListed: action },
            { new: true }
        );

        if (!category) {
            return res.status(404).json({ 
                success: false, 
                message: 'Category not found' 
            });
        }

        res.json({ 
            success: true, 
            message: `Category ${action ? 'listed' : 'unlisted'} successfully`,
            category 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: `Error ${req.path.includes('list') ? 'listing' : 'unlisting'} category` 
        });
    }
};

module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    getCategoryList,
    getCategory,
    updateCategory,
    toggleCategoryStatus
};
