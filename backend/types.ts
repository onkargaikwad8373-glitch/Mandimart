export interface Farmer {
  id: string;
  name: string;
  mobile: string;
  address: string;
  notes?: string;
  translations?: any;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  address: string;
  businessName: string;
  translations?: any;
  remainingAmount?: number;
}

export interface Vegetable {
  id: string;
  farmerId: string;
  farmerName: string;
  vegetableName: string;
  quality: string; // Grade (e.g. Premium, Standard)
  quantity: number; // in Kg
  bags?: number;
  purchasePrice: number; // per Kg
  sellingPrice: number; // per Kg
  dateAdded: string; // ISO String
  imageUrl?: string;
  photoCapturedAt?: string;
  translations?: any;
}

export interface InvoiceItem {
  farmerId: string;
  farmerName: string;
  vegetableId: string;
  vegetableName: string;
  quality: string;
  quantity: number; // Sold quantity (Kg)
  bags?: number;
  rate: number; // Sell price per Kg
  purchasePrice: number; // Purchase price per Kg (for profit calc)
  amount: number; // quantity * rate
}

export type PaymentMethod = "Cash" | "Online" | "Partial Payment" | "Pending Payment";
export type PaymentStatus = "Paid" | "Unpaid" | "Partial";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerBusiness?: string;
  items: InvoiceItem[];
  subtotal: number;
  gst: number; // GST Amount
  total: number; // Grand Total
  amountPaid: number;
  amountPending: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string; // date string
  translations?: any;
}

export interface PaymentLog {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  translations?: any;
}

// Stats interface for Dashboard
export interface DashboardStats {
  todaySales: {
    revenue: number;
    profit: number;
    transactions: number;
    quantity: number;
  };
  paymentBreakdown: {
    cashReceived: number;
    onlineReceived: number;
    pendingPayments: number;
  };
  topSellingVegetables: {
    name: string;
    quantity: number;
    revenue: number;
    profit: number;
  }[];
  farmerWiseReport: {
    farmerId: string;
    farmerName: string;
    vegetablesSupplied: string[];
    quantitySold: number;
    revenueGenerated: number;
    profitGenerated: number;
  }[];
  customersServedToday: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: "Owner" | "Staff";
  isDisabled?: boolean;
}

