# Deploy with Railway + Vercel

The repository is already split for the intended production layout:

- **Railway:** persistent scanner, SQLite database, REST API and live SSE stream
- **Vercel:** static React/Vite dashboard

No private key or wallet seed is required anywhere.

## 1. Upload to GitHub

Create an empty GitHub repository and upload the contents of this project so that
`package.json`, `railway.json` and `vercel.json` are at the repository root.

## 2. Deploy the scanner to Railway

1. In Railway, choose **New Project → Deploy from GitHub repo**.
2. Select this repository. Railway will automatically read `railway.json` and
   build the root `Dockerfile`.
3. Add these recommended variables:

   ```text
   RPC_URL=https://rpc.mainnet.chain.robinhood.com
   CHAIN_ID=4663
   CORS_ORIGINS=https://*.vercel.app
   START_BLOCK=latest
   ```

   Do not define `PORT`; Railway supplies it automatically. `DB_PATH` can also
   remain unset when using the volume described below.

4. Attach a Railway volume to the scanner service and mount it at `/data`.
   The app detects `RAILWAY_VOLUME_MOUNT_PATH` and uses `/data/sentinel.db`
   automatically. This preserves discoveries and the scanner cursor across
   redeployments.
5. Under **Networking**, generate a public Railway domain.
6. Confirm `https://YOUR-RAILWAY-DOMAIN/health` returns JSON with `"ok": true`.

For sustained production scanning, replace the public `RPC_URL` with a dedicated
Robinhood Chain RPC endpoint. The remaining chain and Blockscout defaults are
already built in.

## 3. Deploy the dashboard to Vercel

1. In Vercel, choose **Add New → Project** and import the same GitHub repository.
2. Keep the project root at the repository root. `vercel.json` supplies the Vite
   build command and `apps/web/dist` output directory.
3. Add this environment variable for Production, Preview and Development:

   ```text
   VITE_API_URL=https://YOUR-RAILWAY-DOMAIN
   ```

   Do not add a trailing slash.
4. Click **Deploy**.

The frontend is compiled with `VITE_API_URL`, so changing it later requires a
new Vercel deployment.

## 4. Tighten CORS after the first deploy (recommended)

The supplied Railway setting `https://*.vercel.app` supports both production
and preview deployments. Once you know the permanent Vercel URL, you can restrict
the Railway variable to exact origins:

```text
CORS_ORIGINS=https://your-project.vercel.app,http://localhost:5173
```

Multiple origins are comma-separated. Wildcard host patterns are supported.

## Publishing actual one-click buttons

Vercel can create a deployment directly from a public GitHub repository URL.
After pushing the project, replace `YOUR_GITHUB_USERNAME` in the button URL in
the main README.

A true Railway one-click button points to a Railway Template. After the first
Railway deployment is configured with its `/data` volume and variables, open the
Railway project settings and choose **Generate Template from Project**. Paste the
resulting template URL into the Railway button in the main README. This captures
the volume and service settings that cannot be created by `railway.json` alone.

## Automatic redeployments

Once both services are linked to GitHub:

- Every push to the selected branch rebuilds the Railway scanner.
- Every push rebuilds the Vercel dashboard.
- SQLite data remains on the Railway volume.
- Vercel preview deployments can access the API through the default wildcard
  CORS rule.

## Common deployment problems

| Symptom | Fix |
|---|---|
| Railway health check fails | Confirm the generated domain exists and inspect logs for RPC or native-module errors. |
| Dashboard says API unavailable | Verify `VITE_API_URL` uses the public Railway HTTPS domain, then redeploy Vercel. |
| Browser reports a CORS error | Add the exact Vercel origin to Railway `CORS_ORIGINS` and redeploy Railway. |
| Scanner starts over after redeploy | Attach a volume at `/data` and leave `DB_PATH` unset, or set `DB_PATH=/data/sentinel.db`. |
| Railway repeatedly restarts | Check RPC reachability and ensure the service has only one replica when using SQLite. |
