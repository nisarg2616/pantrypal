# PantryPal (MERN)

Requirements: Node 18+, MongoDB running locally (or a MongoDB Atlas URI).

1. Put YOUR dataset CSV files in `server/seed/data/` (e.g. Indian Food 101 `indian_food.csv`, Food.com `RAW_recipes.csv`, or RecipeNLG).
2. Server:  `cd server && npm install && cp .env.example .env && npm run seed && npm start`
3. Client:  `cd client && npm install && npm run dev`  -> open http://localhost:5173
   (Production: `npm run build` in client; the server then serves client/dist on port 5000.)

Notes: Indian Food 101 has no cooking steps or images; the app shows that honestly. Add a Food.com / RecipeNLG CSV for steps.
`SEED_LIMIT` in .env caps recipes imported per file (default 20000).
