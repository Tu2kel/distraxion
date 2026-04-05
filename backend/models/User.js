const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true },
  age:        { type: Number, required: true },
  city:       { type: String, required: true },
  gender:     { type: String, enum: ['woman','man','non-binary'] },
  seeking:    { type: String, enum: ['women','men','everyone'] },
  background: [String],   // Active Duty, Veteran, Civilian, DoD, Military Spouse
  vibe:       [String],   // Serious only, Taking it slow, etc
  bio:        { type: String, maxlength: 300 },
  photos:     [String],   // Cloudinary URLs
  swipesUsed: { type: Number, default: 0 },
  swipeDate:  { type: String, default: '' }, // YYYY-MM-DD to reset daily
  isPremium:  { type: Boolean, default: false },
  active:     { type: Boolean, default: true },
  createdAt:  { type: Date, default: Date.now }
});

// Hash password before save
UserSchema.pre('save', async function(next){
  if(!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
UserSchema.methods.matchPassword = async function(entered){
  return bcrypt.compare(entered, this.password);
};

// Reset swipes daily
UserSchema.methods.checkSwipes = function(){
  const today = new Date().toISOString().split('T')[0];
  if(this.swipeDate !== today){
    this.swipesUsed = 0;
    this.swipeDate  = today;
  }
  const limit = this.isPremium ? Infinity : 10;
  return { used: this.swipesUsed, limit, remaining: Math.max(0, limit - this.swipesUsed) };
};

module.exports = mongoose.model('User', UserSchema);
