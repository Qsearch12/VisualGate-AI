# Deployment Instructions

## 1. Supabase Setup
1. Go to your Supabase project dashboard.
2. Open the SQL Editor.
3. Copy the contents of `supabase/schema.sql` and run it.
4. Ensure the `faces` storage bucket is created and set to Public.

## 2. Backend Deployment (Railway)
1. Push this repository to GitHub.
2. Go to [Railway](https://railway.app/).
3. Click "New Project" -> "Deploy from GitHub repo".
4. Select your repository.
5. Railway will automatically detect the `Dockerfile` in the `/backend` folder (you may need to set the Root Directory to `/backend` in Railway settings).
6. Go to the Variables tab and add:
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key
   - `GEMINI_API_KEY`: Your Gemini API Key
7. Wait for the build and deployment to finish.
8. Copy the public URL provided by Railway.

## 3. Frontend Deployment (Netlify)
1. Go to [Netlify](https://www.netlify.com/).
2. Click "Add new site" -> "Import an existing project".
3. Connect your GitHub and select the repository.
4. Set the Build Command to `npm run build` and Publish directory to `dist`.
5. Click "Add environment variables" and add:
   - `VITE_API_URL`: The Railway public URL you copied earlier (e.g., `https://your-app.up.railway.app`)
6. Click "Deploy site".
