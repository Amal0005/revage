const Category = require("../../models/categorySchema"); 

const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        console.log(`Fetching categories with skip: ${skip}, limit: ${limit}`);

        const categoryData = await Category.find({})
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


const addCategory = async (req, res) => {
    const { name, description } = req.body;
    try {
        const existingCategory = await Category.findOne({
            name: { $regex: name, $options: "i" },
        });
        if (existingCategory) {
            return res.status(400).json({ message: "Category already exists" });
        }
        const newCategory = new Category({ 
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

const getEditCategory = async (req, res) => {
    try {
        const categoryId = req.query.id;
        const category = await Category.findById(categoryId);
        if (!category) {
            console.log("Category not found");
            return res.status(404).send("Category not found");
        }
        res.render("admin/edit-category", { category });
    } catch (error) {
        console.error("Error fetching category:", error);
        res.status(500).send("Server error");
    }
};

const editCategory = async (req, res) => {
    const { id } = req.query; 
    const { categoryName, description } = req.body;

    if (!id) {
        return res.status(400).json({ message: "ID is required" });
    }

    if (!categoryName || !description) {
        return res.status(400).json({ error: "All fields are required." });
    }

    try {
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryName, description },
            { new: true } 
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

const getCategoryList = async (req, res) => {
    try {
        const categories = await Category.find({}).sort({ createdAt: -1 });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching categories' });
    }
};

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

const updateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const categoryId = req.params.id;

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

const addCategoryOffer = async (req, res) => {
    try {
        const { categoryId, percentage } = req.body;

        // Validate percentage
        if (!percentage || percentage <= 0 || percentage > 100) {
            return res.status(400).json({
                status: false,
                message: "Please provide a valid offer percentage between 1 and 100"
            });
        }

        // Find and update the category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                status: false,
                message: "Category not found"
            });
        }

        category.categoryOffer = percentage;
        await category.save();

        return res.json({
            status: true,
            message: "Offer added successfully"
        });
    } catch (error) {
        console.error("Error adding category offer:", error);
        return res.status(500).json({
            status: false,
            message: "Failed to add offer"
        });
    }
};

const removeCategoryOffer = async (req, res) => {
    try {
        const { categoryId } = req.body;

        // Find and update the category
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({
                status: false,
                message: "Category not found"
            });
        }

        category.categoryOffer = 0;
        await category.save();

        return res.json({
            status: true,
            message: "Offer removed successfully"
        });
    } catch (error) {
        console.error("Error removing category offer:", error);
        return res.status(500).json({
            status: false,
            message: "Failed to remove offer"
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
    toggleCategoryStatus,
    addCategoryOffer,
    removeCategoryOffer
};
