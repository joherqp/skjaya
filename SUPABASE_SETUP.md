# Supabase Migration Setup Guide

## Overview

This guide will help you set up Supabase as the database backend for the CVSKJ application using the new consolidated `schema.sql`.

## Prerequisites

- Node.js installed
- Supabase account (free tier available)

## Step-by-Step Setup

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in project details:
   - **Name**: CVSKJ
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Select closest to your location
5. Wait for project to be created (~2 minutes)

### 2. Get Your Credentials

1. In your Supabase project dashboard, click **Settings** (gear icon)
2. Navigate to **API** section
3. You'll find:
   - **Project URL**
   - **anon/public key**

### 3. Configure Environment Variables

1. Open `.env.local` file in the project root
2. Replace the placeholder values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Database Migration

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open the file `schema.sql` from this project
4. Copy the entire SQL script
5. Paste it into the Supabase SQL Editor
6. Click **Run** (or press Ctrl/Cmd + Enter)
7. Wait for execution to complete (should see "Success")

### 5. Verify Migration

1. Go to **Table Editor** in Supabase
2. You should see all tables including `promo`, `users`, `barang`, etc.
3. Check `users` table - it should have 1 admin user (`herujohaeri@gmail.com`).

### 6. Create Admin User in Supabase Auth

Since we're using Supabase Auth, we need to manually create the auth user that matches our seed data:

1. Go to **Authentication** > **Users** in Supabase dashboard
2. Click **Add User** > **Create new user**
3. Fill in:
   - **Email**: `herujohaeri@gmail.com`
   - **Password**: `admin123` (or your preferred password)
   - Auto Confirm User: **Enabled**
4. Click **Create User**

### 7. Start Development Server

```bash
npm run dev
```

### 8. Test the Application

1. Open browser to `http://localhost:5173`
2. Login with `admin` / `admin123`
