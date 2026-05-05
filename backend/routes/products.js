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
const db = require("../db").db;
const requireOwner = require("../middleware/requireOwner");

const router = express.Router();

// ── Image upload config ─────────────────────────
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
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
  const priceRupees = Math.round(row.price_paise / 100);
  return {
    id: String(row.id),
    name: row.name,
    price: priceRupees,
    formattedPrice: `₹${priceRupees.toLocaleString("en-IN")}`,
    price_paise: row.price_paise,
    category: row.category,
    collection: row.collection || "",
    images: row.image_url ? [row.image_url] : [],
    image_url: row.image_url || "",
    description: row.description || "",
    variants,
    created_at: row.created_at,
  };
}

// ── GET /api/products ───────────────────────────
router.get("/", (req, res) => {
  try {
    const { category, collection } = req.query;
    let stmt;
    let rows;

    if (category && collection) {
      stmt = db.prepare(
        "SELECT * FROM products WHERE category = ? AND collection = ? ORDER BY id DESC"
      );
      rows = stmt.all(category, collection);
    } else if (category) {
      stmt = db.prepare(
        "SELECT * FROM products WHERE category = ? ORDER BY id DESC"
      );
      rows = stmt.all(category);
    } else if (collection) {
      stmt = db.prepare(
        "SELECT * FROM products WHERE collection = ? ORDER BY id DESC"
      );
      rows = stmt.all(collection);
    } else {
      stmt = db.prepare("SELECT * FROM products ORDER BY id DESC");
      rows = stmt.all();
    }

    res.json({ products: rows.map(formatProduct) });
  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ── GET /api/products/:id ───────────────────────
router.get("/:id", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.*,
             pv.id    AS variant_id,
             pv.size  AS variant_size,
             pv.stock AS variant_stock
      FROM   products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      WHERE  p.id = ?
      ORDER BY pv.id ASC
    `).all(req.params.id);

    if (!rows.length) return res.status(404).json({ error: "Product not found" });

    const variants = rows
      .filter(r => r.variant_id != null)
      .map(r => ({ id: String(r.variant_id), size: r.variant_size, stock: r.variant_stock }));

    res.json({ product: formatProduct(rows[0], variants) });
  } catch (err) {
    console.error("GET /api/products/:id error:", err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// ── POST /api/products (owner only) ────────────
router.post(
  "/",
  requireOwner,
  upload.single("image"),
  (req, res) => {
    try {
      const { name, price, category, collection, description } = req.body;

      if (!name || !price || !category) {
        return res.status(400).json({ error: "name, price, and category are required" });
      }

      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ error: "price must be a positive number" });
      }

      // multer 2.x strips [] suffix: sizes[] → req.body.sizes (array)
      const rawSizes = req.body.sizes ?? req.body['sizes[]'] ?? [];
      const sizes = Array.isArray(rawSizes) ? rawSizes : [rawSizes];
      const rawStock = req.body.stock ?? req.body['stock[]'] ?? [];
      const stockArr = Array.isArray(rawStock) ? rawStock : [rawStock];

      if (!sizes.length || (sizes.length === 1 && sizes[0] === '')) {
        return res.status(400).json({ error: "At least one size is required" });
      }

      // Build absolute URL for the uploaded image
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const imageUrl = req.file
        ? `${baseUrl}/uploads/${req.file.filename}`
        : "";

      const result = db
        .prepare(
          `INSERT INTO products (name, price, price_paise, category, collection, image_url, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          name.trim(),
          priceNum,
          Math.round(priceNum * 100), // store in paise
          category.trim().toLowerCase(),
          (collection || "").trim(),
          imageUrl,
          (description || "").trim() || null
        );

      const productId = result.lastInsertRowid;
      const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
      sizes.forEach((size, i) => {
        if (!VALID_SIZES.includes(size)) return; // discard unknown sizes
        const stock = parseInt(stockArr[i] ?? '0', 10);
        db.prepare(
          `INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)`
        ).run(productId, size, isNaN(stock) ? 0 : Math.max(0, stock));
      });

      const newRows = db.prepare(`
        SELECT p.*,
               pv.id    AS variant_id,
               pv.size  AS variant_size,
               pv.stock AS variant_stock
        FROM   products p
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        WHERE  p.id = ?
        ORDER BY pv.id ASC
      `).all(productId);

      const newVariants = newRows
        .filter(r => r.variant_id != null)
        .map(r => ({ id: String(r.variant_id), size: r.variant_size, stock: r.variant_stock }));

      res.status(201).json({ product: formatProduct(newRows[0], newVariants) });
    } catch (err) {
      console.error("POST /api/products error:", err);
      res.status(500).json({ error: "Failed to create product" });
    }
  }
);

// ── DELETE /api/products/:id (owner only) ───────
router.delete("/:id", requireOwner, (req, res) => {
  try {
    const row = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Product not found" });

    // Delete the image file from disk if it's a local upload
    // Use a safe fallback that handles both absolute URLs and relative paths
    if (row.image_url && row.image_url.includes("/uploads/")) {
      try {
        const pathname = row.image_url.startsWith("http")
          ? new URL(row.image_url).pathname
          : row.image_url;
        const filename = path.basename(pathname);
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        }
      } catch { /* ignore image cleanup errors — still delete the record */ }
    }

    // Delete record unconditionally — image cleanup failure must not block deletion
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/products/:id error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// ── PATCH /api/products/:id (owner only) ───────
router.patch("/:id", requireOwner, (req, res) => {
  try {
    const { name, price, description, sizes, stock: stockArr } = req.body;

    // 1. Existence check
    const existing = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    // 2. Validate required fields
    if (!name || !price) {
      return res.status(400).json({ error: "name and price are required" });
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: "price must be a positive number" });
    }

    // 3. Validate + normalise sizes array
    // Deduplicate before DELETE to prevent orphaned variants on INSERT failure (D-06)
    const sizesRaw = Array.isArray(sizes) ? sizes : sizes ? [sizes] : [];
    const stockRaw = Array.isArray(stockArr) ? stockArr : stockArr ? [stockArr] : [];
    const VALID_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Free Size"];
    const seen = new Set();
    const sizesFiltered = [];
    const stockFiltered = [];
    sizesRaw.forEach((sz, i) => {
      if (!VALID_SIZES.includes(sz)) return;
      if (seen.has(sz)) return;
      seen.add(sz);
      sizesFiltered.push(sz);
      stockFiltered.push(stockRaw[i]);
    });
    if (!sizesFiltered.length) {
      return res.status(400).json({ error: "At least one size is required" });
    }

    // 4. Update products row (price stored in paise)
    db.prepare(
      "UPDATE products SET name = ?, price = ?, price_paise = ?, description = ? WHERE id = ?"
    ).run(
      name.trim(),
      priceNum,
      Math.round(priceNum * 100),
      (description || "").trim() || null,
      req.params.id
    );

    // 5. Delete all existing variants, then re-insert submitted set (D-06)
    db.prepare("DELETE FROM product_variants WHERE product_id = ?").run(
      req.params.id
    );
    sizesFiltered.forEach((size, i) => {
      const s = parseInt(stockFiltered[i] ?? "0", 10);
      db.prepare(
        "INSERT INTO product_variants (product_id, size, stock) VALUES (?, ?, ?)"
      ).run(req.params.id, size, isNaN(s) ? 0 : Math.max(0, s));
    });

    // 6. Re-fetch with LEFT JOIN and respond with full product shape
    const rows = db
      .prepare(
        `SELECT p.*,
                pv.id    AS variant_id,
                pv.size  AS variant_size,
                pv.stock AS variant_stock
         FROM   products p
         LEFT JOIN product_variants pv ON pv.product_id = p.id
         WHERE  p.id = ?
         ORDER BY pv.id ASC`
      )
      .all(req.params.id);
    const variants = rows
      .filter((r) => r.variant_id != null)
      .map((r) => ({
        id: String(r.variant_id),
        size: r.variant_size,
        stock: r.variant_stock,
      }));
    res.json({ product: formatProduct(rows[0], variants) });
  } catch (err) {
    console.error("PATCH /api/products/:id error:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

module.exports = router;
