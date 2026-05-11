// ──────────────────────────────────────────────
//  routes/products.js
//  GET    /api/products          — list all (public)
//  GET    /api/products/:id      — single product (public)
//  POST   /api/products          — add product (owner only)
//  DELETE /api/products/:id      — delete product (owner only)
// ──────────────────────────────────────────────
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { db } = require("../db");
const requireOwner = require("../middleware/requireOwner");
const logger = require("../utils/logger");
const { z } = require("zod");

const router = express.Router();

// ── Category Routes ─────────────────────────────
router.get("/categories", async (req, res) => {
  try {
    const rows = await db.prepare("SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY position ASC, name ASC").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/categories", requireOwner, async (req, res) => {
  try {
    const { name, parent_id, position, description } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) slug = 'cat-' + Date.now();
    
    // Check if slug exists, if so append a random string
    const existing = await db.prepare("SELECT id FROM categories WHERE slug = $1").get(slug);
    if (existing) {
      slug += '-' + Math.floor(Math.random() * 1000);
    }

    const { lastInsertRowid } = await db.prepare(
      "INSERT INTO categories (name, slug, parent_id, position, description) VALUES ($1, $2, $3, $4, $5) RETURNING id"
    ).run(name, slug, parent_id || null, position || 0, description || null);
    
    res.json({ id: lastInsertRowid, name, slug });
  } catch (err) {
    logger.error(err, "Failed to create category");
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete("/categories/:id", requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if any products are using this category
    const products = await db.prepare("SELECT id FROM products WHERE category_id = $1 AND deleted_at IS NULL").get(id);
    if (products) {
      return res.status(400).json({ error: "Cannot delete category that has active products. Please move or delete products first." });
    }

    await db.prepare("UPDATE categories SET deleted_at = NOW() WHERE id = $1").run(id);
    
    await db.logAudit({
      action: 'CATEGORY_DELETE',
      details: `Deleted category ID: ${id}`,
      adminId: req.owner?.email
    });

    res.json({ success: true });
  } catch (err) {
    logger.error(err, "Failed to delete category");
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// ── Image upload config ─────────────────────────
const UPLOADS_DIR = path.join(__dirname, "..", "data", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `product_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIMES.includes(file.mimetype));
  },
});

// Helper — format a DB row to the shape the frontend expects
function formatProduct(row, variants = []) {
  // Support both price_paise (new) and price (legacy) columns
  const paise = row.price_paise || Math.round((row.price || 0) * 100);
  const priceRupees = Math.round(paise / 100);

  // If variants provided, totalStock is their sum
  // If row has total_stock (from joined query), use that
  let totalStock = 0;
  if (variants && variants.length > 0) {
    totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  } else if (row.total_stock !== undefined) {
    totalStock = row.total_stock;
  }

  return {
    id: String(row.id),
    name: row.name,
    price: priceRupees,
    formattedPrice: `₹${priceRupees.toLocaleString("en-IN")}`,
    price_paise: paise,
    category: row.category_name || row.category || "Uncategorized",
    category_id: row.category_id,
    compare_at_price_paise: row.compare_at_price_paise,
    compare_at_price: row.compare_at_price_paise ? Math.round(row.compare_at_price_paise / 100) : null,
    collection: row.collection || "",
    images: row.images_json ? JSON.parse(row.images_json) : (row.image_url ? [row.image_url] : []),
    slug: row.slug || "",
    meta_title: row.meta_title || "",
    meta_description: row.meta_description || "",
    description: row.description || "",
    totalStock,
    variants,
    created_at: row.created_at,
  };
}

// ── GET /api/products ───────────────────────────
router.get("/", async (req, res) => {
  try {
    const { category, collection } = req.query;
    
    // Check if it's an owner request (to show out-of-stock items)
    let isOwner = false;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      try {
        const jwt = require("jsonwebtoken");
        const token = auth.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === "owner") {
          isOwner = true;
        }
      } catch (err) {
        // Not a valid token or not an owner, treat as public
      }
    }

    let sql = `
      SELECT p.*, c.name as category_name, COALESCE(SUM(pv.stock), 0) as total_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON p.id = pv.product_id
    `;
    let params = [];
    let where = ["p.deleted_at IS NULL"];
    if (category) {
      params.push(category);
      where.push(`p.category = $${params.length}`);
    }
    if (collection) {
      params.push(collection);
      where.push(`p.collection = $${params.length}`);
    }
    
    if (where.length > 0) {
      sql += " WHERE " + where.join(" AND ");
    }

    sql += " GROUP BY p.id, c.name"; // Added c.name for pg compliance

    // Hide out-of-stock for public
    if (!isOwner) {
      sql += " HAVING COALESCE(SUM(pv.stock), 0) > 0";
    }

    sql += " ORDER BY p.id DESC";

    const rows = await db.prepare(sql).all(...params);
    res.json({ products: rows.map(row => formatProduct(row)) });
  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ── GET /api/products/:id ───────────────────────
router.get("/:id", async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT p.*, c.name as category_name,
             pv.id    AS variant_id,
             pv.size  AS variant_size,
             pv.color AS variant_color,
             pv.stock AS variant_stock
      FROM   products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      WHERE (p.id::text = $1 OR p.slug = $2) AND p.deleted_at IS NULL
      ORDER BY pv.id ASC
    `).all(req.params.id, req.params.id);

    if (!rows.length) return res.status(404).json({ error: "Product not found" });

    const variants = rows
      .filter(r => r.variant_id != null)
      .map(r => ({
        id: String(r.variant_id),
        size: r.variant_size,
        color: r.variant_color,
        stock: r.variant_stock
      }));

    res.json({ product: formatProduct(rows[0], variants) });
  } catch (err) {
    console.error("GET /api/products/:id error:", err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Schema for product creation/update
const productSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  price: z.coerce.number().positive("Price must be positive"),
  compare_at_price: z.coerce.number().nonnegative().optional().nullable(),
  category: z.union([z.string(), z.number()]),
  category_id: z.union([z.string(), z.number()]).optional().nullable(),
  collection: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sizes: z.union([z.string(), z.array(z.string())]).optional(),
  stock: z.union([z.string(), z.array(z.coerce.number())]).optional(),
  meta_title: z.string().optional().nullable(),
  meta_description: z.string().optional().nullable(),
  slug: z.string().optional().nullable()
});

// ── POST /api/products (owner only) ────────────
router.post(
  "/",
  requireOwner,
  upload.array("images", 10),
  async (req, res) => {
    let productId;
    try {
      const validated = productSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ error: "Validation failed", details: validated.error.format() });
      }

      const { name, price, compare_at_price, category, collection, description } = validated.data;

      // multer 2.x strips [] suffix: sizes[] → req.body.sizes (array)
      const rawSizes = req.body.sizes ?? req.body['sizes[]'] ?? [];
      const sizes = Array.isArray(rawSizes) ? rawSizes : [rawSizes];
      const rawStock = req.body.stock ?? req.body['stock[]'] ?? [];
      const stockArr = Array.isArray(rawStock) ? rawStock : [rawStock];

      if (!sizes.length || (sizes.length === 1 && sizes[0] === '')) {
        return res.status(400).json({ error: "At least one size is required" });
      }

      // Build absolute URLs for the uploaded images
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const imageUrls = (req.files || []).map(f => `${baseUrl}/uploads/${f.filename}`);
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4);
      
      // Resolve category_id (if category is string, find or create it)
      let catId = parseInt(category, 10);
      if (isNaN(catId)) {
        const existingCat = await db.prepare("SELECT id FROM categories WHERE name = $1 OR slug = $2").get(category, category.toLowerCase());
        if (existingCat) {
          catId = existingCat.id;
        } else {
          const { lastInsertRowid } = await db.prepare("INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id").run(category, category.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
          catId = lastInsertRowid;
        }
      }

      const productResult = await db.prepare(
          `INSERT INTO products (name, price_paise, compare_at_price_paise, category_id, collection, slug, description, meta_title, meta_description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`
        ).run(
          name.trim(),
          Math.round(price * 100),
          compare_at_price ? Math.round(parseFloat(compare_at_price) * 100) : null,
          catId,
          (collection || "").trim(),
          slug,
          (description || "").trim() || null,
          (req.body.meta_title || "").trim() || null,
          (req.body.meta_description || "").trim() || null
        );
      
      productId = productResult.lastInsertRowid;

      for (let i = 0; i < sizes.length; i++) {
        const size = sizes[i];
        const stock = parseInt(stockArr[i] ?? '0', 10);
        const { lastInsertRowid: variantId } = await db.prepare(
          `INSERT INTO product_variants (product_id, size, stock) VALUES ($1, $2, $3) RETURNING id`
        ).run(productId, size, isNaN(stock) ? 0 : Math.max(0, stock));

        // Log initial stock
        if (stock > 0) {
          await db.prepare(`INSERT INTO inventory_logs (variant_id, change, reason, admin_id) VALUES ($1, $2, $3, $4)`).run(
            variantId, stock, 'initial_stock', req.owner?.id || req.owner?.email
          );
        }
      }

      // Handle images (legacy images_json for now, but we should also write to product_images)
      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        await db.prepare(`INSERT INTO product_images (product_id, url, position) VALUES ($1, $2, $3)`).run(productId, url, i);
      }
      const imagesJson = JSON.stringify(imageUrls);
      
      const totalStock = stockArr.reduce((sum, s) => {
        const val = parseInt(s ?? "0", 10);
        return sum + (isNaN(val) ? 0 : Math.max(0, val));
      }, 0);

      // Keep images_json for backward compatibility until frontend is updated
      await db.prepare(`UPDATE products SET images_json = $1 WHERE id = $2`).run(imagesJson, productId);

      // Audit log
      await db.logAudit({
        action: 'PRODUCT_CREATE',
        details: `Created product: ${name.trim()}`,
        newValue: { name: name.trim(), price: price, stock: totalStock }
      });

      const newRows = await db.prepare(`
        SELECT p.*,
               pv.id    AS variant_id,
               pv.size  AS variant_size,
               pv.color AS variant_color,
               pv.stock AS variant_stock
        FROM   products p
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        WHERE  p.id = $1
        ORDER BY pv.id ASC
      `).all(productId);

      const newVariants = newRows
        .filter(r => r.variant_id != null)
        .map(r => ({
          id: String(r.variant_id),
          size: r.variant_size,
          color: r.variant_color,
          stock: r.variant_stock
        }));

      logger.info({ productId, name: name.trim() }, "Product created");
      res.status(201).json({ product: formatProduct(newRows[0], newVariants) });
    } catch (err) {
      logger.error({ 
        error: err.message, 
        stack: err.stack,
        body: req.body,
        productId: productId || 'failed' 
      }, "POST /api/products error");
      res.status(500).json({ error: "Failed to create product", details: err.message });
    }
  }
);

// ── DELETE /api/products/:id (owner only) ───────
router.delete("/:id", requireOwner, async (req, res) => {
  try {
    const row = await db
      .prepare("SELECT * FROM products WHERE id = $1")
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Product not found" });

    // Cleanup all local image files associated with this product
    const images = await db.prepare("SELECT url FROM product_images WHERE product_id = $1").all(req.params.id);
    for (const img of images) {
      if (img.url && img.url.includes("/uploads/")) {
        try {
          const filename = path.basename(img.url.split('?')[0]);
          const filePath = path.join(UPLOADS_DIR, filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }
    }

    // Soft delete record
    await db.prepare("UPDATE products SET deleted_at = NOW(), slug = slug || '-' || $2 WHERE id = $1").run(req.params.id, Date.now().toString());
    
    // Also soft delete variants
    await db.prepare("UPDATE product_variants SET deleted_at = NOW() WHERE product_id = $1").run(req.params.id);
    
    // Audit log
    await db.logAudit({
      action: 'PRODUCT_DELETE',
      details: `Deleted product ID: ${req.params.id} (${row.name})`,
      oldValue: row
    });
    logger.info({ productId: req.params.id }, "Product deleted");

    res.json({ success: true });
  } catch (err) {
    logger.error(err, "Failed to delete product");
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ── PATCH /api/products/:id (owner only) ───────
router.patch("/:id", requireOwner, async (req, res) => {
  try {
    const validated = productSchema.partial().safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ error: "Validation failed", details: validated.error.format() });
    }

    const { name, price, compare_at_price, description, sizes, stock: stockArr, category, category_id, collection, meta_title, meta_description, slug } = validated.data;

    // 1. Existence check
    const existing = await db
      .prepare("SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL")
      .get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    // 2. Build update query
    let updates = [];
    let params = [];
    if (name) { updates.push(`name = $${params.length + 1}`); params.push(name); }
    if (price) { updates.push(`price_paise = $${params.length + 1}`); params.push(Math.round(price * 100)); }
    if (compare_at_price !== undefined) { updates.push(`compare_at_price_paise = $${params.length + 1}`); params.push(compare_at_price ? Math.round(compare_at_price * 100) : null); }
    if (description !== undefined) { updates.push(`description = $${params.length + 1}`); params.push(description); }
    const actualCatIdRaw = category || category_id;
    if (actualCatIdRaw) {
      let finalCatId = parseInt(actualCatIdRaw, 10);
      if (isNaN(finalCatId)) {
        // Resolve name to ID
        const existingCat = await db.prepare("SELECT id FROM categories WHERE name = $1 OR slug = $2").get(actualCatIdRaw, String(actualCatIdRaw).toLowerCase());
        if (existingCat) {
          finalCatId = existingCat.id;
        } else {
          const { lastInsertRowid } = await db.prepare("INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id").run(actualCatIdRaw, String(actualCatIdRaw).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
          finalCatId = lastInsertRowid;
        }
      }
      updates.push(`category_id = $${params.length + 1}`);
      params.push(finalCatId);
    }
    if (collection !== undefined) { updates.push(`collection = $${params.length + 1}`); params.push(collection); }
    if (meta_title !== undefined) { updates.push(`meta_title = $${params.length + 1}`); params.push(meta_title); }
    if (meta_description !== undefined) { updates.push(`meta_description = $${params.length + 1}`); params.push(meta_description); }
    if (slug) { updates.push(`slug = $${params.length + 1}`); params.push(slug); }

    if (updates.length > 0) {
      params.push(req.params.id);
      await db.prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = $${params.length}`).run(...params);
    }

    // 3. Update variants if provided
    if (sizes || stockArr) {
      const sizesRaw = Array.isArray(sizes) ? sizes : sizes ? [sizes] : [];
      const stockRaw = Array.isArray(stockArr) ? stockArr : stockArr ? [stockArr] : [];

    // 5. Update variants with inventory logging
    // Instead of deleting all, we find what to update, add, or remove
    const existingVariants = await db.prepare("SELECT * FROM product_variants WHERE product_id = $1").all(req.params.id);
    const submittedSizes = new Set(sizesRaw);

    // Remove variants not in the new list
    for (const ev of existingVariants) {
      if (!submittedSizes.has(ev.size)) {
        await db.prepare("DELETE FROM product_variants WHERE id = $1").run(ev.id);
      }
    }

    for (let i = 0; i < sizesRaw.length; i++) {
      const size = sizesRaw[i];
      if (!size) continue;
      const newStock = parseInt(stockRaw[i] ?? "0", 10);
      const ev = existingVariants.find(v => v.size === size);
      
      if (ev) {
        const stockDiff = newStock - ev.stock;
        if (stockDiff !== 0) {
          await db.prepare("UPDATE product_variants SET stock = $1 WHERE id = $2").run(newStock, ev.id);
          await db.prepare(`INSERT INTO inventory_logs (variant_id, change, reason, admin_id) VALUES ($1, $2, $3, $4)`).run(
            ev.id, stockDiff, 'manual_adjustment', req.owner?.id || req.owner?.email
          );
        }
      } else {
        const { lastInsertRowid: variantId } = await db.prepare(
          "INSERT INTO product_variants (product_id, size, stock) VALUES ($1, $2, $3) RETURNING id"
        ).run(req.params.id, size, newStock);
        
        if (newStock !== 0) {
          await db.prepare(`INSERT INTO inventory_logs (variant_id, change, reason, admin_id) VALUES ($1, $2, $3, $4)`).run(
            variantId, newStock, 'manual_adjustment', req.owner?.id || req.owner?.email
          );
        }
      }
    }
    }

    // Audit log
    await db.logAudit({
      action: 'PRODUCT_UPDATE',
      details: `Updated product ID: ${req.params.id}`,
      oldValue: { name: existing.name, price: existing.price_paise },
      newValue: { name: name || existing.name, price: price ? Math.round(price * 100) : existing.price_paise }
    });

    // 6. Re-fetch with LEFT JOIN and respond with full product shape
    const rows = await db
      .prepare(
        `SELECT p.*,
                pv.id    AS variant_id,
                pv.size  AS variant_size,
                pv.color AS variant_color,
                pv.stock AS variant_stock
         FROM   products p
         LEFT JOIN product_variants pv ON pv.product_id = p.id
         WHERE  p.id = $1
         ORDER BY pv.id ASC`
      )
      .all(req.params.id);
    const variants = rows
      .filter((r) => r.variant_id != null)
      .map((r) => ({
        id: String(r.variant_id),
        size: r.variant_size,
        color: r.variant_color,
        stock: r.variant_stock,
      }));
    
    logger.info({ productId: req.params.id }, "Product updated");
    res.json({ product: formatProduct(rows[0], variants) });
  } catch (err) {
    logger.error(err, "PATCH /api/products/:id error");
    res.status(500).json({ error: "Failed to update product" });
  }
});

// ── GET /api/products/stats (owner only) ─────────
router.get("/admin/stats", requireOwner, async (req, res) => {
  try {
    // 1. Total stock health
    const stockStats = await db.prepare(`
      SELECT p.id, p.name, COALESCE(SUM(pv.stock), 0) as current_stock
      FROM products p
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      GROUP BY p.id
      HAVING COALESCE(SUM(pv.stock), 0) < 5
      ORDER BY current_stock ASC
    `).all();

    // 2. Best sellers (based on order volume)
    const bestSellers = await db.prepare(`
      SELECT product_id, name, SUM(quantity) as units_sold
      FROM order_items
      GROUP BY product_id, name
      ORDER BY units_sold DESC
      LIMIT 5
    `).all();

    // 3. Category distribution
    const categories = await db.prepare(`
      SELECT category, COUNT(*) as count
      FROM products
      GROUP BY category
    `).all();

    res.json({
      lowStock: stockStats,
      bestSellers,
      categories
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

// ── POST /api/products/bulk-update (owner only) ──
router.post("/bulk-update", requireOwner, async (req, res) => {
  try {
    const { category_id, type, value } = req.body;
    
    if (typeof value !== "number" || isNaN(value)) {
      return res.status(400).json({ error: "A valid numerical value is required" });
    }

    let query = "SELECT id, price_paise FROM products WHERE deleted_at IS NULL";
    let params = [];
    if (category_id) {
      query += " AND category_id = $1";
      params.push(category_id);
    }
    const products = await db.prepare(query).all(...params);

    if (products.length === 0) {
      return res.status(404).json({ error: "No products found to update" });
    }

    await db.transaction(async (client) => {
      for (const p of products) {
        let newPrice = p.price_paise;
        if (type === 'percentage') {
          newPrice = Math.round(p.price_paise * (1 + value / 100));
        } else if (type === 'fixed') {
          newPrice = Math.max(0, p.price_paise + (value * 100));
        }
        
        let compareAt = p.price_paise > newPrice ? p.price_paise : null;

        await client.query("UPDATE products SET price_paise = $1, compare_at_price_paise = $2 WHERE id = $3", 
          [newPrice, compareAt, p.id]);
          
        await db.logAudit({
          adminId: req.owner.email,
          action: 'PRODUCT_BULK_UPDATE',
          details: `Bulk updated price for product ID: ${p.id} via ${type}`,
          oldValue: { price_paise: p.price_paise },
          newValue: { price_paise: newPrice, compare_at_price_paise: compareAt }
        });
      }
    });

    res.json({ success: true, count: products.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to bulk update products" });
  }
});

module.exports = router;
