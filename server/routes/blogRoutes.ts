import { Router, type Request } from "express"
import { BlogModel } from "../models/BlogModel.js"
import { isAuthenticated } from "../middleware/is-authenticated.js"
import { CommentModel } from "../models/CommentsModel.js"
import { UserModel } from "../models/UserModel.js"

interface CommentPostRequest extends Request {
  body: {
    content: string
  }
}

export const blogsRouter = Router()

const PAGE_SIZE = 20

blogsRouter.get("/", async (req, res) => {
  const page = parseInt(req.query.page as string)

  if (isNaN(page) || page < 1) {
    return res.status(400).json({ message: "Invalid page number" })
  }

  const skip = (page - 1) * PAGE_SIZE

  try {
    const blogs = await BlogModel.find()
      .sort({ datePublished: -1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .select("title description datePublished likes _id author image")
      .populate({ path: "author", select: "username profilePicture" })
      .exec()

    const totalDocuments = await BlogModel.countDocuments()
    const hasMore = page * PAGE_SIZE < totalDocuments

    res.json({
      blogs: blogs.map((blog) => ({
        id: blog._id,
        title: blog.title,
        description: blog.description,
        datePublished: blog.datePublished.toISOString(),
        likes: blog.likes.length,
        author: {
          // @ts-ignore
          username: blog.author.username,
          // @ts-ignore
          profilePicture: blog.author.profilePicture,
        },
        image: blog.image,
        hasLiked:
          blog.likes.includes(res.locals.session?.userId ?? "") ?? false,
      })),
      hasMore,
      nextPage: hasMore ? page + 1 : null,
    })
  } catch {
    res.status(500).json({ message: "Something went wrong!" })
  }
})

blogsRouter.post("/like/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params

  try {
    const blog = await BlogModel.findOneAndUpdate(
      { _id: id, likes: { $nin: [res.locals.session?.userId] } },
      {
        $addToSet: {
          likes: res.locals.session?.userId,
        },
      },
      {
        new: true,
      }
    )
      .select("likes")
      .exec()

    if (blog) res.status(200).json({ likes: blog.likes.length })
    else
      res
        .status(400)
        .json({ message: "You have already liked this blog" })
        .end()
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: "Internal Server Error!" })
  }
})

blogsRouter.get("/likedBy/:id", async (req, res) => {
  const { id } = req.params
  const page = parseInt(req.query.page as string)

  if (isNaN(page) || page < 1) {
    return res.status(400).json({ message: "Invalid page number" })
  }

  const skip = (page - 1) * PAGE_SIZE

  try {
    const blog = await BlogModel.findOne({ _id: id })
      .slice("likes", [skip, PAGE_SIZE + 1])
      .populate("likes", "username profilePicture")
      .exec()

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" })
    }

    const hasMore = blog.likes.length > PAGE_SIZE
    const nextPage = hasMore ? page + 1 : null

    res.json({ users: blog.likes, hasMore, nextPage })
  } catch (error) {
    console.error("Error fetching likedBy data:", error)
    res.status(500).json({ message: "Internal Server Error" })
  }
})

blogsRouter.get("/comments/:id", async (req, res) => {
  const { id } = req.params
  const page = parseInt(req.query.page as string)

  if (isNaN(page) || page < 1) {
    return res.status(400).json({ message: "Invalid page number" })
  }

  const skip = (page - 1) * PAGE_SIZE

  try {
    const comments = await CommentModel.find({ blog: id })
      .sort({ datePosted: -1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .populate({ path: "author", select: "username profilePicture" })
      .exec()

    const totalDocuments = await CommentModel.find({
      blog: id,
    }).countDocuments()
    const hasMore = page * PAGE_SIZE < totalDocuments

    res.json({
      comments: comments.map((c) => ({
        id: c._id,
        content: c.content,
        author: {
          // @ts-ignore
          username: c.author.username,
          // @ts-ignore
          profilePicture: c.author.profilePicture,
        },
        datePosted: c.datePosted,
      })),
      hasMore,
      nextPage: hasMore ? page + 1 : null,
    })
  } catch {
    return res.status(500).json({ message: "Internal Server Error!" })
  }
})

const MAX_COMMENT_CHARS = 1000

blogsRouter.post(
  "/comment/:id",
  isAuthenticated,
  async (req: CommentPostRequest, res) => {
    const { id } = req.params
    const { content } = req.body

    if (content.length > MAX_COMMENT_CHARS) {
      return res.status(400).json({ message: "Comment too long!" })
    }

    try {
      const newComment = await CommentModel.create({
        content,
        author: res.locals.session?.userId ?? "",
        blog: id,
        datePosted: new Date(),
      })

      const updateBlog = await BlogModel.findOneAndUpdate(
        { _id: id },
        {
          $addToSet: {
            comments: newComment._id,
          },
        },
        {
          new: true,
        }
      )

      res.status(200).json({ comments: updateBlog?.comments.length })
    } catch (e) {
      console.error("Error while creating comment: ", e)
      return res.status(500).json({ message: "Internal Server Error!" })
    }
  }
)

blogsRouter.get("/:username/:title", async (req, res) => {
  const { username, title } = req.params

  try {
    const author = await UserModel.findOne({ username })

    if (!author) {
      return res.status(400).json({ message: "User does not exist!" })
    }

    const blog = await BlogModel.findOne({
      title,
      author: author._id,
    })
      .populate({ path: "author", select: "username profilePicture" })
      .exec()

    if (blog) {
      return res.json({
        id: blog._id,
        title: blog.title,
        content: blog.content,
        description: blog.description,
        datePublished: blog.datePublished.toISOString(),
        likes: blog.likes.length,
        comments: blog.comments.length,
        author: {
          // @ts-ignore
          username: blog.author.username,
          // @ts-ignore
          profilePicture: blog.author.profilePicture,
        },
        image: blog.image,
        hasLiked:
          blog.likes.includes(res.locals.session?.userId ?? "") ?? false,
      })
    }

    return res.status(404).json({ message: "Blog not found" })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: "Internal Server Error!" })
  }
})

blogsRouter.post("/add", isAuthenticated, async (req, res) => {
  const { title, content, description, image } = req.body

  if (!title || !content || !description) {
    return res.status(400).json({ message: "Missing required fields!" })
  }

  if (title.length > 100) {
    return res.status(400).json({ message: "Title too long!" })
  }

  if (description.length > 500) {
    return res.status(400).json({ message: "Description too long!" })
  }

  try {
    await BlogModel.create({
      title,
      content,
      description,
      datePublished: new Date(),
      author: res.locals.session?.userId ?? "",
      image,
      likes: [],
      comments: [],
    })

    res.status(200).json({ message: "Blog created successfully!" })
  } catch {
    return res.status(500).json({ message: "Internal Server Error!" })
  }
})
