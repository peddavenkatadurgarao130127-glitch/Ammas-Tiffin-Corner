# Amma's Tiffin Corner — real Vercel backend

This package keeps the existing HTML frontend and replaces the browser-only `window.storage` order store with a real API backed by Supabase. Vercel supports Node.js serverless functions under `/api`.

## 1. Create the database
Create a Supabase project, open SQL Editor, and run `schema.sql`.

## 2. Add Vercel Environment Variables
In Vercel → Project → Settings → Environment Variables, add:
- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase service-role key (server only; never put it in HTML)
- `OWNER_PASSCODE` = your private shop-owner password

## 3. Upload
Upload this whole folder/zip to Vercel. `index.html` is the website and `/api` contains the backend.

## 4. Test
- Open the website.
- Add an item → Place Order.
- Confirm an Order ID appears.
- Use Track This Order.
- Open Shop Owner Login and use your `OWNER_PASSCODE`.
- Advance status and mark payment as paid.

The API validates menu names/prices on the server so customers cannot change prices from browser developer tools.
