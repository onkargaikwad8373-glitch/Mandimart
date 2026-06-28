import "dotenv/config";

import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { dbManager } from "./db";
import { translateText, translateFields, localTranslate } from "./ai";

// console.log("SERVER ENV:", process.env.MONGODB_URI);


async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON request body parsing
  app.use(express.json());

  // CORS middleware
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-App-Language");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Log API requests
  app.use((req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.url}`);
    next();
  });

  // --- API ROUTES ---

  // Public Health Check Endpoint (For keeping server awake)
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const JWT_SECRET = process.env.JWT_SECRET || "mandimate-jwt-secret-key-123!";

  // Authentication middleware
  const authenticateToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Access token is missing" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: "Owner" | "Staff" };
      
      const users = await dbManager.getUsers();
      const user = users.find(u => u.id === decoded.id);
      if (!user) {
        return res.status(401).json({ error: "User no longer exists" });
      }
      if (user.isDisabled) {
        return res.status(403).json({ error: "Account is disabled. Please contact the owner." });
      }

      req.user = decoded;
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired access token" });
    }
  };

  // Owner only middleware
  const requireOwner = (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== "Owner") {
      return res.status(403).json({ error: "Access denied. Owner privileges required." });
    }
    next();
  };

  // Login endpoint (public)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and Password are required" });
      }

      const users = await dbManager.getUsers();
      const user = users.find(u => (u.email || "").toLowerCase() === email.toLowerCase());

      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (user.isDisabled) {
        return res.status(403).json({ error: "Account is disabled. Please contact the owner." });
      }

      const isMatch = bcrypt.compareSync(password, user.password || "");
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Apply authentication to all other api routes
  app.use("/api", (req, res, next) => {
    if (req.path === "/auth/login") {
      return next();
    }
    authenticateToken(req, res, next);
  });

  // Get current user profile (protected)
  app.get("/api/auth/me", async (req: any, res) => {
    try {
      const users = await dbManager.getUsers();
      const user = users.find(u => u.id === req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- STAFF / USER MANAGEMENT ENDPOINTS (Owner Only) ---

  // Get all users
  app.get("/api/users", requireOwner, async (req, res) => {
    try {
      const usersRaw = await dbManager.getUsers();
      const users = usersRaw.map((u: any) => {
        const { password, passwordHash, ...rest } = u;
        return rest;
      });
      res.json(users);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Add a new staff account
  app.post("/api/users", requireOwner, async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: "Name, email, password and role are required" });
      }

      const existingUsers = await dbManager.getUsers();
      if (existingUsers.some(u => (u.email || "").toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ error: "A user with this email already exists" });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const newUser = await dbManager.addUser({
        name,
        email,
        password: hashedPassword,
        role: role as "Owner" | "Staff",
        isDisabled: false
      });

      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Edit a staff/user account
  app.put("/api/users/:id", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, role } = req.body;

      if (!name || !email || !role) {
        return res.status(400).json({ error: "Name, email, and role are required" });
      }

      const updated = await dbManager.updateUser(id, { name, email, role: role as "Owner" | "Staff" });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Toggle disable/enable staff status
  app.put("/api/users/:id/disable", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const { isDisabled } = req.body;

      if (typeof isDisabled !== "boolean") {
        return res.status(400).json({ error: "isDisabled must be a boolean" });
      }

      const users = await dbManager.getUsers();
      const targetUser = users.find(u => u.id === id);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (targetUser.role === "Owner" && isDisabled) {
        // Count active owners
        const activeOwners = users.filter(u => u.role === "Owner" && !u.isDisabled);
        if (activeOwners.length <= 1) {
          return res.status(400).json({ error: "Cannot disable the only remaining Owner account." });
        }
      }

      const updated = await dbManager.updateUser(id, { isDisabled });
      const { password: _, ...userWithoutPassword } = updated!;
      res.json(userWithoutPassword);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Reset a user's password
  app.put("/api/users/:id/reset-password", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: "New password is required" });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const updated = await dbManager.updateUser(id, { password: hashedPassword });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 1. Farmers CRUD

  app.get("/api/farmers", async (req, res) => {
    try {
      const langHeader = req.headers["x-app-language"];
      const lang = typeof langHeader === "string" ? langHeader : "en";
      res.json(await dbManager.getFarmers(lang));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/farmers", requireOwner, async (req, res) => {
    try {
      const { name, mobile, address, notes } = req.body;
      if (!name || !mobile) {
        return res.status(400).json({ error: "Farmer Name and Mobile are required" });
      }

      const farmer = await dbManager.addFarmer({
        name,
        mobile,
        address: address || "",
        notes: notes || ""
      });
      
      res.status(201).json(farmer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/farmers/:id", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, mobile, address, notes } = req.body;
      if (!name || !mobile) {
        return res.status(400).json({ error: "Farmer Name and Mobile are required" });
      }

      const updated = await dbManager.updateFarmer(id, {
        name,
        mobile,
        address: address || "",
        notes: notes || ""
      });
      if (!updated) {
        return res.status(404).json({ error: "Farmer not found" });
      }
      
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/farmers/:id", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await dbManager.deleteFarmer(id);
      if (!success) {
        return res.status(404).json({ error: "Farmer not found or already deleted" });
      }
      res.json({ success: true, message: "Farmer deleted successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // 2. Customers CRUD
  app.get("/api/customers", async (req, res) => {
    try {
      const langHeader = req.headers["x-app-language"];
      const lang = typeof langHeader === "string" ? langHeader : "en";
      res.json(await dbManager.getCustomers(lang));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const { name, mobile, address, businessName } = req.body;
      if (!name || !mobile) {
        return res.status(400).json({ error: "Customer Name and Mobile are required" });
      }

      const customer = await dbManager.addCustomer({
        name,
        mobile,
        address: address || "",
        businessName: businessName || ""
      });
      
      res.status(201).json(customer);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/customers/:id", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, mobile, address, businessName } = req.body;
      if (!name || !mobile) {
        return res.status(400).json({ error: "Customer Name and Mobile are required" });
      }

      const updated = await dbManager.updateCustomer(id, {
        name,
        mobile,
        address: address || "",
        businessName: businessName || ""
      });
      if (!updated) {
        return res.status(404).json({ error: "Customer not found" });
      }
      
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/customers/:id", requireOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await dbManager.deleteCustomer(id);
      if (!success) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json({ success: true, message: "Customer deleted successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // 3. Vegetables CRUD (Inventory)
  app.get("/api/vegetables", async (req, res) => {
    try {
      const langHeader = req.headers["x-app-language"];
      const lang = typeof langHeader === "string" ? langHeader : "en";
      res.json(await dbManager.getVegetables(lang));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/vegetables", async (req, res) => {
    try {
      const { farmerId, farmerName, vegetableName, quality, quantity, bags, purchasePrice, sellingPrice, dateAdded, imageUrl, photoCapturedAt } = req.body;
      if (!farmerId || !farmerName || !vegetableName || !quality || quantity === undefined) {
        return res.status(400).json({ error: "Missing required inventory fields" });
      }

      // Auto-register farmer if they don't exist in the Farmers directory yet
      const existingFarmers = await dbManager.getFarmers("en");
      const farmerExists = existingFarmers.some(
        (f: any) =>
          f.id === farmerId ||
          (f.name || "").toLowerCase().trim() === (farmerName || "").toLowerCase().trim()
      );

      if (!farmerExists) {
        // New farmer: auto-create their record in the Farmers dashboard
        await dbManager.addFarmer({
          name: farmerName.trim(),
          mobile: "",       // No mobile collected at stock-entry time; owner can edit later
          address: "",
          notes: "Auto-registered when first stock batch was added."
        });
        console.log(`[Auto-Register] New farmer "${farmerName}" added to Farmers directory.`);
      }

      const veg = await dbManager.addVegetable({
        farmerId,
        farmerName,
        vegetableName,
        quality,
        quantity: Number(quantity),
        bags: Number(bags || 0),
        purchasePrice: Number(purchasePrice || 0),
        sellingPrice: Number(sellingPrice || 0),
        dateAdded: dateAdded,
        imageUrl: imageUrl,
        photoCapturedAt: photoCapturedAt
      });
      
      res.status(201).json(veg);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  app.put("/api/vegetables/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { farmerId, farmerName, vegetableName, quality, quantity, purchasePrice, sellingPrice, dateAdded, imageUrl, photoCapturedAt } = req.body;

      const updated = await dbManager.updateVegetable(id, {
        farmerId,
        farmerName,
        vegetableName,
        quality,
        quantity: Number(quantity),
        purchasePrice: Number(purchasePrice || 0),
        sellingPrice: Number(sellingPrice || 0),
        dateAdded: dateAdded,
        imageUrl: imageUrl,
        photoCapturedAt: photoCapturedAt
      });
      if (!updated) {
        return res.status(404).json({ error: "Inventory batch not found" });
      }
      
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/vegetables/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await dbManager.deleteVegetable(id);
      if (!success) {
        return res.status(404).json({ error: "Inventory batch not found" });
      }
      res.json({ success: true, message: "Inventory batch deleted successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // 4. Invoices CRUD (Sales Transactions)
  app.get("/api/invoices", async (req, res) => {
    try {
      const langHeader = req.headers["x-app-language"];
      const lang = typeof langHeader === "string" ? langHeader : "en";
      res.json(await dbManager.getInvoices(lang));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const {
        customerId,
        customerName,
        customerMobile,
        customerBusiness,
        items,
        subtotal,
        gst,
        total,
        amountPaid,
        amountPending,
        paymentMethod,
        paymentStatus
      } = req.body;

      if (!customerId || !customerName || !items || items.length === 0) {
        return res.status(400).json({ error: "Customer details and at least one vegetable item are required to create an invoice." });
      }

      // Safeguard types
      const invoice = await dbManager.createInvoice({
        customerId,
        customerName,
        customerMobile,
        customerBusiness: customerBusiness || "",
        items,
        subtotal: Number(subtotal),
        gst: Number(gst),
        total: Number(total),
        amountPaid: Number(amountPaid),
        amountPending: Number(amountPending),
        paymentMethod,
        paymentStatus
      });

      res.status(201).json(invoice);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Record additional payments on partial/pending invoices
  app.post("/api/invoices/:id/payments", async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, paymentMethod } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid payment amount is required" });
      }

      const paymentResult = await dbManager.recordPayment(id, Number(amount), paymentMethod || "Cash");
      if (!paymentResult) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(paymentResult);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // 5. Payments list
  app.get("/api/payments", async (req, res) => {
    try {
      const langHeader = req.headers["x-app-language"];
      const lang = typeof langHeader === "string" ? langHeader : "en";
      res.json(await dbManager.getPayments(lang));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // 6. Dashboard metrics & graphs
  app.get("/api/dashboard/stats", requireOwner, async (req, res) => {
    try {
      const langHeader = req.headers["x-app-language"];
      const lang = typeof langHeader === "string" ? langHeader : "en";
      const { date } = req.query;
      const stats = await dbManager.getDashboardStats(lang, date as string);
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // 7. Download Reports - Expose a route that outputs dynamic CSV text
  app.get("/api/reports/export", requireOwner, async (req, res) => {
    try {
      const { type } = req.query; // type can be 'sales', 'profit', 'farmers', 'customers', 'pending'
      const langHeader = req.headers["x-app-language"];
      const lang = typeof langHeader === "string" ? langHeader : "en";

      const [invoices, vegetables, farmers, customers] = await Promise.all([
        dbManager.getInvoices(lang),
        dbManager.getVegetables(lang),
        dbManager.getFarmers(lang),
        dbManager.getCustomers(lang)
      ]);

      res.setHeader("Content-Type", "text/csv");

      if (type === "sales") {
        res.setHeader("Content-Disposition", "attachment; filename=MandiMate_Sales_Report.csv");
        let csv = "Invoice Number,Date,Customer Name,Business,Subtotal,GST (5%),Grand Total,Payment Method,Payment Status\n";
        invoices.forEach(inv => {
          csv += `"${inv.invoiceNumber}","${inv.createdAt.slice(0, 10)}","${inv.customerName}","${inv.customerBusiness || ""}","₹${inv.subtotal}","₹${inv.gst}","₹${inv.total}","${inv.paymentMethod}","${inv.paymentStatus}"\n`;
        });
        return res.send(csv);
      }

      if (type === "profit") {
        res.setHeader("Content-Disposition", "attachment; filename=MandiMate_Profit_Report.csv");
        let csv = "Invoice Number,Date,Customer Name,Items Sold,Selling Amount,Purchase Cost,Net Profit\n";
        invoices.forEach(inv => {
          let purchaseCost = 0;
          let itemNames: string[] = [];
          inv.items.forEach(item => {
            purchaseCost += item.quantity * item.purchasePrice;
            itemNames.push(`${item.vegetableName} (${item.quantity}kg)`);
          });
          const netProfit = inv.subtotal - purchaseCost;
          csv += `"${inv.invoiceNumber}","${inv.createdAt.slice(0, 10)}","${inv.customerName}","${itemNames.join(" | ")}","₹${inv.subtotal}","₹${purchaseCost}","₹${netProfit}"\n`;
        });
        return res.send(csv);
      }

      if (type === "farmers") {
        res.setHeader("Content-Disposition", "attachment; filename=MandiMate_Farmer_Supplies.csv");
        let csv = "Farmer Name,Mobile,Vegetables Supplied,Total Sold Weight (Kg),Sales Value,Profit Value\n";
        const stats = await dbManager.getDashboardStats(lang);
        stats.farmerWiseReport.forEach(f => {
          csv += `"${f.farmerName}","${farmers.find(farmer => farmer.id === f.farmerId)?.mobile || ""}","${f.vegetablesSupplied.join(" | ")}","${f.quantitySold} kg","₹${f.revenueGenerated}","₹${f.profitGenerated}"\n`;
        });
        return res.send(csv);
      }

      if (type === "customers") {
        res.setHeader("Content-Disposition", "attachment; filename=MandiMate_Customer_Report.csv");
        let csv = "Customer Name,Business Name,Mobile,Total Purchased,Amount Paid,Amount Pending\n";
        
        // aggregate by customer
        const custMap: Record<string, { name: string; business: string; mobile: string; total: number; paid: number; pending: number }> = {};
        customers.forEach(c => {
          custMap[c.id] = { name: c.name, business: c.businessName, mobile: c.mobile, total: 0, paid: 0, pending: 0 };
        });

        invoices.forEach(inv => {
          if (!custMap[inv.customerId]) {
            custMap[inv.customerId] = { name: inv.customerName, business: inv.customerBusiness || "", mobile: inv.customerMobile || "", total: 0, paid: 0, pending: 0 };
          }
          custMap[inv.customerId].total += inv.total;
          custMap[inv.customerId].paid += inv.amountPaid;
          custMap[inv.customerId].pending += inv.amountPending;
        });

        Object.values(custMap).forEach(c => {
          csv += `"${c.name}","${c.business}","${c.mobile}","₹${c.total}","₹${c.paid}","₹${c.pending}"\n`;
        });
        return res.send(csv);
      }

      if (type === "pending") {
        res.setHeader("Content-Disposition", "attachment; filename=MandiMate_Pending_Payments.csv");
        let csv = "Invoice Number,Date,Customer Name,Business,Mobile,Total Amount,Paid,Outstanding Balance\n";
        invoices.forEach(inv => {
          if (inv.amountPending > 0) {
            csv += `"${inv.invoiceNumber}","${inv.createdAt.slice(0, 10)}","${inv.customerName}","${inv.customerBusiness || ""}","${inv.customerMobile}","₹${inv.total}","₹${inv.amountPaid}","₹${inv.amountPending}"\n`;
          }
        });
        return res.send(csv);
      }

      // Default fallback
      res.setHeader("Content-Disposition", "attachment; filename=MandiMate_Report.csv");
      return res.send("No report specified or invalid type");
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });


  // Listen on port
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[MandiMate Server] Backend listening on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Critical error starting MandiMate full-stack server:", error);
});
