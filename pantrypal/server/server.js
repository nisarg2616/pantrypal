import 'dotenv/config'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import express from 'express'; import cors from 'cors'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose'; import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken';
import { Recipe, Substitution, User } from './models.js';
const app = express(); app.use(helmet({ contentSecurityPolicy: false }), cors(), express.json(), rateLimit({ windowMs: 6e4, max: 300 }));
const SECRET = process.env.JWT_SECRET || 'dev-secret', STAPLE = ['salt', 'water', 'oil', 'sugar', 'black pepper', 'pepper'];
const A = f => (q, s, n) => f(q, s, n).catch(e => s.status(500).json({ error: e.message }));
const dietQ = d => d === 'jain' ? { isJain: true } : d === 'nonveg' ? { diet: 'non-veg' } : { diet: 'veg' };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// typo tolerance: every one-letter substitution or deletion of the query ("panner" -> "pan.er" matches "paneer")
const fuzzy = q => { const a = []; for (let i = 0; i < q.length; i++) { a.push(esc(q.slice(0, i)) + '.' + esc(q.slice(i + 1))); a.push(esc(q.slice(0, i)) + esc(q.slice(i + 1))) } return new RegExp(a.join('|'), 'i') };
const auth = (q, s, n) => { try { q.uid = jwt.verify((q.headers.authorization || '').slice(7), SECRET).id; n() } catch { s.status(401).json({ error: 'Please log in first' }) } };
const tok = u => ({ token: jwt.sign({ id: u._id }, SECRET, { expiresIn: '7d' }), user: { name: u.name, email: u.email } });

app.get('/api/recipes', A(async (q, s) => {
  const { q: t = '', diet = 'veg', cuisine, time, page = 1 } = q.query, f = dietQ(diet); if (cuisine) f.cuisine = cuisine;
  if (time) f.$expr = { $lte: [{ $add: [{ $ifNull: ['$prepTime', 0] }, { $ifNull: ['$cookTime', 0] }] }, +time] };
  const run = re => {
    const g = { ...f }; if (re) g.$or = [{ title: re }, { ingNames: re }, { cuisine: re }, { tags: re }, { course: re }];
    return Promise.all([Recipe.find(g).select('-steps').sort({ _id: 1 }).skip((page - 1) * 24).limit(24).lean(), Recipe.countDocuments(g)])
  };
  const r = t.trim(); let [items, total] = await run(r ? new RegExp(esc(r), 'i') : null);
  if (!items.length && r.length > 3) [items, total] = await run(fuzzy(r.toLowerCase()));
  s.json({ items, total })
}));
app.get('/api/recipes/bulk', A(async (q, s) => s.json(await Recipe.find({ _id: { $in: (q.query.ids || '').split(',').filter(Boolean) } }).select('-steps').lean())));
app.get('/api/recipes/:id', A(async (q, s) => { const r = await Recipe.findById(q.params.id).lean(); r ? s.json(r) : s.status(404).json({ error: 'Recipe not found' }) }));
app.get('/api/facets', A(async (q, s) => s.json((await Recipe.distinct('cuisine', dietQ(q.query.diet))).filter(Boolean).sort())));
app.get('/api/ingredients', A(async (q, s) => s.json((await Recipe.aggregate([{ $match: dietQ(q.query.diet) }, { $unwind: '$ingNames' }, { $match: { ingNames: { $nin: STAPLE } } }, { $group: { _id: '$ingNames', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 120 }])).map(x => x._id))));
// Fridge matching: score = have/total (staples ignored) + 0.15 per "use first" ingredient
app.post('/api/fridge/match', A(async (q, s) => {
  const { ingredients = [], useFirst = [], diet = 'veg' } = q.body, have = ingredients.map(x => x.toLowerCase()), uf = useFirst.map(x => x.toLowerCase());
  s.json(await Recipe.aggregate([{ $match: { ...dietQ(diet), ingNames: { $in: have } } },
  { $addFields: { core: { $setDifference: ['$ingNames', STAPLE] } } },
  { $addFields: { have: { $size: { $setIntersection: ['$core', have] } }, total: { $size: '$core' }, missing: { $setDifference: ['$core', have] }, boost: { $size: { $setIntersection: ['$core', uf] } } } },
  { $match: { have: { $gt: 0 } } }, { $addFields: { score: { $add: [{ $divide: ['$have', { $max: ['$total', 1] }] }, { $multiply: [.15, '$boost'] }] } } },
  { $sort: { score: -1, have: -1 } }, { $limit: 30 }, { $project: { steps: 0, core: 0, ingredients: 0 } }]))
}));
app.get('/api/substitutes', A(async (q, s) => {
  const n = (q.query.ingredient || '').toLowerCase(), d = q.query.diet;
  s.json((await Substitution.find().lean()).filter(x => new RegExp(x.match, 'i').test(n) && (d === 'jain' ? x.jain : d === 'veg' ? x.veg : true)))
}));
app.post('/api/auth/register', A(async (q, s) => {
  const { name, email, password } = q.body;
  if (!email || !password || password.length < 6) return s.status(400).json({ error: 'Email and a password of 6+ characters are required' });
  if (await User.findOne({ email })) return s.status(409).json({ error: 'That email is already registered' });
  s.json(tok(await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) })))
}));
app.post('/api/auth/login', A(async (q, s) => {
  const u = await User.findOne({ email: q.body.email });
  if (!u || !(await bcrypt.compare(q.body.password || '', u.passwordHash))) return s.status(401).json({ error: 'Wrong email or password' }); s.json(tok(u))
}));
app.get('/api/users/favorites', auth, A(async (q, s) => s.json((await User.findById(q.uid).populate({ path: 'favorites', select: '-steps' })).favorites)));
app.post('/api/users/favorites', auth, A(async (q, s) => {
  const u = await User.findById(q.uid), id = q.body.id, i = u.favorites.findIndex(x => String(x) === id);
  i < 0 ? u.favorites.push(id) : u.favorites.splice(i, 1); await u.save(); s.json(u.favorites)
}));
app.post('/api/recipes/:id/rate', auth, A(async (q, s) => {
  const v = Math.min(5, Math.max(1, +q.body.value || 0)), r = await Recipe.findById(q.params.id);
  r.ratingAvg = (r.ratingAvg * r.ratingCount + v) / (r.ratingCount + 1); r.ratingCount++; await r.save(); s.json({ ratingAvg: r.ratingAvg, ratingCount: r.ratingCount })
}));

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get('*', (q, s) => s.sendFile(path.join(dist, 'index.html'))) }
await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pantrypal');
app.listen(process.env.PORT || 5000, () => console.log('PantryPal API on port ' + (process.env.PORT || 5000)));