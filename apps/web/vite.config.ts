import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  server:{ port:5173 },
  build:{
    // Emit at the repository root so Vercel does not need to resolve a
    // workspace-relative output directory.
    outDir:'../../dist',
    emptyOutDir:true
  }
});
