import fs from "fs";
import path from "path";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { Farmer, Customer, Vegetable, Invoice, PaymentLog, User, PaymentStatus } from "./types";
import { translateFields, translateText } from "./ai";

interface DBStructure {
  farmers: Farmer[];
  customers: Customer[];
  vegetables: Vegetable[];
  invoices: Invoice[];
  payments: PaymentLog[];
  users: User[];
}

const DEFAULT_DB: DBStructure = {
  farmers: [
    { id: "f-1", name: "Ramesh Kumar (Bhendi specialist)", mobile: "9876543210", address: "Malthan Village, Pune", notes: "Prefers cash payments, delivers early morning." },
    { id: "f-2", name: "Suresh Patil", mobile: "9823456789", address: "Vani, Nashik", notes: "Provides high quality onion and tomato batches." },
    { id: "f-3", name: "Vikas Patil", mobile: "9812345678", address: "Kagal, Kolhapur", notes: "Standard quality potato and leafy greens." }
  ],
  customers: [
    { id: "c-1", name: "Amit Gupta", mobile: "9988776655", address: "Market Yard, Pune", businessName: "Gupta Veg Wholsale" },
    { id: "c-2", name: "Sunita Sharma", mobile: "8877665544", address: "Vashi Metro Market, Mumbai", businessName: "Golden Fresh Vegetables" },
    { id: "c-3", name: "Rajesh Kulkarni", mobile: "7766554433", address: "Satara Road, Satara", businessName: "Kulkarni Traders" }
  ],
  vegetables: [
    { id: "v-1", farmerId: "f-1", farmerName: "Ramesh Kumar (Bhendi specialist)", vegetableName: "Bhendi", quality: "Premium", quantity: 120, purchasePrice: 40, sellingPrice: 60, dateAdded: "2026-06-22T06:00:00.000Z" },
    { id: "v-2", farmerId: "f-3", farmerName: "Vikas Patil", vegetableName: "Bhendi", quality: "Standard", quantity: 80, purchasePrice: 30, sellingPrice: 48, dateAdded: "2026-06-22T06:15:00.000Z" },
    { id: "v-3", farmerId: "f-2", farmerName: "Suresh Patil", vegetableName: "Tomato", quality: "Premium", quantity: 180, purchasePrice: 20, sellingPrice: 35, dateAdded: "2026-06-22T06:30:00.000Z" },
    { id: "v-4", farmerId: "f-2", farmerName: "Suresh Patil", vegetableName: "Onion", quality: "Premium", quantity: 250, purchasePrice: 18, sellingPrice: 32, dateAdded: "2026-06-22T06:45:00.000Z" },
    { id: "v-5", farmerId: "f-3", farmerName: "Vikas Patil", vegetableName: "Potato", quality: "Standard", quantity: 300, purchasePrice: 15, sellingPrice: 26, dateAdded: "2026-06-22T07:00:00.000Z" }
  ],
  invoices: [
    {
      id: "inv-1",
      invoiceNumber: "MM-2026-0001",
      customerId: "c-1",
      customerName: "Amit Gupta",
      customerMobile: "9988776655",
      customerBusiness: "Gupta Veg Wholsale",
      items: [
        { farmerId: "f-1", farmerName: "Ramesh Kumar (Bhendi specialist)", vegetableId: "v-1", vegetableName: "Bhendi", quality: "Premium", quantity: 50, rate: 60, purchasePrice: 40, amount: 3000 },
        { farmerId: "f-2", farmerName: "Suresh Patil", vegetableId: "v-3", vegetableName: "Tomato", quality: "Premium", quantity: 40, rate: 35, purchasePrice: 20, amount: 1400 }
      ],
      subtotal: 4400,
      gst: 220, // 5% GST
      total: 4620,
      amountPaid: 4620,
      amountPending: 0,
      paymentMethod: "Online",
      paymentStatus: "Paid",
      createdAt: "2026-06-22T08:10:00.000Z"
    },
    {
      id: "inv-2",
      invoiceNumber: "MM-2026-0002",
      customerId: "c-2",
      customerName: "Sunita Sharma",
      customerMobile: "8877665544",
      customerBusiness: "Golden Fresh Vegetables",
      items: [
        { farmerId: "f-2", farmerName: "Suresh Patil", vegetableId: "v-4", vegetableName: "Onion", quality: "Premium", quantity: 100, rate: 32, purchasePrice: 18, amount: 3200 },
        { farmerId: "f-3", farmerName: "Vikas Patil", vegetableId: "v-5", vegetableName: "Potato", quality: "Standard", quantity: 80, rate: 26, purchasePrice: 15, amount: 2080 }
      ],
      subtotal: 5280,
      gst: 264, // 5% GST
      total: 5544,
      amountPaid: 3000,
      amountPending: 2544,
      paymentMethod: "Partial Payment",
      paymentStatus: "Partial",
      createdAt: "2026-06-22T08:35:00.000Z"
    },
    {
      id: "inv-3",
      invoiceNumber: "MM-2026-0003",
      customerId: "c-1",
      customerName: "Amit Gupta",
      customerMobile: "9988776655",
      customerBusiness: "Gupta Veg Wholsale",
      items: [
        { farmerId: "f-1", farmerName: "Ramesh Kumar (Bhendi specialist)", vegetableId: "v-2", vegetableName: "Bhendi", quality: "Standard", quantity: 30, rate: 48, purchasePrice: 30, amount: 1440 }
      ],
      subtotal: 1440,
      gst: 72,
      total: 1512,
      amountPaid: 1512,
      amountPending: 0,
      paymentMethod: "Cash",
      paymentStatus: "Paid",
      createdAt: "2026-06-21T15:30:00.000Z"
    }
  ],
  payments: [
    { id: "p-1", invoiceId: "inv-1", invoiceNumber: "MM-2026-0001", customerName: "Amit Gupta", amount: 4620, paymentMethod: "Online", status: "Completed", createdAt: "2026-06-22T08:10:00.000Z" },
    { id: "p-2", invoiceId: "inv-2", invoiceNumber: "MM-2026-0002", customerName: "Sunita Sharma", amount: 3000, paymentMethod: "Partial Payment", status: "Completed", createdAt: "2026-06-22T08:35:00.000Z" },
    { id: "p-3", invoiceId: "inv-3", invoiceNumber: "MM-2026-0003", customerName: "Amit Gupta", amount: 1512, paymentMethod: "Cash", status: "Completed", createdAt: "2026-06-21T15:30:00.000Z" }
  ],
  users: []
};

let mongoClient: MongoClient | null = null;
let mongoDb: any = null;
let connectPromise: Promise<any> | null = null;

async function getMongoDB() {
  if (mongoDb) return mongoDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("MONGODB_URI is missing");
    return null;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    try {
      console.log("Connecting to MongoDB Atlas...");
      const client = new MongoClient(uri, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      mongoClient = client;
      mongoDb = client.db();
      console.log("✅ Successfully connected to MongoDB Atlas!");
      return mongoDb;
    } catch (error) {
      console.error("❌ MongoDB Connection Error:", error);
      connectPromise = null; // Let it retry next time
      return null;
    }
  })();

  return connectPromise;
}

// Helper functions for dynamic translations caching

async function translateFarmerDoc(farmer: any, lang: string): Promise<Farmer> {
  if (lang === "en" || !lang) {
    const { translations, _id, ...rest } = farmer;
    return rest;
  }

  if (farmer.translations?.[lang]) {
    const tData = farmer.translations[lang];
    const { translations, _id, ...rest } = farmer;
    return {
      ...rest,
      name: tData.name || farmer.name,
      address: tData.address || farmer.address,
      notes: tData.notes || farmer.notes,
    };
  }

  try {
    const translated = await translateFields({
      name: farmer.name,
      address: farmer.address || "",
      notes: farmer.notes || ""
    }, lang);

    const db = await getMongoDB();
    if (db) {
      const updateField = `translations.${lang}`;
      await db.collection("farmers").updateOne(
        { id: farmer.id },
        { $set: { [updateField]: translated } }
      );
    }

    const { translations, _id, ...rest } = farmer;
    return {
      ...rest,
      name: translated.name || farmer.name,
      address: translated.address || farmer.address,
      notes: translated.notes || farmer.notes,
    };
  } catch (err) {
    console.error("Failed to dynamically translate farmer:", err);
    const { translations, _id, ...rest } = farmer;
    return rest;
  }
}

async function translateCustomerDoc(customer: any, lang: string): Promise<Customer> {
  if (lang === "en" || !lang) {
    const { translations, _id, ...rest } = customer;
    return rest;
  }

  if (customer.translations?.[lang]) {
    const tData = customer.translations[lang];
    const { translations, _id, ...rest } = customer;
    return {
      ...rest,
      name: tData.name || customer.name,
      address: tData.address || customer.address,
      businessName: tData.businessName || customer.businessName,
    };
  }

  try {
    const translated = await translateFields({
      name: customer.name,
      address: customer.address || "",
      businessName: customer.businessName || ""
    }, lang);

    const db = await getMongoDB();
    if (db) {
      const updateField = `translations.${lang}`;
      await db.collection("customers").updateOne(
        { id: customer.id },
        { $set: { [updateField]: translated } }
      );
    }

    const { translations, _id, ...rest } = customer;
    return {
      ...rest,
      name: translated.name || customer.name,
      address: translated.address || customer.address,
      businessName: translated.businessName || customer.businessName,
    };
  } catch (err) {
    console.error("Failed to dynamically translate customer:", err);
    const { translations, _id, ...rest } = customer;
    return rest;
  }
}

async function translateVegetableDoc(veg: any, lang: string): Promise<Vegetable> {
  if (lang === "en" || !lang) {
    const { translations, _id, ...rest } = veg;
    return rest;
  }

  if (veg.translations?.[lang]) {
    const tData = veg.translations[lang];
    const { translations, _id, ...rest } = veg;
    return {
      ...rest,
      farmerName: tData.farmerName || veg.farmerName,
      vegetableName: tData.vegetableName || veg.vegetableName,
      quality: tData.quality || veg.quality,
    };
  }

  try {
    const translated = await translateFields({
      farmerName: veg.farmerName,
      vegetableName: veg.vegetableName,
      quality: veg.quality
    }, lang);

    const db = await getMongoDB();
    if (db) {
      const updateField = `translations.${lang}`;
      await db.collection("vegetables").updateOne(
        { id: veg.id },
        { $set: { [updateField]: translated } }
      );
    }

    const { translations, _id, ...rest } = veg;
    return {
      ...rest,
      farmerName: translated.farmerName || veg.farmerName,
      vegetableName: translated.vegetableName || veg.vegetableName,
      quality: translated.quality || veg.quality,
    };
  } catch (err) {
    console.error("Failed to dynamically translate vegetable:", err);
    const { translations, _id, ...rest } = veg;
    return rest;
  }
}

async function translateInvoiceDoc(inv: any, lang: string): Promise<Invoice> {
  if (lang === "en" || !lang) {
    const { translations, _id, ...rest } = inv;
    return rest;
  }

  if (inv.translations?.[lang]) {
    const tData = inv.translations[lang];
    const { translations, _id, ...rest } = inv;
    const translatedItems = inv.items.map((item: any, idx: number) => {
      const tItem = tData.items?.[idx] || {};
      return {
        ...item,
        farmerName: tItem.farmerName || item.farmerName,
        vegetableName: tItem.vegetableName || item.vegetableName,
        quality: tItem.quality || item.quality,
      };
    });

    return {
      ...rest,
      customerName: tData.customerName || inv.customerName,
      customerBusiness: tData.customerBusiness || inv.customerBusiness,
      items: translatedItems,
    };
  }

  try {
    const fieldsToTranslate: Record<string, string> = {
      customerName: inv.customerName,
      customerBusiness: inv.customerBusiness || ""
    };

    inv.items.forEach((item: any, idx: number) => {
      fieldsToTranslate[`item_${idx}_farmerName`] = item.farmerName;
      fieldsToTranslate[`item_${idx}_vegetableName`] = item.vegetableName;
      fieldsToTranslate[`item_${idx}_quality`] = item.quality;
    });

    const translated = await translateFields(fieldsToTranslate, lang);

    const tItems = inv.items.map((item: any, idx: number) => ({
      farmerName: translated[`item_${idx}_farmerName`] || item.farmerName,
      vegetableName: translated[`item_${idx}_vegetableName`] || item.vegetableName,
      quality: translated[`item_${idx}_quality`] || item.quality,
    }));

    const translationPayload = {
      customerName: translated.customerName || inv.customerName,
      customerBusiness: translated.customerBusiness || inv.customerBusiness,
      items: tItems,
    };

    const db = await getMongoDB();
    if (db) {
      const updateField = `translations.${lang}`;
      await db.collection("invoices").updateOne(
        { id: inv.id },
        { $set: { [updateField]: translationPayload } }
      );
    }

    const { translations, _id, ...rest } = inv;
    const translatedItems = inv.items.map((item: any, idx: number) => {
      const tItem = tItems[idx] || {};
      return {
        ...item,
        farmerName: tItem.farmerName || item.farmerName,
        vegetableName: tItem.vegetableName || item.vegetableName,
        quality: tItem.quality || item.quality,
      };
    });

    return {
      ...rest,
      customerName: translationPayload.customerName,
      customerBusiness: translationPayload.customerBusiness,
      items: translatedItems,
    };
  } catch (err) {
    console.error("Failed to dynamically translate invoice:", err);
    const { translations, _id, ...rest } = inv;
    return rest;
  }
}

async function translatePaymentLogDoc(p: any, lang: string): Promise<PaymentLog> {
  if (lang === "en" || !lang) {
    const { translations, _id, ...rest } = p;
    return rest;
  }

  if (p.translations?.[lang]) {
    const tData = p.translations[lang];
    const { translations, _id, ...rest } = p;
    return {
      ...rest,
      customerName: tData.customerName || p.customerName,
    };
  }

  try {
    const translated = await translateFields({ customerName: p.customerName }, lang);

    const db = await getMongoDB();
    if (db) {
      const updateField = `translations.${lang}`;
      await db.collection("payments").updateOne(
        { id: p.id },
        { $set: { [updateField]: translated } }
      );
    }

    const { translations, _id, ...rest } = p;
    return {
      ...rest,
      customerName: translated.customerName || p.customerName,
    };
  } catch (err) {
    console.error("Failed to dynamically translate payment log:", err);
    const { translations, _id, ...rest } = p;
    return rest;
  }
}

async function syncCustomers(db: any): Promise<void> {
  if (!db) return;
  try {
    const customers = await db.collection("customers").find({}).toArray();
    const invoices = await db.collection("invoices").find({}).toArray();

    // Map customer ID to their total pending amount and save their details
    const pendingAmounts: Record<string, number> = {};
    const customerDetails: Record<string, { name: string; mobile: string; businessName: string }> = {};

    invoices.forEach((inv: any) => {
      const cId = inv.customerId;
      if (inv.amountPending > 0) {
        pendingAmounts[cId] = (pendingAmounts[cId] || 0) + inv.amountPending;
        customerDetails[cId] = {
          name: inv.customerName || "Walk-in Customer",
          mobile: inv.customerMobile || "",
          businessName: inv.customerBusiness || ""
        };
      }
    });

    // Find customers with total pending <= 0 and delete them
    const toDelete = customers.filter((c: any) => !pendingAmounts[c.id] || pendingAmounts[c.id] <= 0);
    const remainingCustomerIds = new Set<string>(customers.map((c: any) => c.id));

    if (toDelete.length > 0) {
      const idsToDelete = toDelete.map((c: any) => c.id);
      await db.collection("customers").deleteMany({ id: { $in: idsToDelete } });
      console.log(`[syncCustomers] Deleted ${toDelete.length} customers who have no outstanding pending invoices.`);
      idsToDelete.forEach(id => remainingCustomerIds.delete(id));
    }

    // Auto-create customer records for any customer with a pending balance who is not yet in the customers collection
    const newCustomersToInsert: any[] = [];
    Object.keys(pendingAmounts).forEach(cId => {
      if (!remainingCustomerIds.has(cId)) {
        const details = customerDetails[cId];
        newCustomersToInsert.push({
          id: cId,
          name: details.name,
          mobile: details.mobile,
          address: "",
          businessName: details.businessName,
          translations: {}
        });
      }
    });

    if (newCustomersToInsert.length > 0) {
      await db.collection("customers").insertMany(newCustomersToInsert);
      console.log(`[syncCustomers] Auto-registered ${newCustomersToInsert.length} new customers with outstanding balances.`);
    }
  } catch (err) {
    console.error("Error during syncCustomers:", err);
  }
}

class DBManager {
  constructor() {
    this.initMongoDB();
  }

  async initMongoDB() {
    const db = await getMongoDB();
    if (!db) {
      console.log("MONGODB_URI is not set or server couldn't connect. Operating in offline/file mode.");
      return;
    }

    try {
      const farmersColl = db.collection("farmers");
      const customersColl = db.collection("customers");
      const vegetablesColl = db.collection("vegetables");
      const invoicesColl = db.collection("invoices");
      const paymentsColl = db.collection("payments");
      const usersColl = db.collection("users");

      // Drop legacy username unique index if it exists — prevents duplicate key
      // errors when inserting new users that don't have a username field.
      try {
        await usersColl.dropIndex("username_1");
        console.log("✅ Dropped legacy username_1 index from users collection.");
      } catch (_) {
        // Index doesn't exist — that's fine, nothing to do.
      }

      try {
        await usersColl.dropIndex("storeId_1_username_1");
        console.log("✅ Dropped legacy storeId_1_username_1 index from users collection.");
      } catch (_) {
        // Index doesn't exist — that's fine, nothing to do.
      }

      const [farmers, customers, vegetables, invoices, payments, users] = await Promise.all([
        farmersColl.find({}).toArray(),
        customersColl.find({}).toArray(),
        vegetablesColl.find({}).toArray(),
        invoicesColl.find({}).toArray(),
        paymentsColl.find({}).toArray(),
        usersColl.find({}).toArray()
      ]);

      const totalCount = farmers.length + customers.length + vegetables.length + invoices.length + payments.length + users.length;
      
      if (totalCount === 0) {
        console.log("MongoDB Atlas database is empty. Seeding with default data...");
        await Promise.all([
          DEFAULT_DB.farmers.length > 0 ? farmersColl.insertMany(DEFAULT_DB.farmers) : Promise.resolve(),
          DEFAULT_DB.customers.length > 0 ? customersColl.insertMany(DEFAULT_DB.customers) : Promise.resolve(),
          DEFAULT_DB.vegetables.length > 0 ? vegetablesColl.insertMany(DEFAULT_DB.vegetables) : Promise.resolve(),
          DEFAULT_DB.invoices.length > 0 ? invoicesColl.insertMany(DEFAULT_DB.invoices) : Promise.resolve(),
          DEFAULT_DB.payments.length > 0 ? paymentsColl.insertMany(DEFAULT_DB.payments) : Promise.resolve(),
          DEFAULT_DB.users.length > 0 ? usersColl.insertMany(DEFAULT_DB.users) : Promise.resolve()
        ]);
        console.log("MongoDB Atlas seeded successfully.");
      }
      
      // Ensure owner account
      const hasOwner = await usersColl.findOne({ role: "Owner" });
      if (!hasOwner) {
        const hashedPassword = bcrypt.hashSync("owner123", 10);
        const defaultOwner: User = {
          id: "u-owner",
          name: "Owner",
          email: "owner@mandimate.com",
          password: hashedPassword,
          role: "Owner",
          isDisabled: false
        };
        await usersColl.insertOne(defaultOwner);
        console.log("Default owner account created in MongoDB: owner@mandimate.com / owner123");
      }
      await syncCustomers(db);
    } catch (e) {
      console.error("Error synchronizing with MongoDB Atlas on startup:", e);
    }
  }

  // Farmers
  async getFarmers(lang = "en"): Promise<Farmer[]> {
    const db = await getMongoDB();
    if (!db) return [];
    const farmers = await db.collection("farmers").find({}).toArray();
    return Promise.all(farmers.map(f => translateFarmerDoc(f, lang)));
  }

  async addFarmer(farmer: Omit<Farmer, "id">): Promise<Farmer> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    const id = `f-${Date.now()}`;

    // Pre-populate translations
    const translations: Record<string, any> = {};
    try {
      const [mrTrans, hiTrans] = await Promise.all([
        translateFields({
          name: farmer.name,
          address: farmer.address || "",
          notes: farmer.notes || ""
        }, "mr").catch(() => ({})),
        translateFields({
          name: farmer.name,
          address: farmer.address || "",
          notes: farmer.notes || ""
        }, "hi").catch(() => ({}))
      ]) as [any, any];
      if (Object.keys(mrTrans).length > 0) translations.mr = mrTrans;
      if (Object.keys(hiTrans).length > 0) translations.hi = hiTrans;
    } catch (e) {
      console.error("Pre-translating new farmer failed:", e);
    }

    const newFarmer = { id, ...farmer, translations };
    await db.collection("farmers").insertOne(newFarmer);
    const { _id, ...cleanFarmer } = newFarmer as any;
    return cleanFarmer as Farmer;
  }

  async updateFarmer(id: string, updatedFarmer: Omit<Farmer, "id">): Promise<Farmer | null> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");

    // Re-generate translations
    const translations: Record<string, any> = {};
    try {
      const [mrTrans, hiTrans] = await Promise.all([
        translateFields({
          name: updatedFarmer.name,
          address: updatedFarmer.address || "",
          notes: updatedFarmer.notes || ""
        }, "mr").catch(() => ({})),
        translateFields({
          name: updatedFarmer.name,
          address: updatedFarmer.address || "",
          notes: updatedFarmer.notes || ""
        }, "hi").catch(() => ({}))
      ]) as [any, any];
      if (Object.keys(mrTrans).length > 0) translations.mr = mrTrans;
      if (Object.keys(hiTrans).length > 0) translations.hi = hiTrans;
    } catch (e) {
      console.error("Pre-translating updated farmer failed:", e);
    }

    const updateResult = await db.collection("farmers").updateOne({ id }, { $set: { ...updatedFarmer, translations } });
    if (updateResult.matchedCount === 0) return null;
    return { id, ...updatedFarmer, translations };
  }

  async deleteFarmer(id: string): Promise<boolean> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    const result = await db.collection("farmers").deleteOne({ id });
    return (result.deletedCount ?? 0) > 0;
  }

  // Customers
  async getCustomers(lang = "en"): Promise<Customer[]> {
    const db = await getMongoDB();
    if (!db) return [];
    await syncCustomers(db);
    const customers = await db.collection("customers").find({}).toArray();
    const invoices = await db.collection("invoices").find({}).toArray();
    const pendingAmounts: Record<string, number> = {};
    invoices.forEach((inv: any) => {
      if (inv.amountPending > 0) {
        pendingAmounts[inv.customerId] = (pendingAmounts[inv.customerId] || 0) + inv.amountPending;
      }
    });
    return Promise.all(customers.map(async c => {
      const translated = await translateCustomerDoc(c, lang);
      return {
        ...translated,
        remainingAmount: pendingAmounts[c.id] || 0
      };
    }));
  }

  async addCustomer(customer: Omit<Customer, "id">): Promise<Customer> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    const id = `c-${Date.now()}`;

    // Pre-populate translations
    const translations: Record<string, any> = {};
    try {
      const [mrTrans, hiTrans] = await Promise.all([
        translateFields({
          name: customer.name,
          address: customer.address || "",
          businessName: customer.businessName || ""
        }, "mr").catch(() => ({})),
        translateFields({
          name: customer.name,
          address: customer.address || "",
          businessName: customer.businessName || ""
        }, "hi").catch(() => ({}))
      ]) as [any, any];
      if (Object.keys(mrTrans).length > 0) translations.mr = mrTrans;
      if (Object.keys(hiTrans).length > 0) translations.hi = hiTrans;
    } catch (e) {
      console.error("Pre-translating new customer failed:", e);
    }

    const newCustomer = { id, ...customer, translations };
    await db.collection("customers").insertOne(newCustomer);
    const { _id, ...cleanCustomer } = newCustomer as any;
    return cleanCustomer as Customer;
  }

  async updateCustomer(id: string, updatedCustomer: Omit<Customer, "id">): Promise<Customer | null> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");

    // Re-generate translations
    const translations: Record<string, any> = {};
    try {
      const [mrTrans, hiTrans] = await Promise.all([
        translateFields({
          name: updatedCustomer.name,
          address: updatedCustomer.address || "",
          businessName: updatedCustomer.businessName || ""
        }, "mr").catch(() => ({})),
        translateFields({
          name: updatedCustomer.name,
          address: updatedCustomer.address || "",
          businessName: updatedCustomer.businessName || ""
        }, "hi").catch(() => ({}))
      ]) as [any, any];
      if (Object.keys(mrTrans).length > 0) translations.mr = mrTrans;
      if (Object.keys(hiTrans).length > 0) translations.hi = hiTrans;
    } catch (e) {
      console.error("Pre-translating updated customer failed:", e);
    }

    const updateResult = await db.collection("customers").updateOne({ id }, { $set: { ...updatedCustomer, translations } });
    if (updateResult.matchedCount === 0) return null;
    return { id, ...updatedCustomer, translations };
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    const result = await db.collection("customers").deleteOne({ id });
    return (result.deletedCount ?? 0) > 0;
  }

  // Vegetables/Inventory
  async getVegetables(lang = "en"): Promise<Vegetable[]> {
    const db = await getMongoDB();
    if (!db) return [];
    const vegetables = await db.collection("vegetables").find({}).toArray();
    return Promise.all(vegetables.map(v => translateVegetableDoc(v, lang)));
  }

  async addVegetable(veg: Omit<Vegetable, "id" | "dateAdded"> & { dateAdded?: string }): Promise<Vegetable> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    const id = `v-${Date.now()}`;

    // Pre-populate translations
    const translations: Record<string, any> = {};
    try {
      const [mrTrans, hiTrans] = await Promise.all([
        translateFields({
          farmerName: veg.farmerName,
          vegetableName: veg.vegetableName,
          quality: veg.quality
        }, "mr").catch(() => ({})),
        translateFields({
          farmerName: veg.farmerName,
          vegetableName: veg.vegetableName,
          quality: veg.quality
        }, "hi").catch(() => ({}))
      ]) as [any, any];
      if (Object.keys(mrTrans).length > 0) translations.mr = mrTrans;
      if (Object.keys(hiTrans).length > 0) translations.hi = hiTrans;
    } catch (e) {
      console.error("Pre-translating new vegetable failed:", e);
    }

    const newVeg: Vegetable = {
      id,
      ...veg,
      dateAdded: veg.dateAdded || new Date().toISOString(),
      translations
    } as any;
    await db.collection("vegetables").insertOne(newVeg);
    const { _id, ...cleanVeg } = newVeg as any;
    return cleanVeg as Vegetable;
  }

  async updateVegetable(id: string, veg: Omit<Vegetable, "id" | "dateAdded"> & { dateAdded?: string }): Promise<Vegetable | null> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    const currentVeg = await db.collection("vegetables").findOne({ id });
    if (!currentVeg) return null;

    // Re-generate translations
    const translations: Record<string, any> = {};
    try {
      const [mrTrans, hiTrans] = await Promise.all([
        translateFields({
          farmerName: veg.farmerName || currentVeg.farmerName,
          vegetableName: veg.vegetableName || currentVeg.vegetableName,
          quality: veg.quality || currentVeg.quality
        }, "mr").catch(() => ({})),
        translateFields({
          farmerName: veg.farmerName || currentVeg.farmerName,
          vegetableName: veg.vegetableName || currentVeg.vegetableName,
          quality: veg.quality || currentVeg.quality
        }, "hi").catch(() => ({}))
      ]) as [any, any];
      if (Object.keys(mrTrans).length > 0) translations.mr = mrTrans;
      if (Object.keys(hiTrans).length > 0) translations.hi = hiTrans;
    } catch (e) {
      console.error("Pre-translating updated vegetable failed:", e);
    }

    const updated = {
      ...currentVeg,
      ...veg,
      translations
    };
    delete (updated as any)._id;
    await db.collection("vegetables").updateOne({ id }, { $set: updated });
    return updated as Vegetable;
  }

  async deleteVegetable(id: string): Promise<boolean> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    const result = await db.collection("vegetables").deleteOne({ id });
    return (result.deletedCount ?? 0) > 0;
  }

  // Invoices & Sales
  async getInvoices(lang = "en"): Promise<Invoice[]> {
    const db = await getMongoDB();
    if (!db) return [];
    const invoices = await db.collection("invoices").find({}).toArray();
    return Promise.all(invoices.map(inv => translateInvoiceDoc(inv, lang)));
  }

  async createInvoice(invoiceData: Omit<Invoice, "id" | "invoiceNumber" | "createdAt">): Promise<Invoice> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    const id = `inv-${Date.now()}`;
    const year = new Date().getFullYear();
    const count = await db.collection("invoices").countDocuments({});
    const padded = String(count + 1).padStart(4, "0");
    const invoiceNumber = `MM-${year}-${padded}`;

    // Pre-populate translations
    const translations: Record<string, any> = {};
    try {
      const fieldsToTranslate: Record<string, string> = {
        customerName: invoiceData.customerName,
        customerBusiness: invoiceData.customerBusiness || ""
      };
      invoiceData.items.forEach((item: any, idx: number) => {
        fieldsToTranslate[`item_${idx}_farmerName`] = item.farmerName;
        fieldsToTranslate[`item_${idx}_vegetableName`] = item.vegetableName;
        fieldsToTranslate[`item_${idx}_quality`] = item.quality;
      });

      const [mrTransRaw, hiTransRaw] = await Promise.all([
        translateFields(fieldsToTranslate, "mr").catch(() => ({})),
        translateFields(fieldsToTranslate, "hi").catch(() => ({}))
      ]) as [any, any];

      if (Object.keys(mrTransRaw).length > 0) {
        translations.mr = {
          customerName: mrTransRaw.customerName || invoiceData.customerName,
          customerBusiness: mrTransRaw.customerBusiness || invoiceData.customerBusiness,
          items: invoiceData.items.map((item: any, idx: number) => ({
            farmerName: mrTransRaw[`item_${idx}_farmerName`] || item.farmerName,
            vegetableName: mrTransRaw[`item_${idx}_vegetableName`] || item.vegetableName,
            quality: mrTransRaw[`item_${idx}_quality`] || item.quality,
          }))
        };
      }

      if (Object.keys(hiTransRaw).length > 0) {
        translations.hi = {
          customerName: hiTransRaw.customerName || invoiceData.customerName,
          customerBusiness: hiTransRaw.customerBusiness || invoiceData.customerBusiness,
          items: invoiceData.items.map((item: any, idx: number) => ({
            farmerName: hiTransRaw[`item_${idx}_farmerName`] || item.farmerName,
            vegetableName: hiTransRaw[`item_${idx}_vegetableName`] || item.vegetableName,
            quality: hiTransRaw[`item_${idx}_quality`] || item.quality,
          }))
        };
      }
    } catch (e) {
      console.error("Pre-translating new invoice failed:", e);
    }

    const newInvoice: Invoice = {
      id,
      invoiceNumber,
      ...invoiceData,
      createdAt: new Date().toISOString(),
      translations
    } as any;

    // Decrement quantities in vegetables collection
    for (const item of newInvoice.items) {
      const veg = await db.collection("vegetables").findOne({ id: item.vegetableId });
      if (veg) {
        const newQty = Math.max(0, veg.quantity - item.quantity);
        const newBags = veg.bags !== undefined ? Math.max(0, veg.bags - (item.bags || 0)) : undefined;
        const updateDoc: Record<string, any> = { quantity: newQty };
        if (newBags !== undefined) {
          updateDoc.bags = newBags;
        }
        await db.collection("vegetables").updateOne({ id: veg.id }, { $set: updateDoc });
      }
    }

    await db.collection("invoices").insertOne(newInvoice);

    // Record payment if amountPaid > 0
    if (newInvoice.amountPaid > 0) {
      const pid = `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const pTranslations: Record<string, any> = {};
      if (translations.mr?.customerName) pTranslations.mr = { customerName: translations.mr.customerName };
      if (translations.hi?.customerName) pTranslations.hi = { customerName: translations.hi.customerName };

      const newPayment = {
        id: pid,
        invoiceId: id,
        invoiceNumber,
        customerName: newInvoice.customerName,
        amount: newInvoice.amountPaid,
        paymentMethod: newInvoice.paymentMethod,
        status: "Completed",
        createdAt: newInvoice.createdAt,
        translations: pTranslations
      };
      await db.collection("payments").insertOne(newPayment);
    }

    await syncCustomers(db);

    const { _id, ...cleanInvoice } = newInvoice as any;
    return cleanInvoice as Invoice;
  }

  // Payments
  async getPayments(lang = "en"): Promise<PaymentLog[]> {
    const db = await getMongoDB();
    if (!db) return [];
    const payments = await db.collection("payments").find({}).toArray();
    return Promise.all(payments.map(p => translatePaymentLogDoc(p, lang)));
  }

  async recordPayment(invoiceId: string, amount: number, paymentMethod: string): Promise<{ invoice: Invoice; log: PaymentLog } | null> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");

    const invoice = await db.collection("invoices").findOne({ id: invoiceId });
    if (!invoice) return null;

    const newPaid = invoice.amountPaid + amount;
    const amountPaid = Math.min(invoice.total, newPaid);
    const amountPending = Math.max(0, invoice.total - amountPaid);

    let paymentStatus: PaymentStatus = "Unpaid";
    if (amountPending === 0) {
      paymentStatus = "Paid";
    } else if (amountPaid > 0) {
      paymentStatus = "Partial";
    }

    const updatedInvoice = {
      ...invoice,
      amountPaid,
      amountPending,
      paymentStatus
    };
    delete (updatedInvoice as any)._id;

    await db.collection("invoices").updateOne({ id: invoiceId }, { $set: updatedInvoice });

    const pid = `p-${Date.now()}`;
    const pTranslations: Record<string, any> = {};
    if (invoice.translations?.mr?.customerName) pTranslations.mr = { customerName: invoice.translations.mr.customerName };
    if (invoice.translations?.hi?.customerName) pTranslations.hi = { customerName: invoice.translations.hi.customerName };

    const log: PaymentLog = {
      id: pid,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      amount,
      paymentMethod,
      status: "Completed",
      createdAt: new Date().toISOString(),
      translations: pTranslations
    } as any;
    await db.collection("payments").insertOne(log);

    await syncCustomers(db);

    const { _id: _, ...cleanLog } = log as any;
    return { invoice: updatedInvoice as Invoice, log: cleanLog as PaymentLog };
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | null> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");

    const invoice = await db.collection("invoices").findOne({ id });
    if (!invoice) return null;

    // Check if we need to update translations for updated top-level customerName/business
    let translations = invoice.translations || {};
    if (updates.customerName !== undefined || updates.customerBusiness !== undefined) {
      const customerName = updates.customerName !== undefined ? updates.customerName : invoice.customerName;
      const customerBusiness = updates.customerBusiness !== undefined ? updates.customerBusiness : invoice.customerBusiness;
      try {
        const [mrTrans, hiTrans] = await Promise.all([
          translateFields({ customerName, customerBusiness: customerBusiness || "" }, "mr").catch(() => ({})),
          translateFields({ customerName, customerBusiness: customerBusiness || "" }, "hi").catch(() => ({}))
        ]) as [any, any];
        translations = {
          ...translations,
          mr: { ...(translations.mr || {}), ...mrTrans },
          hi: { ...(translations.hi || {}), ...hiTrans }
        };
      } catch (e) {
        console.error("Updating invoice translation failed:", e);
      }
    }

    const updatedInvoice = {
      ...invoice,
      ...updates,
      translations
    };
    delete (updatedInvoice as any)._id;

    await db.collection("invoices").updateOne({ id }, { $set: updatedInvoice });

    if (updates.customerName) {
      const pUpdate: Record<string, any> = { customerName: updates.customerName };
      if (translations.mr?.customerName) pUpdate["translations.mr.customerName"] = translations.mr.customerName;
      if (translations.hi?.customerName) pUpdate["translations.hi.customerName"] = translations.hi.customerName;

      await db.collection("payments").updateMany(
        { invoiceId: id },
        { $set: pUpdate }
      );
    }

    await syncCustomers(db);

    return updatedInvoice as Invoice;
  }

  // Dashboard Stats
  async getDashboardStats(lang = "en", dateStr?: string) {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");

    // Retrieve documents mapped to the target language
    const [invoicesRaw, paymentsRaw] = await Promise.all([
      db.collection("invoices").find({}).toArray(),
      db.collection("payments").find({}).toArray()
    ]);

    const [invoices, payments] = await Promise.all([
      Promise.all(invoicesRaw.map(inv => translateInvoiceDoc(inv, lang))),
      Promise.all(paymentsRaw.map(p => translatePaymentLogDoc(p, lang)))
    ]);

    const targetDateStr = dateStr || new Date().toISOString().slice(0, 10);

    const todayInvoices = invoices.filter((inv: any) => 
      inv.createdAt.startsWith(targetDateStr)
    );

    let revenueToday = 0;
    let profitToday = 0;
    let weightToday = 0;
    const transactionsToday = todayInvoices.length;

    const todayCustIds = new Set<string>();

    todayInvoices.forEach((inv: any) => {
      revenueToday += inv.total;
      todayCustIds.add(inv.customerId);

      inv.items.forEach((item: any) => {
        weightToday += item.quantity;
        const purchaseCost = item.quantity * item.purchasePrice;
        const sellingRev = item.amount;
        profitToday += (sellingRev - purchaseCost);
      });
    });

    let cashReceived = 0;
    let onlineReceived = 0;
    let pendingPayments = 0;

    const todayPayments = payments.filter((p: any) => p.createdAt.startsWith(targetDateStr));
    todayPayments.forEach((p: any) => {
      if ((p.paymentMethod || "").toLowerCase().includes("cash")) {
        cashReceived += p.amount;
      } else {
        onlineReceived += p.amount;
      }
    });

    todayInvoices.forEach((inv: any) => {
      pendingPayments += inv.amountPending;
    });

    const vegSalesMap: Record<string, { quantity: number; revenue: number; profit: number }> = {};
    
    todayInvoices.forEach((inv: any) => {
      inv.items.forEach((item: any) => {
        const name = item.vegetableName;
        const profit = item.amount - (item.quantity * item.purchasePrice);
        if (!vegSalesMap[name]) {
          vegSalesMap[name] = { quantity: 0, revenue: 0, profit: 0 };
        }
        vegSalesMap[name].quantity += item.quantity;
        vegSalesMap[name].revenue += item.amount;
        vegSalesMap[name].profit += profit;
      });
    });

    const topSellingVegetables = Object.entries(vegSalesMap).map(([name, d]) => ({
      name,
      ...d
    })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    const farmerReportMap: Record<string, { farmerName: string; vegetables: Set<string>; quantity: number; revenue: number; profit: number }> = {};
    
    todayInvoices.forEach((inv: any) => {
      inv.items.forEach((item: any) => {
        const fId = item.farmerId;
        const fName = item.farmerName;
        const profit = item.amount - (item.quantity * item.purchasePrice);
        
        if (!farmerReportMap[fId]) {
          farmerReportMap[fId] = {
            farmerName: fName,
            vegetables: new Set<string>(),
            quantity: 0,
            revenue: 0,
            profit: 0
          };
        }
        farmerReportMap[fId].vegetables.add(item.vegetableName);
        farmerReportMap[fId].quantity += item.quantity;
        farmerReportMap[fId].revenue += item.amount;
        farmerReportMap[fId].profit += profit;
      });
    });

    const farmerWiseReport = Object.entries(farmerReportMap).map(([farmerId, d]) => ({
      farmerId,
      farmerName: d.farmerName,
      vegetablesSupplied: Array.from(d.vegetables),
      quantitySold: d.quantity,
      revenueGenerated: d.revenue,
      profitGenerated: d.profit
    }));

    return {
      todaySales: {
        revenue: revenueToday,
        profit: profitToday,
        transactions: transactionsToday,
        quantity: weightToday
      },
      paymentBreakdown: {
        cashReceived,
        onlineReceived,
        pendingPayments
      },
      topSellingVegetables,
      farmerWiseReport,
      customersServedToday: todayCustIds.size
    };
  }

  // Users Management
  async getUsers(): Promise<User[]> {
    const db = await getMongoDB();
    if (!db) return [];
    const users = await db.collection("users").find({}).toArray();
    return users.map(({ _id, ...rest }) => {
      const id = rest.id || _id.toString();
      const name = rest.name || rest.username || "Unknown";
      const email = rest.email || rest.username || "no-email@mandimate.com";
      const role = (rest.role && rest.role.toLowerCase() === "owner") ? "Owner" : "Staff";
      const isDisabled = rest.isDisabled !== undefined ? rest.isDisabled : (rest.isActive === false);
      return {
        ...rest,
        id,
        name,
        email,
        role,
        isDisabled
      };
    }) as User[];
  }

  async addUser(user: Omit<User, "id">): Promise<User> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    const id = `u-${Date.now()}`;
    const newUser = { id, ...user };
    await db.collection("users").insertOne(newUser);
    const { _id, ...cleanUser } = newUser as any;
    return {
      ...cleanUser,
      id: cleanUser.id || _id.toString(),
      name: cleanUser.name || "Unknown",
      email: cleanUser.email || "no-email@mandimate.com",
      role: (cleanUser.role && cleanUser.role.toLowerCase() === "owner") ? "Owner" : "Staff",
      isDisabled: cleanUser.isDisabled !== undefined ? cleanUser.isDisabled : false
    } as User;
  }

  async updateUser(id: string, updatedUser: Partial<User>): Promise<User | null> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    
    let user = await db.collection("users").findOne({ id });
    if (!user && ObjectId.isValid(id)) {
      user = await db.collection("users").findOne({ _id: new ObjectId(id) });
    }
    if (!user) return null;
    
    const updated = {
      ...user,
      ...updatedUser
    };
    delete (updated as any)._id;
    
    if (user.id) {
      await db.collection("users").updateOne({ id }, { $set: updated });
    } else {
      await db.collection("users").updateOne({ _id: user._id }, { $set: updated });
    }
    
    return {
      ...updated,
      id: updated.id || user._id.toString(),
      name: updated.name || updated.username || "Unknown",
      email: updated.email || updated.username || "no-email@mandimate.com",
      role: (updated.role && updated.role.toLowerCase() === "owner") ? "Owner" : "Staff",
      isDisabled: updated.isDisabled !== undefined ? updated.isDisabled : (updated.isActive === false)
    } as User;
  }

  async deleteUser(id: string): Promise<boolean> {
    const db = await getMongoDB();
    if (!db) throw new Error("Database not connected");
    
    let result = await db.collection("users").deleteOne({ id });
    if ((result.deletedCount ?? 0) === 0 && ObjectId.isValid(id)) {
      result = await db.collection("users").deleteOne({ _id: new ObjectId(id) });
    }
    return (result.deletedCount ?? 0) > 0;
  }
}

export const dbManager = new DBManager();
