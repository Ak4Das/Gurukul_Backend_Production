import mongoose from "mongoose"
import bcrypt from "bcryptjs"

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["admin", "clerk", "teacher", "supervisor", "student", "parent"],
    },
    status: {
      type: String,
      enum: ["active", "suspended", "inactive"],
      default: "active",
    },
    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      default: "",
      trim: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Male",
    },
    dob: {
      type: String,
    },
    address: {
      type: String,
      default: "",
    },
    qualification: { type: String },
    specialization: { type: String },
    joined: { type: String },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

// Register middleware that executes before save document
// Mongoose will wait for the returned Promise to resolve before continuing the save.
userSchema.pre("save", async function () {
  // isModified check that is password property assign in the request body or not
  if (!this.isModified("passwordHash")) {
    // "this" points to document being saved
    return
  }

  // If password is already hashed with bcrypt or not if not then only hash the password
  // hashes generated with bcrypt generally stat with "$2a$" or "$2b$"
  if (
    !this.passwordHash.startsWith("$2a$") &&
    !this.passwordHash.startsWith("$2b$")
  ) {
    const salt = await bcrypt.genSalt(10) // A salt is random data added to a password before hashing (Here 10 is the cost factor)
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
  }
})

// This method to compare password will be accessible to each individual Mongoose document which are created using User model
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash)
}

// Transform method to omit sensitive fields when returning JSON
userSchema.methods.toPublicJSON = function () {
  const obj = this.toObject()
  delete obj.passwordHash
  delete obj.__v
  return obj
}

// userSchema.index({ username: 1 });

export const User = mongoose.model("User", userSchema, "users")
