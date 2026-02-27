# Product Specification: JBROCK (Sales & Distribution Management System)

## 1. Product Overview
**JBROCK** is a modern, responsive web application designed for comprehensive sales and distribution management. It serves as a unified platform to manage daily sales operations, track inventory in real-time, maintain customer relationships, and control employee access. Built with a decoupled architecture (Backend-as-a-Service), JBROCK ensures high performance, security, and scalability.

## 2. Target Audience
- **Business Owners/Managers:** Need real-time insights into sales performance, stock levels, and overall business health.
- **Sales Staff/Cashiers:** Require an efficient Point of Sale (POS) system for fast transaction processing.
- **Inventory Managers:** Need tools to monitor stock movements, manage product categories, and prevent stockouts.
- **Administrators:** Require role-based access control to manage employee permissions and system settings.

## 3. Core Features

### 3.1. Dashboard
- **Real-time Overview:** A centralized hub displaying key metrics such as daily sales, total revenue, and active stock alerts.
- **Visual Analytics:** Easy-to-read charts and summaries for quick business performance assessment.

### 3.2. Point of Sales (POS)
- **Transaction Processing:** Fast and intuitive interface for recording sales.
- **Cart Management:** Support for adding, removing, and modifying items before checkout.
- **Payment Handling:** Flexible payment methods and digital receipt generation.

### 3.3. Inventory Management
- **Product Tracking:** Detailed profiles for each product including SKU, pricing, and supplier info.
- **Stock Levels:** Real-time monitoring of available quantities.
- **Categorization:** Organize items by categories for easier search and reporting.
- **Stock Movements (In/Out):** Logging of stock additions (purchases) and deductions (sales/damages).

### 3.4. Customer Management
- **Customer Profiles:** Maintain detailed records of individual clients and businesses.
- **Credit Limits:** Tools to track and manage customer credit lines and outstanding balances.
- **Location Tracking/Mapping:** (Admin Feature) Interactive map integration for pinpointing customer locations.

### 3.5. Employee & Access Control
- **Role-Based Access Control (RBAC):** Defined roles such as Admin, Owner, and Staff with specific permissions.
- **User Management:** Create, edit, and deactivate employee accounts.
- **Activity Tracking:** Ensure accountability by logging key actions (e.g., who processed a payment).

### 3.6. Reports & Analytics
- **Sales Reports:** Detailed breakdowns of sales over specific periods.
- **Stock Reports:** Documentation of stock flow, including specific columns for promotional/free items.
- **Export Capabilities:** Export data to PDF, CSV, and Excel formats for external analysis.

### 3.7. Progressive Web App (PWA) Support
- **Cross-Platform:** Installable on desktops, tablets, and mobile devices as a native-like application.
- **Responsive Design:** Optimized for various screen sizes, ensuring a seamless experience on both desktop and mobile modes.

## 4. Technical Architecture

JBROCK utilizes a decoupled architecture, separating the client-side presentation from the server-side data management.

### 4.1. Frontend (Client-Side)
- **Framework:** React
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS, Shadcn UI
- **State Management:** TanStack Query for server state, React Context for global app state.
- **Deployment:** Optimized for static hosting platforms (e.g., Vercel, Cloudflare Pages, Nginx/aaPanel).

### 4.2. Backend & Database (BaaS)
- **Infrastructure:** Supabase
- **Database:** PostgreSQL
- **API:** PostgREST (auto-generated RESTful APIs)
- **Authentication:** GoTrue Auth (Email/Password, Google OAuth)
- **Security:** Row Level Security (RLS) policies implemented via SQL to ensure data privacy and access control.

## 5. Security & Data Integrity
- **Data Protection:** All database interactions are governed by Supabase RLS policies.
- **Attribution:** Critical actions (like payment processing) explicitly track the `created_by` user ID to maintain an audit trail.
- **Input Validation:** Frontend validation utilizing numerical keyboards (`type="tel"`, `inputMode="numeric"`) for specific fields (phone numbers, account numbers) on mobile devices to ensure data quality.

## 6. Future Enhancements / Roadmap
- Enhanced offline capabilities via Service Workers.
- Advanced automated reporting and email scheduling.
- Integration with external accounting software or payment gateways.
- Multi-branch inventory tracking capabilities.
