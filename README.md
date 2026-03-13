# Catha Lounge POS System

A modern, comprehensive Point of Sale (POS) and Inventory Management System built with Next.js, React, and TypeScript.

## Features

- **Point of Sale (POS)**: Complete sales interface with cart management, payment processing, and receipt generation
- **Inventory Management**: Track stock levels, manage products, and monitor inventory movements
- **Order Management**: View, edit, and manage orders with payment tracking
- **Supplier Management**: Manage suppliers, track deliveries, and monitor outstanding balances
- **Stock Movement**: Track all inventory inflows and outflows with detailed history
- **Expense Tracking**: Record and monitor business expenses
- **User Management**: Comprehensive user management with role-based permissions
- **M-Pesa Integration**: Track M-Pesa transactions
- **Reports & Analytics**: View sales reports and analytics
- **Modern UI**: Beautiful, responsive design with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Charts**: Recharts

## Getting Started

1. Install dependencies:
```bash
npm install
# or
pnpm install
```

2. Run the development server:
```bash
npm run dev
# or
pnpm dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── pos/               # POS sales page
│   ├── inventory/         # Inventory management
│   ├── orders/            # Order management
│   ├── suppliers/         # Supplier management
│   ├── stock-movement/    # Stock movement tracking
│   ├── expenses/          # Expense tracking
│   ├── users/             # User management
│   └── ...
├── components/            # React components
│   ├── layout/           # Layout components
│   ├── pos/              # POS components
│   ├── inventory/        # Inventory components
│   └── ...
├── lib/                   # Utility functions and data
└── public/                # Static assets
```

## Features in Detail

### POS System
- Product browsing with categories
- Shopping cart with quantity management
- Multiple payment methods (Cash, Card, M-Pesa)
- Pay Later functionality
- Custom item addition
- Receipt generation
- Table management

### Inventory Management
- Product catalog with images
- Stock level tracking
- Low stock alerts
- Barcode support
- Category management
- Supplier tracking

### Order Management
- View all orders
- Filter by status and payment method
- Edit orders
- Add items to existing orders
- Bulk payment processing
- Order details view

## License

MIT

