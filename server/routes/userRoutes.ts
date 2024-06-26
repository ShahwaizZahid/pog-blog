import { Router } from "express"
import { isValidEmail } from "../lib/isValidEmail.js"
import { lucia } from "../lib/auth.js"
import { generateId } from "lucia"
import { Argon2id } from "oslo/password"
import { UserModel } from "../models/UserModel.js"
import { isAuthenticated } from "../middleware/is-authenticated.js"
import { ValidationCodeModel } from "../models/ValidationCodeModel.js"
import { sendVerificationEmail } from "../controllers/sendEmail.js"
import { BlogModel } from "../models/BlogModel.js"

export const userRouter = Router()
const MIN_PASSWORD_LENGTH = 6
const argon2id = new Argon2id()

userRouter.post("/signup", async (req, res) => {
  const { email = "", password = "", username = "" } = req.body

  const exists = await UserModel.findOne({ email })

  if (exists && !exists.verified) {
    await UserModel.deleteOne({ email })
    return res.status(400).json({
      message: "Email already exists and not verified. Register again.",
    })
  }

  if (exists) {
    return res.status(400).json({ message: "Email already exists." })
  }

  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email" })
  }

  if (
    !password ||
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH
  ) {
    return res.status(400).json({ message: "Invalid password" })
  }

  const hashedPassword = await argon2id.hash(password)
  const userId = generateId(15)

  const validationCodeDoc = new ValidationCodeModel({
    email,
    code: Math.floor(100000 + Math.random() * 900000),
    expiration: new Date(Date.now() + 3600000),
  })

  try {
    await UserModel.create({
      _id: userId,
      email,
      password: hashedPassword,
      username,
      profilePicture: "https://picsum.photos/200/300",
    })
    await validationCodeDoc.save()
  } catch {
    return res.status(500).json({ message: "Server error" })
  }

  try {
    await sendVerificationEmail({
      email,
      validationCode: validationCodeDoc.code,
    })
    res.status(200).json({ message: "Email sent successfully." })
  } catch (err) {
    console.error("Error while logging in: ", err)
    return res.status(500).json({
      message: "Error while sending email. Make sure it is a valid email.",
    })
  }
})

userRouter.post("/login", async (req, res) => {
  const { email = "", password = "" } = req.body

  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email" })
  }

  if (
    !password ||
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH
  ) {
    return res.status(400).json({ message: "Invalid password" })
  }

  try {
    const user = await UserModel.findOne({ email })

    if (!user) {
      return res.status(400).json({ message: "User does not exist" })
    }

    const validPassword = await argon2id.verify(user.password, password)

    if (!validPassword) {
      return res.status(400).json({ message: "Invalid email or password" })
    }

    const session = await lucia.createSession(user._id, {})

    res
      .appendHeader(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize()
      )
      .status(200)
      .json({
        message: "Login successful!",
        user: {
          username: user.username,
          email: user.email,
          profilePicture: user.profilePicture,
          biography: user.biography,
          id: user._id,
        },
      })
  } catch (err) {
    console.error("Error while logging in: ", err)
    res.status(500).json({ message: "Internal Server error" })
  }
})

userRouter.get("/me", isAuthenticated, async (_, res) => {
  if (res.locals.session) {
    try {
      const user = await UserModel.findOne({ _id: res.locals.session.userId })

      res.status(200).json({
        username: user?.username,
        email: user?.email,
        profilePicture: user?.profilePicture,
        biography: user?.biography,
        id: user?._id,
      })
    } catch (err) {
      console.error("Error while logging in: ", err)
      res.status(500).json({ message: "Something went wrong!" })
    }
  }
})

userRouter.post("/verify-email", async (req, res) => {
  try {
    const { email = "", otp: validationCode = "" } = req.body

    const validationData = await ValidationCodeModel.findOne({
      email,
      code: validationCode,
      expiration: { $gt: new Date() },
    })

    if (!validationData) {
      return res
        .status(400)
        .json({ message: "Invalid or expired validation code." })
    }

    try {
      const user = await UserModel.findOne({ email })
      if (user) {
        user.verified = true
        await user.save()
      }
    } catch {
      res.status(400).json({ message: "User does not exist." })
    }

    await ValidationCodeModel.deleteOne({ email, code: validationCode })

    res.status(200).json({ message: "Email verified successfully." })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Internal server error." })
  }
})

userRouter.get("/:username", async (req, res) => {
  const { username } = req.params

  try {
    const user = await UserModel.findOne({ username })

    if (!user) {
      return res.status(400).json({ message: "User does not exist!" })
    }

    const isProfileOwner = res.locals.session?.userId === user._id

    const userBlogs = await BlogModel.find({ author: user._id })
      .sort({ datePublished: -1 })
      .limit(20)

    res.status(200).json({
      username: user.username,
      profilePicture: user.profilePicture,
      biography: user.biography,
      id: user._id,
      blogs: userBlogs.map((blog) => ({
        id: blog._id,
        title: blog.title,
        description: blog.description,
        datePublished: blog.datePublished.toISOString(),
        likes: blog.likes.length,
        image: blog.image,
        hasLiked:
          blog.likes.includes(res.locals.session?.userId ?? "") ?? false,
      })),
      isProfileOwner,
    })
  } catch {
    res.status(500).json({ message: "Internal Server Error!" })
  }
})
