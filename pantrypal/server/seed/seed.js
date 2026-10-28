import 'dotenv/config';import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
import mongoose from 'mongoose';import {parse} from 'csv-parse/sync';import {Recipe,Substitution} from '../models.js';
const here=path.dirname(fileURLToPath(import.meta.url)),dir=path.join(here,'data');
const MEAT=/chicken|beef|lamb|pork|bacon|\bham\b|sausage|turkey|duck|goat|mutton|fish|salmon|tuna|\bcod\b|prawn|shrimp|crab|mussel|squid|anchov|sardine|mackerel|\beggs?\b|gelatin|lard|oyster|clam|lobster|veal|chorizo|prosciutto|pancetta|venison|rabbit|trout|herring|scallop|steak|keema|mince/i;
const NOJAIN=/onion|garlic|potato|carrot|radish|beet|ginger|mushroom|turnip|parsnip|shallot|leek|\byam\b|celeriac|swede|chive|scallion|truffle|aloo|pyaaz|lehsun/i;
const UNITS='cups?|tablespoons?|tbsp|teaspoons?|tsp|grams?|gms?|g|kg|ml|l|litres?|liters?|pinch(?:es)?|inch|inches|cloves?|sprigs?|bunch(?:es)?|handful|pieces?|slices?|cans?|large|medium|small|whole|nos?';
const UNITRE=new RegExp('^(?:(?:'+UNITS+')\\b\\.?\\s*)+');
const clean=s=>s.toLowerCase().replace(/\(.*?\)/g,' ').replace(/\s+[-\u2013\u2014:]\s+.*$/,'').replace(/^[\d\s\/.\u00bd\u00bc\u00be-]+/,'').replace(UNITRE,'')
 .replace(/\b(finely|roughly|thinly|freshly|coarsely)?\s*(chopped|sliced|grated|crushed|minced|diced|ground|powdered|soaked|boiled|cooked|washed|peeled|mashed|roasted)\b.*$/,'')
 .replace(/\bto taste\b|\bas required\b|\bas needed\b/g,'').replace(/^of\s+/,'').replace(/\s+/g,' ').trim();
const list=v=>{if(!v)return[];v=String(v).trim();if(v[0]==='['){try{return JSON.parse(v.replace(/'/g,'"'))}catch{return v.slice(1,-1).split(/',\s*'|",\s*"/).map(x=>x.replace(/^['"]|['"]$/g,''))}}return v.split(',')};
const stepsOf=v=>{if(!v)return[];v=String(v).trim();return(v[0]==='['?list(v):v.split(/\r?\n+|(?<=[.!?])\s+(?=[A-Z])/)).map(x=>x.trim()).filter(x=>x.length>3)};
const num=v=>{const n=parseFloat(v);return n>=0?n:undefined};
const ok=v=>v&&v!=='-1'?v:undefined;
const g=(r,...k)=>{for(const x of k)if(r[x]&&String(r[x]).trim())return r[x]};
function norm(r){
 const title=String(g(r,'translatedrecipename','recipename','name','title','recipe_name')||'').trim();if(!title)return null;
 const disp=list(g(r,'translatedingredients','ingredients')).map(x=>x.trim()).filter(Boolean);
 const cl=g(r,'cleaned_ingredients'),names=(cl?list(cl):disp).map(x=>clean(String(x))).filter(Boolean);if(!names.length)return null;
 const dietCol=g(r,'diet'),veg=dietCol?!/non|egg/i.test(dietCol):!disp.concat(names).some(i=>MEAT.test(i));
 let prep=num(g(r,'prep','prep_time','preptimeinmins')),cook=num(g(r,'cook','cook_time','cooktimeinmins','minutes'));const total=num(g(r,'total','totaltimeinmins'));
 if(prep==null&&cook==null&&total!=null)cook=total;
 const nut=r.nutrition?list(r.nutrition).map(Number):[];
 return{title,image:g(r,'image','image_url'),cuisine:ok(g(r,'cuisine','state','region')),course:ok(g(r,'course')),prepTime:prep,cookTime:cook,
  diet:veg?'veg':'non-veg',isJain:veg&&!names.some(i=>NOJAIN.test(i)),ingredients:disp.length?disp:names,ingNames:[...new Set(names)],
  steps:stepsOf(g(r,'translatedinstructions','instructions','steps','directions')),calories:nut[0]>=0?nut[0]:undefined,
  tags:[...list(r.tags),r.flavor_profile].map(x=>x&&String(x).trim()).filter(x=>x&&x!=='-1')}}
await mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/pantrypal');
const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.toLowerCase().endsWith('.csv')):[];
if(!files.length){console.error('No .csv files found in server/seed/data/. Copy your dataset files there first.');process.exit(1)}
await Recipe.deleteMany({});const LIMIT=+process.env.SEED_LIMIT||20000;let total=0,batch=[];
for(const f of files){let n=0,skipped=0;
 for(const row of parse(fs.readFileSync(path.join(dir,f)),{columns:h=>h.map(x=>x.trim().toLowerCase().replace(/[-\s]+/g,'_')),skip_empty_lines:true,relax_quotes:true,relax_column_count:true,bom:true})){
  if(n>=LIMIT)break;const d=norm(row);if(!d){skipped++;continue}batch.push(d);n++;total++;
  if(batch.length>=1000){await Recipe.insertMany(batch);batch=[]}}
 console.log(f+': '+n+' recipes imported, '+skipped+' rows skipped')}
if(batch.length)await Recipe.insertMany(batch);
await Substitution.deleteMany({});await Substitution.insertMany(JSON.parse(fs.readFileSync(path.join(here,'substitutions.json'),'utf8')));
await Recipe.syncIndexes();console.log('Done. '+total+' recipes imported.');process.exit(0);