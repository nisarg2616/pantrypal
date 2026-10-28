import mongoose from 'mongoose';
const {Schema,model}=mongoose;
const R=new Schema({title:String,image:String,cuisine:String,course:String,prepTime:Number,cookTime:Number,
 diet:{type:String,enum:['veg','non-veg']},isJain:Boolean,ingredients:[String],ingNames:[String],steps:[String],
 calories:Number,tags:[String],ratingAvg:{type:Number,default:0},ratingCount:{type:Number,default:0}});
R.index({title:'text',tags:'text',cuisine:'text'});R.index({ingNames:1});R.index({diet:1,isJain:1});
export const Recipe=model('Recipe',R);
export const Substitution=model('Substitution',new Schema({match:String,name:String,ratio:String,note:String,veg:Boolean,jain:Boolean}));
export const User=model('User',new Schema({name:String,email:{type:String,unique:true},passwordHash:String,favorites:[{type:Schema.Types.ObjectId,ref:'Recipe'}]}));
