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
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      match: [/^[A-Z]/, "First letter must be capital"],
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      enum: {
        values: [
          "admin",
          "clerk",
          "teacher",
          "supervisor",
          "student",
          "parent",
        ],
        message: "Invalid role",
      },
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: {
        values: ["active", "suspended", "inactive"],
        message: "Invalid status",
      },
      default: "active",
    },
    email: {
      type: String,
      required: [
        function () {
          return ["admin", "supervisor", "clerk", "teacher"].includes(this.role)
        },
        "Email is required for admin, supervisor, clerk, and teacher roles",
      ],
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    mobile: {
      type: String,
      required: [
        function () {
          return ["admin", "supervisor", "clerk", "teacher", "parent"].includes(
            this.role,
          )
        },
        "Mobile number is required for admin, supervisor, clerk, teacher, and parent roles",
      ],
      trim: true,
      match: [
        /^\+[1-9]\d{0,2} \d{5} \d{5}$/,
        "Mobile number must be '+<country code> <Five digit> <Remaining Five digits>' format",
      ],
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: {
        values: ["Male", "Female", "Other"],
        message: "Invalid gender",
      },
      default: "Male",
    },
    dob: {
      type: String,
      match: [
        /^\d{4}-\d{2}-\d{2}$/,
        "Date of birth must be in YYYY-MM-DD format",
      ],
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },

    qualification: {
      type: String,
      trim: true,
    },
    specialization: {
      type: String,
      trim: true,
    },
    joined: {
      type: String,
    },
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    lastLogin: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: {
        $in: ["admin", "clerk", "supervisor", "teacher", "parent"],
      },
      email: { $exists: true },
    },
  },
)

userSchema.index(
  { mobile: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: {
        $in: ["admin", "clerk", "supervisor", "teacher", "parent"],
      },
      mobile: { $exists: true },
    },
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

export const User = mongoose.model("User", userSchema, "users")
